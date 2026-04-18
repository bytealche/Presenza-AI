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

# ── Per-camera state ──────────────────────────────────────────────────────────
_ai_tasks: dict[str, asyncio.Task] = {}
_frame_buffer: dict[str, bytes] = {}   # latest JPEG frame per camera_id
_session_map: dict[str, int] = {}      # camera_id -> pinned session_id


async def _ai_loop(camera_id: str):
    """
    Background task: processes the latest buffered frame every 0.2 s.
    Never blocks the frame-relay path.
    """
    from app.ai_engine.decision_engine import process_frame
    from app.ai_engine.attendance_bridge import mark_provisional, apply_ai_decisions
    from app.models.session import Session as SessionModel
    from app.models.user import User
    from sqlalchemy import select
    from app.database.database import SessionLocal

    logger.info(f"[CAM {camera_id}] AI loop started")

    while camera_id in _frame_buffer:
        frame_bytes = _frame_buffer.get(camera_id)
        if not frame_bytes:
            await asyncio.sleep(0.2)
            continue

        t_frame_start = time.perf_counter()

        try:
            # ── 1. Decode JPEG ────────────────────────────────────────────
            t0 = time.perf_counter()
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            t_decode = (time.perf_counter() - t0) * 1000

            if frame is None:
                logger.warning(f"[CAM {camera_id}] cv2.imdecode returned None — bad frame, skipping")
                await asyncio.sleep(0.2)
                continue

            async with SessionLocal() as db:
                # ── 2. AI inference ───────────────────────────────────────
                t1 = time.perf_counter()
                decisions = await process_frame(db, frame)
                t_ai = (time.perf_counter() - t1) * 1000

                # ── 3. Resolve session_id ─────────────────────────────────
                t2 = time.perf_counter()
                provisional_new: list = []
                confirmed_users: list = []
                attendance_saved = 0

                # Primary: pinned by the WebSocket connect handler
                session_id: int | None = _session_map.get(camera_id)

                # Fallback: query DB for the currently-active session
                if session_id is None and decisions:
                    now = datetime.now()
                    stmt = select(SessionModel).where(
                        SessionModel.camera_id == int(camera_id),
                        SessionModel.start_time <= now,
                        SessionModel.end_time >= now,
                    )
                    result = await db.execute(stmt)
                    active_session = result.scalars().first()
                    if active_session:
                        session_id = active_session.session_id
                        logger.info(f"[CAM {camera_id}] DB-resolved session → {session_id}")

                # ── 4. Two-stage attendance ───────────────────────────────
                if session_id and decisions:
                    # Stage 1: write provisional immediately on first detection
                    provisional_new = await mark_provisional(db, session_id, decisions)

                    # Stage 2: upgrade provisional→present once presence confirmed
                    confirmed_results = await apply_ai_decisions(db, session_id, decisions)
                    attendance_saved = len(confirmed_results)
                    confirmed_users = [
                        d["user_id"] for d in decisions
                        if d.get("confirmed") and d.get("user_id")
                    ]

                # ── 5. Resolve names for sidebar ──────────────────────────
                known_ids = [d["user_id"] for d in decisions if d.get("user_id")]
                name_map: dict = {}
                if known_ids:
                    rows = await db.execute(
                        select(User.user_id, User.full_name).where(User.user_id.in_(known_ids))
                    )
                    name_map = {row.user_id: row.full_name for row in rows.all()}

                t_db = (time.perf_counter() - t2) * 1000
                t_total = (time.perf_counter() - t_frame_start) * 1000

                logger.info(
                    f"[CAM {camera_id}] decode={t_decode:.0f}ms  AI={t_ai:.0f}ms  "
                    f"DB={t_db:.0f}ms  TOTAL={t_total:.0f}ms | "
                    f"faces={len(decisions)}  prov+={len(provisional_new)}  "
                    f"conf={len(confirmed_users)}  saved={attendance_saved}"
                )

                # ── 6. Build sidebar faces list ───────────────────────────
                unknown_count = sum(1 for d in decisions if not d.get("user_id"))
                faces_list = []
                for d in decisions:
                    uid = d.get("user_id")
                    if uid:
                        if d.get("is_fraud"):
                            att_status = "fraud"
                        elif d.get("confirmed"):
                            att_status = "confirmed"
                        else:
                            att_status = "provisional"
                        faces_list.append({
                            "user_id": uid,
                            "name": name_map.get(uid, f"Student #{uid}"),
                            "confidence": round(float(d.get("confidence") or 0), 3),
                            "status": att_status,
                            "confirmed": bool(d.get("confirmed")),
                            "is_fraud": bool(d.get("is_fraud")),
                        })
                    else:
                        faces_list.append({
                            "user_id": None,
                            "name": "Unknown",
                            "status": "unknown",
                            "confidence": 0,
                            "confirmed": False,
                            "is_fraud": False,
                        })

                # ── 7. Serialise & broadcast ──────────────────────────────
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
                    },
                })
                await manager.broadcast_to_receivers(camera_id, payload)
                await manager.send_to_sender(camera_id, payload)

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"[CAM {camera_id}] AI loop error: {e}", exc_info=True)

        await asyncio.sleep(0.2)   # 5 fps analysis rate

    logger.info(f"[CAM {camera_id}] AI loop stopped")


