from fastapi import WebSocket
from typing import List, Dict
import logging

logger = logging.getLogger(__name__)

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
        # Disconnect existing sender for this camera if any
        if camera_id in self.senders:
            try:
                await self.senders[camera_id].close()
                logger.info(f"Closed existing sender for {camera_id}")
            except Exception as e:
                logger.warning(f"Could not cleanly close sender for {camera_id}: {e}")
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

    async def broadcast_to_receivers(self, camera_id: str, data):
        """Send video frames or JSON data to all receivers watching this camera_id"""
        if camera_id in self.receivers:
            dead_connections = []
            for connection in self.receivers[camera_id]:
                try:
                    if isinstance(data, str):
                        await connection.send_text(data)
                    else:
                        await connection.send_bytes(data)
                except Exception as e:
                    logger.error(f"Error sending frame to receiver {camera_id}: {e}")
                    dead_connections.append(connection)
            
            # Clean up dead connections
            for dead in dead_connections:
                self.disconnect_receiver(dead, camera_id)

manager = ConnectionManager()
