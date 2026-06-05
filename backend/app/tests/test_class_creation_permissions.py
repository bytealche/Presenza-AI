"""
Tests for subject requester authorization during class (session) creation and updates.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime

from app.main import app
from app.core.security import create_access_token
from app.database.dependencies import get_db
from app.tests.conftest import _make_mock_db
from app.models.session import Session as SessionModel

def _auth_header(user_id: int, role_id: int, org_id: int = 1) -> dict:
    token = create_access_token(
        {"user_id": user_id, "role_id": role_id, "org_id": org_id, "email": f"u{user_id}@test.com", "full_name": f"Teacher {user_id}"}
    )
    return {"Authorization": f"Bearer {token}"}

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

@pytest.mark.asyncio
async def test_create_session_success_as_requester(client: AsyncClient):
    """Should succeed if the user is the one who requested the approved subject."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 2
    mock_teacher.role_id = 2  # Teacher
    mock_teacher.org_id = 1
    mock_teacher.email = "teacher2@test.com"
    mock_teacher.full_name = "Instructor Bob"

    # User lookup for get_current_user
    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Subject request check (org_id, subject_name) -> returns one approved request by user 2
    mock_subject_row = MagicMock()
    mock_subject_row.teacher_id = 2
    mock_subject_row.status = "approved"
    
    mock_subject_result = MagicMock()
    mock_subject_result.fetchall.return_value = [mock_subject_row]

    # Auto enroll result (empty students)
    mock_enroll_result = MagicMock()
    mock_enroll_result.fetchall.return_value = []

    mock_db_session = _make_mock_db(side_effects=[mock_user_result, mock_subject_result, mock_enroll_result])
    mock_db_session.refresh = AsyncMock()

    # Assign ID on add
    def mock_add(obj):
        if hasattr(obj, 'session_id'):
            obj.session_id = 1

    mock_db_session.add.side_effect = mock_add

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.post(
            "/sessions",
            headers=_auth_header(user_id=2, role_id=2),
            json={
                "session_name": "CS101",
                "start_time": "2026-06-05T09:00:00",
                "end_time": "2026-06-05T10:30:00",
                "location": "Room 302",
                "class_type": "offline"
            }
        )
        assert response.status_code == 200
        assert response.json()["session_name"] == "CS101"
        assert response.json()["session_id"] == 1
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db


@pytest.mark.asyncio
async def test_create_session_fails_not_found(client: AsyncClient):
    """Should return 400 Bad Request if the subject request does not exist in the database."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 2
    mock_teacher.role_id = 2
    mock_teacher.org_id = 1

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    mock_subject_result = MagicMock()
    mock_subject_result.fetchall.return_value = []  # No requests found

    mock_db_session = _make_mock_db(side_effects=[mock_user_result, mock_subject_result])

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.post(
            "/sessions",
            headers=_auth_header(user_id=2, role_id=2),
            json={
                "session_name": "CS101",
                "start_time": "2026-06-05T09:00:00",
                "end_time": "2026-06-05T10:30:00"
            }
        )
        assert response.status_code == 400
        assert "not approved or does not exist" in response.json()["detail"]
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db


@pytest.mark.asyncio
async def test_create_session_fails_not_approved(client: AsyncClient):
    """Should return 400 Bad Request if the subject request exists but is pending."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 2
    mock_teacher.role_id = 2
    mock_teacher.org_id = 1

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Request is pending
    mock_subject_row = MagicMock()
    mock_subject_row.teacher_id = 2
    mock_subject_row.status = "pending"

    mock_subject_result = MagicMock()
    mock_subject_result.fetchall.return_value = [mock_subject_row]

    mock_db_session = _make_mock_db(side_effects=[mock_user_result, mock_subject_result])

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.post(
            "/sessions",
            headers=_auth_header(user_id=2, role_id=2),
            json={
                "session_name": "CS101",
                "start_time": "2026-06-05T09:00:00",
                "end_time": "2026-06-05T10:30:00"
            }
        )
        assert response.status_code == 400
        assert "not approved or does not exist" in response.json()["detail"]
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db


