from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict
import asyncio
import cv2
import numpy as np
import json
import logging
from app.ai_engine.decision_engine import process_frame

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/ws",
    tags=["Streaming"]
)

class ConnectionManager:
    def __init__(self):
        # camera_id -> List of receiver WebSockets
        self.receivers: Dict[str, List[WebSocket]] = {}
        # camera_id -> sender WebSocket (only one sender per cam allowed)
        self.senders: Dict[str, WebSocket] = {}

    async def connect_receiver(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        if camera_id not in self.receivers:
            self.receivers[camera_id] = []
        self.receivers[camera_id].append(websocket)
        logger.info(f"Receiver connected: {camera_id}")

    async def connect_sender(self, websocket: WebSocket, camera_id: str):
        await websocket.accept()
        # If there's already a sender, maybe close previous?
        # For now, just overwrite
        if camera_id in self.senders:
             try:
                 await self.senders[camera_id].close()
                 logger.info(f"Closed existing sender for {camera_id}")
             except:
                 pass
        self.senders[camera_id] = websocket
        logger.info(f"Sender connected: {camera_id}")

    def disconnect_receiver(self, websocket: WebSocket, camera_id: str):
        if camera_id in self.receivers:
            if websocket in self.receivers[camera_id]:
                self.receivers[camera_id].remove(websocket)
                logger.info(f"Receiver disconnected: {camera_id}")

    def disconnect_sender(self, camera_id: str):
        if camera_id in self.senders:
            del self.senders[camera_id]
            logger.info(f"Sender disconnected: {camera_id}")

    async def broadcast_to_receivers(self, camera_id: str, data: bytes):
        if camera_id in self.receivers:
            # Broadcast to all connected receivers for this camera
            for connection in self.receivers[camera_id]:
                try:
                    await connection.send_bytes(data)
                except Exception as e:
                    # If send fails, remove connection?
                    # For now just log error
                    logger.error(f"Error sending frame to receiver {camera_id}: {e}")

manager = ConnectionManager()

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
                                decisions = process_frame(frame)
                                
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
        except WebSocketDisconnect:
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
        except WebSocketDisconnect:
            manager.disconnect_receiver(websocket, camera_id)
            logger.info(f"Receiver disconnected for {camera_id}")
