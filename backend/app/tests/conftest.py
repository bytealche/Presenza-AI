"""
conftest.py — shared pytest fixtures for all tests.

Overrides the `get_db` dependency so tests never connect to the real database.
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock
from fastapi import FastAPI

from app.main import app
from app.database.dependencies import get_db


def _make_mock_db(side_effects=None):
    """Return an async-context-manager mock that yields a fake AsyncSession."""
    mock_session = AsyncMock()

    # Default: execute returns an empty scalars().all() / first()
    default_result = MagicMock()
    default_result.scalars.return_value.all.return_value = []
    default_result.scalars.return_value.first.return_value = None
    default_result.fetchall.return_value = []
    default_result.fetchone.return_value = None
    default_result.scalar.return_value = None

    if side_effects:
        mock_session.execute = AsyncMock(side_effect=side_effects)
    else:
        mock_session.execute = AsyncMock(return_value=default_result)

    mock_session.scalar = AsyncMock(return_value=0)
    mock_session.add = MagicMock()
    mock_session.flush = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.delete = AsyncMock()
    mock_session.rollback = AsyncMock()
    return mock_session


async def _override_get_db():
    """Dependency override: yield a mock DB session instead of a real one."""
    yield _make_mock_db()


@pytest.fixture(autouse=True)
def override_db():
    """Automatically override the DB for every test in the suite."""
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()
