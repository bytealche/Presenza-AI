from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import cv2
import numpy as np
import json
import logging
import time
from datetime import datetime
from app.core.websocket_manager import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["Streaming"])

# ── AI processing runs in background so it never blocks frame relay ──────────
_ai_tasks: dict[str, asyncio.Task] = {}
_frame_buffer: dict[str, bytes] = {}  # latest frame per camera
_session_map: dict[str, int] = {}      # camera_id -> pinned session_id (avoids per-frame DB query)

async def _ai_loop(camera_id: str):
    """
    Continuously processes the latest frame for AI analysis.
    Runs as a background task so it never blocks frame relay.
    Session is resolved once at startup (or from _session_map) to avoid per-frame DB queries.
    """
    from app.ai_engine.decision_engine import process_frame
    from app.ai_engine.attendance_bridge import mark_provisional, apply_ai_decisions
    from app.models.session import Session as SessionModel
    from app.models.user import User
    from sqlalchemy import select
    from app.database.database import SessionLocal

    while camera_id in _frame_buffer:
        frame_bytes = _frame_buffer.get(camera_id)
        if not frame_bytes:
            await asyncio.sleep(0.2)
            continue

        t_frame_start = time.perf_counter()

        try:
            # ── Decode frame ─────────────────────────────────────────────
            t0 = time.perf_counter()
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            t_decode = (time.perf_counter() - t0) * 1000

            if frame is None:
                await asyncio.sleep(0.2)
                continue

            async with SessionLocal() as db:
                # ── AI inference (face detect + embed + recognize) ────────
                t1 = time.perf_counter()
                decisions = await process_frame(db, frame)
                t_ai = (time.perf_counter() - t1) * 1000

                # ── Stage 1: Provisional attendance (instant, on first detection) ──
                t2 = time.perf_counter()
                provisional_new = []
                confirmed_users = []
                attendance_saved = 0

                if decisions and session_id:
                    # Run both stages; mark_provisional is idempotent (skips known users)
                    provisional_new = await mark_provisional(db, session_id, decisions)

                    # ── Stage 2: Confirm / upgrade after behaviour analysis ───────
                    confirmed_results = await apply_ai_decisions(db, session_id, decisions)
                    attendance_saved = len(confirmed_results)
                    confirmed_users = [
                        d["user_id"] for d in decisions
                        if d.get("confirmed") and d.get("user_id")
                    ]

                elif decisions and session_id is None:
                    # Fallback: resolve active session from DB (only when not pinned)
                    now = datetime.now()
                    stmt = select(SessionModel).where(
                        SessionModel.camera_id == int(camera_id),
                        SessionModel.start_time <= now,
                        SessionModel.end_time >= now
                    )
                    result = await db.execute(stmt)
                    active_session = result.scalars().first()
                    if active_session:
                        session_id = active_session.session_id
                        provisional_new = await mark_provisional(db, session_id, decisions)
                        confirmed_results = await apply_ai_decisions(db, session_id, decisions)
                        attendance_saved = len(confirmed_results)
                        confirmed_users = [
                            d["user_id"] for d in decisions
                            if d.get("confirmed") and d.get("user_id")
                        ]

                # ── Resolve user names for sidebar display ───────────────────
                known_ids = [d["user_id"] for d in decisions if d.get("user_id")]
                name_map: dict[int, str] = {}
                if known_ids:
                    user_rows = await db.execute(
                        select(User.user_id, User.full_name).where(User.user_id.in_(known_ids))
                    )
                    name_map = {row.user_id: row.full_name for row in user_rows.all()}

                t_db = (time.perf_counter() - t2) * 1000
                t_total = (time.perf_counter() - t_frame_start) * 1000

                logger.info(
                    f"[CAM {camera_id}] Frame processed | "
                    f"decode={t_decode:.1f}ms  AI={t_ai:.1f}ms  DB={t_db:.1f}ms  "
                    f"TOTAL={t_total:.1f}ms | "
                    f"faces={len(decisions)}  provisional_new={len(provisional_new)}  confirmed={len(confirmed_users)}  saved={attendance_saved}"
                )

                # ── Build faces list for sidebar ─────────────────────────────
                unknown_count = sum(1 for d in decisions if not d.get("user_id"))
                faces_list = []
                for d in decisions:
                    uid = d.get("user_id")
                    if uid:
                        att_status = "confirmed" if d.get("confirmed") else "provisional"
                        if d.get("is_fraud"):
                            att_status = "fraud"
                        faces_list.append({
                            "user_id": uid,
                            "name": name_map.get(uid, f"Student #{uid}"),
                            "confidence": round(float(d.get("confidence") or 0), 3),
                            "status": att_status,
                            "is_fraud": d.get("is_fraud", False),
                        })
                    else:
                        faces_list.append({"user_id": None, "name": "Unknown", "status": "unknown", "confidence": 0})

                # ── Build broadcast payload ───────────────────────────────
                safe_decisions = []
                for d in decisions:
                    d_safe = d.copy()
                    if isinstance(d_safe.get("timestamp"), datetime):
                        d_safe["timestamp"] = d_safe["timestamp"].isoformat()
                    if isinstance(d_safe.get("bbox"), tuple):
                        d_safe["bbox"] = list(d_safe["bbox"])
                    safe_decisions.append(d_safe)

                payload = json.dumps({
                    "type": "ai_analysis",
                    "data": safe_decisions,
                    "faces": faces_list,
                    "unknown_count": unknown_count,
                    "timing": {
                        "decode_ms": round(t_decode, 1),
                        "ai_ms": round(t_ai, 1),
                        "db_ms": round(t_db, 1),
                        "total_ms": round(t_total, 1),
                    },
                    "attendance": {
                        "saved": attendance_saved,
                        "confirmed_users": confirmed_users,
                    }
                })
                await manager.broadcast_to_receivers(camera_id, payload)
                await manager.send_to_sender(camera_id, payload)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"AI loop error for cam {camera_id}: {e}", exc_info=True)

        # Process a frame every 0.2 seconds (5 fps analysis rate)
        await asyncio.sleep(0.2)

    logger.info(f"AI loop stopped for camera {camera_id}")


