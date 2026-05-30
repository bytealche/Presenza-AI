"""
Tests for subject request endpoints in sessions router.
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
        {"user_id": user_id, "role_id": role_id, "org_id": org_id, "email": f"u{user_id}@test.com", "full_name": f"User {user_id}"}
    )
    return {"Authorization": f"Bearer {token}"}

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

@pytest.mark.asyncio
async def test_request_subject_success(client: AsyncClient):
    """Teachers should be able to submit a subject request."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 2
    mock_teacher.role_id = 2 # Teacher
    mock_teacher.org_id = 1
    mock_teacher.email = "teacher@test.com"
    mock_teacher.full_name = "Instructor Bob"

    mock_admin = MagicMock()
    mock_admin.user_id = 1
    mock_admin.role_id = 1 # Admin
    mock_admin.org_id = 1
    mock_admin.email = "admin@test.com"
    mock_admin.full_name = "Admin Alice"

    # User lookup for get_current_user
    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Admin lookup inside request_subject
    mock_admin_result = MagicMock()
    mock_admin_result.scalars.return_value.first.return_value = mock_admin

    # Insert execution result
    mock_insert_result = MagicMock()

    mock_db_session = AsyncMock()
    mock_db_session.execute = AsyncMock(side_effect=[mock_user_result, mock_admin_result, mock_insert_result])

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        with patch("app.routers.sessions.send_email_sync") as mock_send_email:
            response = await client.post(
                "/sessions/request-subject",
                headers=_auth_header(user_id=2, role_id=2),
                json={"subject_name": "CS101 - Intro to CS", "description": "Introductory computer science course"}
            )
            assert response.status_code == 200
            assert "submitted successfully" in response.json()["message"]
            
            # Assert execute was called 3 times
            assert mock_db_session.execute.call_count == 3
            
            # Assert email sent to admin
            assert mock_send_email.call_count == 1
            args, kwargs = mock_send_email.call_args
            assert args[0] == "admin@test.com"
            assert "CS101" in args[1]
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db
