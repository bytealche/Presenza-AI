"""
Tests for online class notification endpoint.
Run with: pytest app/tests/test_notifications.py -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock

from app.main import app
from app.core.security import create_access_token
from app.database.dependencies import get_db

def _auth_header(user_id: int, role_id: int, org_id: int = 1) -> dict:
    token = create_access_token(
        {"user_id": user_id, "role_id": role_id, "org_id": org_id, "email": f"u{user_id}@test.com", "full_name": "Test"}
    )
    return {"Authorization": f"Bearer {token}"}

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

@pytest.mark.asyncio
async def test_notify_requires_teacher_or_admin(client: AsyncClient):
    """Students should be rejected with 403 Forbidden."""
    mock_student = MagicMock()
    mock_student.user_id = 5
    mock_student.role_id = 3 # Student
    mock_student.email = "u5@test.com"

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_student

    mock_db_session = AsyncMock()
    mock_db_session.execute = AsyncMock(return_value=mock_user_result)

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.post(
            "/sessions/1/notify",
            headers=_auth_header(user_id=5, role_id=3),
            json={"subject": "Announcement", "message": "Hello class"}
        )
        assert response.status_code == 403
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db

@pytest.mark.asyncio
async def test_notify_offline_class_rejected(client: AsyncClient):
    """Sending notification to an offline class should be rejected with 400 Bad Request."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 2
    mock_teacher.role_id = 2 # Teacher
    mock_teacher.email = "u2@test.com"

    mock_session_model = MagicMock()
    mock_session_model.session_id = 1
    mock_session_model.class_type = "offline"
    mock_session_model.session_name = "Math 101"

    # User lookup result
    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Session lookup result
    mock_session_result = MagicMock()
    mock_session_result.scalars.return_value.first.return_value = mock_session_model

    mock_db_session = AsyncMock()
    mock_db_session.execute = AsyncMock(side_effect=[mock_user_result, mock_session_result])

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.post(
            "/sessions/1/notify",
            headers=_auth_header(user_id=2, role_id=2),
            json={"subject": "Offline Class Update", "message": "Do not join online"}
        )
        assert response.status_code == 400
        assert "only be sent for online classes" in response.json()["detail"]
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db

@pytest.mark.asyncio
async def test_notify_online_class_success(client: AsyncClient):
    """Sending notification to an online class queues emails and returns 200."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 2
    mock_teacher.role_id = 2 # Teacher
    mock_teacher.email = "u2@test.com"
    mock_teacher.full_name = "Instructor Bob"

    mock_session_model = MagicMock()
    mock_session_model.session_id = 1
    mock_session_model.class_type = "online"
    mock_session_model.session_name = "AI 101"

    mock_student = MagicMock()
    mock_student.user_id = 10
    mock_student.email = "student@test.com"
    mock_student.full_name = "Jane Doe"

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    mock_session_result = MagicMock()
    mock_session_result.scalars.return_value.first.return_value = mock_session_model

    mock_students_result = MagicMock()
    mock_students_result.scalars.return_value.all.return_value = [mock_student]

    mock_db_session = AsyncMock()
    mock_db_session.execute = AsyncMock(side_effect=[
        mock_user_result,      # 1. get_current_user
        mock_session_result,   # 2. session lookup
        mock_students_result   # 3. enrolled students lookup
    ])

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        with patch("app.routers.sessions.send_email_sync") as mock_send_email:
            response = await client.post(
                "/sessions/1/notify",
                headers=_auth_header(user_id=2, role_id=2),
                json={"subject": "Online Class Update", "message": "Class starts in 10 minutes!"}
            )
            assert response.status_code == 200
            assert "Notifications queued successfully" in response.json()["message"]
            
            assert mock_send_email.call_count == 1
            args, kwargs = mock_send_email.call_args
            assert args[0] == "student@test.com"
            assert "[AI 101] Online Class Update" in args[1]
            assert "Class starts in 10 minutes!" in args[2]
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db
