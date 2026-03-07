"""
Tests for authentication endpoints.
Run with: pytest app/tests/test_auth.py -v
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timezone, timedelta

from app.main import app


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


# ── /auth/send-otp ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_send_otp_success(client: AsyncClient):
    """OTP endpoint should return 200 with a message."""
    with patch("app.routers.auth.send_email_sync") as mock_email, \
         patch("app.database.dependencies.get_db") as mock_db:

        mock_session = AsyncMock()
        mock_session.execute = AsyncMock(return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(first=MagicMock(return_value=None)))))
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_db.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_db.return_value.__aexit__ = AsyncMock(return_value=False)

        response = await client.post("/auth/send-otp", json={"email": "test@example.com"})
        assert response.status_code == 200
        assert "OTP sent" in response.json()["message"]


# ── /auth/login ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    """Login with non-existent email should return 401."""
    with patch("app.routers.auth.get_db") as mock_db:
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.first.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)
        mock_db.return_value = mock_session

        response = await client.post(
            "/auth/login", json={"email": "nobody@example.com", "password": "wrong"}
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid credentials"


@pytest.mark.asyncio
async def test_login_inactive_account(client: AsyncClient):
    """Login with a pending/suspended account should return 403."""
    from app.main import app
    from app.database.dependencies import get_db

    mock_user = MagicMock()
    mock_user.status = "pending"
    mock_user.password_hash = "hashed"

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = mock_user

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    async def override_with_pending_user():
        yield mock_session

    app.dependency_overrides[get_db] = override_with_pending_user
    try:
        response = await client.post(
            "/auth/login", json={"email": "pending@example.com", "password": "pass"}
        )
        assert response.status_code == 403
    finally:
        # Restore the conftest default override
        from app.tests.conftest import _override_get_db
        app.dependency_overrides[get_db] = _override_get_db


# ── /auth/refresh ─────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_refresh_rejects_access_token(client: AsyncClient):
    """Passing an access token (not a refresh token) to /refresh should return 401."""
    from app.core.security import create_access_token
    access = create_access_token({"user_id": 1, "email": "a@b.com"})

    response = await client.post("/auth/refresh", json={"refresh_token": access})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh_rejects_expired_token(client: AsyncClient):
    """An expired refresh token should return 401."""
    from app.core.security import create_refresh_token
    from jose import jwt
    from app.core.config import settings

    # Manually create a token that is already expired
    payload = {
        "user_id": 1,
        "email": "a@b.com",
        "type": "refresh",
        "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
    }
    expired_token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    response = await client.post("/auth/refresh", json={"refresh_token": expired_token})
    assert response.status_code == 401


# ── /health ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_liveness(client: AsyncClient):
    """Health liveness probe must always return 200."""
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
