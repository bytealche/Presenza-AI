import asyncio
import websockets
import cv2
import os

WS_URL = "ws://localhost:8000/ws/stream/999?client_type=sender"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
image_path = os.path.join(BASE_DIR, "app/ai_engine/test_face.jpg")

async def send_frames():
    frame = cv2.imread(image_path)
    if frame is None:
        print(f"Failed to load image at {image_path}")
        return

    # Encode frame to JPEG
    _, buffer = cv2.imencode('.jpg', frame)
    frame_bytes = buffer.tobytes()

    try:
        async with websockets.connect(WS_URL) as websocket:
            print("Connected to WebSocket Server!")
            
            # Send 25 frames quickly
            for i in range(25):
                print(f"Sending frame {i+1}...")
                await websocket.send(frame_bytes)
                await asyncio.sleep(0.1)
                
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(send_frames())