@pytest.mark.asyncio
async def test_create_session_fails_wrong_requester(client: AsyncClient):
    """Should return 403 Forbidden if the subject was approved but requested by another teacher."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 3  # Current user is teacher 3
    mock_teacher.role_id = 2
    mock_teacher.org_id = 1

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Approved request belongs to teacher 2
    mock_subject_row = MagicMock()
    mock_subject_row.teacher_id = 2
    mock_subject_row.status = "approved"

    mock_subject_result = MagicMock()
    mock_subject_result.fetchall.return_value = [mock_subject_row]

    mock_db_session = _make_mock_db(side_effects=[mock_user_result, mock_subject_result])

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.post(
            "/sessions",
            headers=_auth_header(user_id=3, role_id=2),
            json={
                "session_name": "CS101",
                "start_time": "2026-06-05T09:00:00",
                "end_time": "2026-06-05T10:30:00"
            }
        )
        assert response.status_code == 403
        assert "Only the user who requested the subject" in response.json()["detail"]
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db


@pytest.mark.asyncio
async def test_update_session_rename_success(client: AsyncClient):
    """Should succeed if the user renames the session to an approved subject they requested."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 2
    mock_teacher.role_id = 2
    mock_teacher.org_id = 1

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Existing session details (using real SessionModel)
    mock_session = SessionModel(
        session_id=1,
        session_name="CS101",
        created_by=2,
        org_id=1,
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow(),
        class_type="online",
        is_approved=True
    )

    mock_session_result = MagicMock()
    mock_session_result.scalars.return_value.first.return_value = mock_session

    # Approved subject request for new name "CS102"
    mock_subject_row = MagicMock()
    mock_subject_row.teacher_id = 2
    mock_subject_row.status = "approved"

    mock_subject_result = MagicMock()
    mock_subject_result.fetchall.return_value = [mock_subject_row]

    mock_db_session = _make_mock_db(side_effects=[
        mock_user_result,      # 1. get_current_user
        mock_session_result,   # 2. session lookup in update_session
        mock_subject_result    # 3. subject request validation in update_session
    ])
    mock_db_session.refresh = AsyncMock()

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.patch(
            "/sessions/1",
            headers=_auth_header(user_id=2, role_id=2),
            json={"session_name": "CS102"}
        )
        assert response.status_code == 200
        assert mock_session.session_name == "CS102"
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db


@pytest.mark.asyncio
async def test_update_session_rename_fails_wrong_requester(client: AsyncClient):
    """Should return 403 Forbidden if renaming to an approved subject requested by someone else."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 3  # Current user is teacher 3
    mock_teacher.role_id = 2
    mock_teacher.org_id = 1

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Existing session details (using real SessionModel)
    mock_session = SessionModel(
        session_id=1,
        session_name="CS101",
        created_by=3,
        org_id=1,
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow(),
        class_type="online",
        is_approved=True
    )

    mock_session_result = MagicMock()
    mock_session_result.scalars.return_value.first.return_value = mock_session

    # Approved subject request for "CS102" belongs to teacher 2
    mock_subject_row = MagicMock()
    mock_subject_row.teacher_id = 2
    mock_subject_row.status = "approved"

    mock_subject_result = MagicMock()
    mock_subject_result.fetchall.return_value = [mock_subject_row]

    mock_db_session = _make_mock_db(side_effects=[
        mock_user_result,
        mock_session_result,
        mock_subject_result
    ])

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.patch(
            "/sessions/1",
            headers=_auth_header(user_id=3, role_id=2),
            json={"session_name": "CS102"}
        )
        assert response.status_code == 403
        assert "Only the user who requested the subject" in response.json()["detail"]
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db


@pytest.mark.asyncio
async def test_update_session_no_rename_bypass(client: AsyncClient):
    """Should succeed if other fields are updated without changing the session_name, even without requester check."""
    mock_teacher = MagicMock()
    mock_teacher.user_id = 3
    mock_teacher.role_id = 2
    mock_teacher.org_id = 1

    mock_user_result = MagicMock()
    mock_user_result.scalars.return_value.first.return_value = mock_teacher

    # Existing session details (using real SessionModel)
    mock_session = SessionModel(
        session_id=1,
        session_name="CS101",
        created_by=3,
        org_id=1,
        location="Old Room",
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow(),
        class_type="online",
        is_approved=True
    )

    mock_session_result = MagicMock()
    mock_session_result.scalars.return_value.first.return_value = mock_session

    mock_db_session = _make_mock_db(side_effects=[
        mock_user_result,
        mock_session_result
    ])
    mock_db_session.refresh = AsyncMock()

    async def override_db():
        yield mock_db_session

    app.dependency_overrides[get_db] = override_db
    try:
        response = await client.patch(
            "/sessions/1",
            headers=_auth_header(user_id=3, role_id=2),
            json={"location": "New Room"}
        )
        assert response.status_code == 200
        assert mock_session.location == "New Room"
        assert mock_session.session_name == "CS101"  # unchanged
    finally:
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db
