# pyrefly: ignore [missing-import]
import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.system_log_service import create_system_log
from app.models.system_log import SystemLog

@pytest.mark.asyncio
async def test_create_system_log_success():
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()

    log = await create_system_log(
        db=db,
        action="test_action",
        user_id=1,
        ip_address="127.0.0.1",
        commit=True
    )

    assert log is not None
    assert log.action == "test_action"
    assert log.user_id == 1
    assert log.ip_address == "127.0.0.1"
    
    db.add.assert_called_once()
    db.commit.assert_called_once()

@pytest.mark.asyncio
async def test_create_system_log_no_commit():
    db = AsyncMock()
    db.add = MagicMock()
    db.commit = AsyncMock()

    log = await create_system_log(
        db=db,
        action="no_commit_action",
        user_id=2,
        ip_address="192.168.1.1",
        commit=False
    )

    assert log is not None
    assert log.action == "no_commit_action"
    assert log.user_id == 2
    assert log.ip_address == "192.168.1.1"
    
    db.add.assert_called_once()
    db.commit.assert_not_called()

@pytest.mark.asyncio
async def test_create_system_log_exception():
    db = AsyncMock()
    db.add = MagicMock(side_effect=Exception("DB Error"))
    db.rollback = AsyncMock()

    log = await create_system_log(
        db=db,
        action="fail_action",
        commit=True
    )

    assert log is None
    db.rollback.assert_called_once()
