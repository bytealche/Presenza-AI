import sys
sys.path.append("c:\\Users\\Aniket\\Downloads\\Presenza-AI\\backend")

from app.schemas.session_schema import SessionCreate
import json

payload = {
    "session_name": "CS101 - Intro to AI",
    "start_time": "2026-05-30T19:49",
    "end_time": "2026-05-30T20:49",
    "location": "Room 304",
    "camera_id": None,
    "class_type": "online"
}

try:
    obj = SessionCreate(**payload)
    print("SUCCESSFULLY VALIDATED!")
    print("Parsed object:", obj)
    print("start_time type:", type(obj.start_time), "value:", obj.start_time)
except Exception as e:
    print("FAILED TO VALIDATE:", e)
