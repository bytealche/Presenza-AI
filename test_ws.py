import asyncio
import websockets

async def test_ws():
    uri = "wss://bytealche1-presenza-bacekend.hf.space/ws/stream/1?client_type=receiver"
    try:
        print(f"Connecting to {uri}")
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            await websocket.close()
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
