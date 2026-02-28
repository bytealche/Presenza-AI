from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict
import asyncio
import cv2
import numpy as np
import json
import logging
from app.ai_engine.decision_engine import process_frame
from app.ai_engine.attendance_bridge import apply_ai_decisions
from app.models.session import Session as SessionModel
from sqlalchemy import select
from datetime import datetime
from app.database.database import SessionLocal
from app.core.websocket_manager import manager

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ws",
    tags=["Streaming"]
)

@router.websocket("/stream/{camera_id}")
async def websocket_endpoint(websocket: WebSocket, camera_id: str, client_type: str = "item"):
    # client_type: 'sender' (mobile) or 'receiver' (dashboard)
    # Default to receiver if not specified or 'item' (weird default but ok)
    
    if client_type == "sender":
        await manager.connect_sender(websocket, camera_id)
        try:
            frames = 0
            while True:
                message = await websocket.receive()
                if "bytes" in message:
                    data = message["bytes"]
                    # Relay data to all listening receivers (Video Feed)
                    await manager.broadcast_to_receivers(camera_id, data)
                    
                    # AI Processing (Downsample to avoid lag)
                    frames += 1
                    if frames % 10 == 0:
                        try:
                            # Convert bytes to numpy array for OpenCV
                            nparr = np.frombuffer(data, np.uint8)
                            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                            
                            if frame is not None:
                                # Run AI Analysis
                                async with SessionLocal() as db:
                                    decisions = await process_frame(db, frame)
                                    
                                    # Auto-mark attendance if camera has an active session
                                    now = datetime.utcnow()
                                    stmt = select(SessionModel).where(
                                        SessionModel.camera_id == int(camera_id),
                                        SessionModel.start_time <= now,
                                        SessionModel.end_time >= now
                                    )
                                    result = await db.execute(stmt)
                                    active_session = result.scalars().first()
                                    
                                    if active_session and decisions:
                                        await apply_ai_decisions(db, active_session.session_id, decisions)
                                
                                # Broadcast results if any faces found (or even empty to clear?)
                                if decisions:
                                    # Convert to JSON-serializable format if needed
                                    # The decisions are dicts, need to ensure types are json safe
                                    # datetime needs to be string
                                    safe_decisions = []
                                    for d in decisions:
                                        d_safe = d.copy()
                                        if 'timestamp' in d_safe:
                                            d_safe['timestamp'] = str(d_safe['timestamp'])
                                        # Remove huge fields if any (face_image is not in decision dict usually)
                                        safe_decisions.append(d_safe)
                                    
                                    result_msg = json.dumps({
                                        "type": "ai_analysis",
                                        "data": safe_decisions
                                    })
                                    await manager.broadcast_to_receivers(camera_id, result_msg)
                        except Exception as e:
                            logger.error(f"AI Processing Error: {e}")

                    if frames % 100 == 0:
                         logger.info(f"Cam {camera_id}: Relayed {frames} frames")
                
                elif "text" in message:
                     logger.info(f"Cam {camera_id} LOG: {message['text']}")
        except (WebSocketDisconnect, RuntimeError):
            manager.disconnect_sender(camera_id)
            logger.info(f"Sender disconnected for {camera_id}")
    else:
        # Receiver
        await manager.connect_receiver(websocket, camera_id)
        try:
            while True:
                # Receivers just listen, they don't send much
                # Just keep connection alive
                await websocket.receive_text() 
        except (WebSocketDisconnect, RuntimeError):
            manager.disconnect_receiver(websocket, camera_id)
            logger.info(f"Receiver disconnected for {camera_id}")