@router.websocket("/stream/{camera_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    camera_id: str,
    client_type: str = "receiver",
    session_id: int | None = None,
):
    if client_type == "sender":
        await manager.connect_sender(websocket, camera_id)

        # Pin session so _ai_loop reads it from _session_map (no per-frame DB hit)
        if session_id is not None:
            _session_map[camera_id] = session_id
            logger.info(f"[CAM {camera_id}] Pinned session → {session_id}")

        # Initialise frame buffer and (re)start AI loop if needed
        _frame_buffer[camera_id] = b""
        if camera_id not in _ai_tasks or _ai_tasks[camera_id].done():
            _ai_tasks[camera_id] = asyncio.create_task(_ai_loop(camera_id))
            logger.info(f"[CAM {camera_id}] AI task created (session={session_id})")

        frames_relayed = 0
        try:
            while True:
                try:
                    message = await asyncio.wait_for(websocket.receive(), timeout=30.0)
                except asyncio.TimeoutError:
                    try:
                        await websocket.send_text("__ping__")
                    except Exception:
                        break
                    continue

                if "bytes" in message and message["bytes"]:
                    data = message["bytes"]
                    _frame_buffer[camera_id] = data
                    frames_relayed += 1
                    await manager.broadcast_to_receivers(camera_id, data)
                    if frames_relayed % 100 == 0:
                        logger.info(f"[CAM {camera_id}] Relayed {frames_relayed} frames")

                elif "text" in message:
                    txt = message.get("text", "")
                    if txt == "__pong__":
                        pass
                    elif txt == "close":
                        break

        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            manager.disconnect_sender(camera_id)
            if camera_id in _ai_tasks and not _ai_tasks[camera_id].done():
                _ai_tasks[camera_id].cancel()
            _frame_buffer.pop(camera_id, None)
            _session_map.pop(camera_id, None)
            logger.info(f"[CAM {camera_id}] Sender disconnected")

    else:
        # ── Receiver ──────────────────────────────────────────────────────
        await manager.connect_receiver(websocket, camera_id)
        try:
            while True:
                try:
                    message = await asyncio.wait_for(websocket.receive(), timeout=25.0)
                    if message.get("text") == "__pong__":
                        pass
                except asyncio.TimeoutError:
                    try:
                        await websocket.send_text("__ping__")
                    except Exception:
                        break
        except (WebSocketDisconnect, RuntimeError):
            pass
        finally:
            manager.disconnect_receiver(websocket, camera_id)
            logger.info(f"[CAM {camera_id}] Receiver disconnected")
