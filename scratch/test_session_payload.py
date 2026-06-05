import asyncio
import os
import sys
from httpx import AsyncClient, ASGITransport

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.main import app
from app.core.security import create_access_token
from app.database.dependencies import get_db
from unittest.mock import AsyncMock, MagicMock, patch

def _auth_header(user_id: int, role_id: int, org_id: int = 1) -> dict:
    token = create_access_token(
        {"user_id": user_id, "role_id": role_id, "org_id": org_id, "email": "teacher@test.com", "full_name": "Instructor Bob"}
    )
    return {"Authorization": f"Bearer {token}"}

async def run_test():
    # Mock user returned by db.execute in get_current_user
    mock_teacher = MagicMock()
    mock_teacher.user_id = 2
    mock_teacher.role_id = 2
    mock_teacher.org_id = 1
    mock_teacher.email = "teacher@test.com"
    mock_teacher.full_name = "Instructor Bob"

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Mock DB execution inside create_session:
    # 1. get_current_user lookup
    # 2. enrolled students SELECT fetchall()
    mock_students_result = MagicMock()
    mock_students_result.fetchall.return_value = [] # no students enrolled

    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(side_effect=[mock_user_result, mock_students_result])
    mock_db.flush = AsyncMock()
    mock_db.commit = AsyncMock()
    mock_db.refresh = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    payload = {
        "session_name": "CS101 - Intro to CS",
        "start_time": "2026-06-05T10:00:00.000Z",
        "end_time": "2026-06-05T12:00:00.000Z",
        "location": "",
        "class_type": "online"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/sessions",
            headers=_auth_header(user_id=2, role_id=2),
            json=payload
        )
        print("Status code:", resp.status_code)
        print("Response JSON:", resp.json())

if __name__ == "__main__":
    asyncio.run(run_test())