@router.websocket("/stream/{camera_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    camera_id: str,
    client_type: str = "receiver",
    session_id: int | None = None,   # pin to a specific session — skips per-frame DB lookup
):

    if client_type == "sender":
        await manager.connect_sender(websocket, camera_id)

        # Pin session_id so _ai_loop never needs to query DB per frame
        if session_id is not None:
            _session_map[camera_id] = session_id
            logger.info(f"Pinned session {session_id} to camera {camera_id}")

        # Initialize frame buffer and start AI loop
        _frame_buffer[camera_id] = b""
        if camera_id not in _ai_tasks or _ai_tasks[camera_id].done():
            _ai_tasks[camera_id] = asyncio.create_task(_ai_loop(camera_id))
            logger.info(f"Started AI loop for camera {camera_id} (session={session_id})")

        frames_relayed = 0
        try:
            while True:
                try:
                    # Use wait_for to implement server-side timeout
                    message = await asyncio.wait_for(websocket.receive(), timeout=30.0)
                except asyncio.TimeoutError:
                    # Send a ping to keep connection alive
                    try:
                        await websocket.send_text("__ping__")
                    except Exception:
                        break
                    continue

                if "bytes" in message and message["bytes"]:
                    data = message["bytes"]
                    # Update latest frame for AI
                    _frame_buffer[camera_id] = data
                    frames_relayed += 1

                    # Relay raw frame to all receivers
                    await manager.broadcast_to_receivers(camera_id, data)

                    if frames_relayed % 100 == 0:
                        logger.info(f"Cam {camera_id}: relayed {frames_relayed} frames")

                elif "text" in message:
                    txt = message.get("text", "")
                    if txt == "__pong__":
                        pass  # Heartbeat response ok
                    elif txt == "close":
                        break

        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            manager.disconnect_sender(camera_id)
            # Stop AI loop and clean up session pin
            if camera_id in _ai_tasks and not _ai_tasks[camera_id].done():
                _ai_tasks[camera_id].cancel()
            _frame_buffer.pop(camera_id, None)
            _session_map.pop(camera_id, None)
            logger.info(f"Sender disconnected: {camera_id}")

    else:
        # ── Receiver ────────────────────────────────────────────────────
        await manager.connect_receiver(websocket, camera_id)
        try:
            while True:
                try:
                    # Listen with timeout; if nothing received, send ping
                    message = await asyncio.wait_for(websocket.receive(), timeout=25.0)
                    txt = message.get("text", "")
                    if txt == "__pong__":
                        pass  # Alive
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive through proxies
                    try:
                        await websocket.send_text("__ping__")
                    except Exception:
                        break
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            manager.disconnect_receiver(websocket, camera_id)
            logger.info(f"Receiver disconnected: {camera_id}")
