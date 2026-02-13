import asyncio
import websockets
import cv2
import numpy as np
import json
import time

async def mock_sender(camera_id):
    uri = f"ws://127.0.0.1:8000/ws/stream/{camera_id}?client_type=sender"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Sending frames...")
            
            # Create a dummy image (random noise or simple pattern)
            width, height = 640, 480
            frame_count = 0
            
            while True:
                # Create a frame with moving bar to simulate video
                img = np.zeros((height, width, 3), dtype=np.uint8)
                x_pos = (frame_count * 10) % width
                cv2.rectangle(img, (x_pos, 0), (x_pos+50, height), (0, 255, 0), -1)
                
                # Add text
                cv2.putText(img, f"Frame: {frame_count}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                
                # Encode as JPEG
                _, buffer = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 50])
                bytes_data = buffer.tobytes()
                
                # Send
                await websocket.send(bytes_data)
                
                # Listen for any responses (server logs)
                try:
                    msg = await asyncio.wait_for(websocket.recv(), timeout=0.01)
                    print(f"Received: {msg}")
                except asyncio.TimeoutError:
                    pass
                except Exception as e:
                    print(f"Receive error: {e}")
                
                frame_count += 1
                if frame_count % 30 == 0:
                    print(f"Sent {frame_count} frames")
                
                # 30 FPS
                await asyncio.sleep(1/30)
                
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    try:
        asyncio.run(mock_sender("test_cam"))
    except KeyboardInterrupt:
        print("Stopped.")
