from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import cv2
import numpy as np
import json
import logging
from datetime import datetime
from app.core.websocket_manager import manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["Streaming"])

# ── AI processing runs in background so it never blocks frame relay ──────────
_ai_tasks: dict[str, asyncio.Task] = {}
_frame_buffer: dict[str, bytes] = {}  # latest frame per camera

async def _ai_loop(camera_id: str):
    """
    Continuously processes the latest frame for AI analysis.
    Runs as a background task so it never blocks frame relay.
    """
    from app.ai_engine.decision_engine import process_frame
    from app.ai_engine.attendance_bridge import apply_ai_decisions
    from app.models.session import Session as SessionModel
    from sqlalchemy import select
    from app.database.database import SessionLocal

    while camera_id in _frame_buffer:
        frame_bytes = _frame_buffer.get(camera_id)
        if not frame_bytes:
            await asyncio.sleep(0.5)
            continue

        try:
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                await asyncio.sleep(0.5)
                continue

            async with SessionLocal() as db:
                decisions = await process_frame(db, frame)

                if decisions:
                    # Mark attendance for active session
                    now = datetime.utcnow()
                    stmt = select(SessionModel).where(
                        SessionModel.camera_id == int(camera_id),
                        SessionModel.start_time <= now,
                        SessionModel.end_time >= now
                    )
                    result = await db.execute(stmt)
                    active_session = result.scalars().first()
                    if active_session:
                        await apply_ai_decisions(db, active_session.session_id, decisions)

                # Broadcast AI results to receivers
                safe_decisions = []
                for d in decisions:
                    d_safe = d.copy()
                    if isinstance(d_safe.get("timestamp"), datetime):
                        d_safe["timestamp"] = d_safe["timestamp"].isoformat()
                    # bbox must be list for JSON
                    if isinstance(d_safe.get("bbox"), tuple):
                        d_safe["bbox"] = list(d_safe["bbox"])
                    safe_decisions.append(d_safe)

                await manager.broadcast_to_receivers(
                    camera_id,
                    json.dumps({"type": "ai_analysis", "data": safe_decisions})
                )

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"AI loop error for cam {camera_id}: {e}")

        # Process a frame every 2 seconds (fast enough, won't overload CPU)
        await asyncio.sleep(2.0)

    logger.info(f"AI loop stopped for camera {camera_id}")


@router.websocket("/stream/{camera_id}")
async def websocket_endpoint(websocket: WebSocket, camera_id: str, client_type: str = "receiver"):

    if client_type == "sender":
        await manager.connect_sender(websocket, camera_id)

        # Initialize frame buffer and start AI loop
        _frame_buffer[camera_id] = b""
        if camera_id not in _ai_tasks or _ai_tasks[camera_id].done():
            _ai_tasks[camera_id] = asyncio.create_task(_ai_loop(camera_id))
            logger.info(f"Started AI loop for camera {camera_id}")

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
            # Stop AI loop
            if camera_id in _ai_tasks and not _ai_tasks[camera_id].done():
                _ai_tasks[camera_id].cancel()
            _frame_buffer.pop(camera_id, None)
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
