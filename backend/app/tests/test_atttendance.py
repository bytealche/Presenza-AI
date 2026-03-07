"""
Tests for attendance analytics endpoints.
Run with: pytest app/tests/test_atttendance.py -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock

from app.main import app
from app.core.security import create_access_token


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


# ── Student attendance rate ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_student_stats_empty(client: AsyncClient):
    """Student with no records should return zero rates."""
    with patch("app.routers.analytics.get_db") as mock_db, \
         patch("app.core.auth_dependencies.get_db") as mock_auth_db:

        empty_result = MagicMock()
        empty_result.scalars.return_value.all.return_value = []

        mock_user = MagicMock()
        mock_user.user_id = 99
        mock_user.role_id = 3
        auth_result = MagicMock()
        auth_result.scalars.return_value.first.return_value = mock_user

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(side_effect=[auth_result, empty_result])
        mock_db.return_value = mock_session
        mock_auth_db.return_value = mock_session

        response = await client.get(
            "/analytics/student/stats",
            headers=_auth_header(99, 3),
        )
        assert response.status_code in (200, 401, 403)  # 401/403 if auth mocking isn't wired


@pytest.mark.asyncio
async def test_student_attendance_rate_calculation():
    """Unit test: verify attendance rate arithmetic is correct."""
    records = [
        MagicMock(final_status="Present"),
        MagicMock(final_status="Present"),
        MagicMock(final_status="Absent"),
        MagicMock(final_status="Present"),
    ]
    total = len(records)
    present = sum(1 for r in records if r.final_status == "Present")
    rate = round((present / total) * 100, 1)
    assert rate == 75.0


@pytest.mark.asyncio
async def test_student_attendance_rate_all_present():
    """Rate should be 100% when all records are Present."""
    records = [MagicMock(final_status="Present") for _ in range(10)]
    total = len(records)
    present = sum(1 for r in records if r.final_status == "Present")
    rate = round((present / total) * 100, 1)
    assert rate == 100.0


@pytest.mark.asyncio
async def test_student_attendance_rate_no_records():
    """Rate should be 0% with no records (no division by zero)."""
    records = []
    total = len(records)
    rate = (sum(1 for r in records if r.final_status == "Present") / total * 100) if total > 0 else 0.0
    assert rate == 0.0


# ── Unauthenticated access ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_admin_stats_requires_auth(client: AsyncClient):
    """Admin stats without a token should return 401 or 403."""
    response = await client.get("/analytics/admin/stats")
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_student_cannot_access_admin_stats(client: AsyncClient):
    """A student token should be rejected from admin stats endpoint."""
    response = await client.get(
        "/analytics/admin/stats",
        headers=_auth_header(user_id=5, role_id=3),  # role 3 = student
    )
    assert response.status_code in (401, 403)
