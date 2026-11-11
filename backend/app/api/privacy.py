from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import execute, fetchone
from app.deps import get_current_account
from app.telegram.privacy import set_online_visibility
from app.telegram.client import drop_client

router = APIRouter(prefix="/privacy", tags=["privacy"])


class PrivacyUpdate(BaseModel):
    hide_online: bool | None = None
    no_read_receipts: bool | None = None
    hide_device_type: bool | None = None


def _serialize(row: Any) -> dict[str, bool]:
    return {
        "hide_online": bool(row["hide_online"]),
        "no_read_receipts": bool(row["no_read_receipts"]),
        "hide_device_type": bool(row["hide_device_type"]),
    }


async def _load(account_id: str) -> dict[str, bool]:
    row = await fetchone("SELECT * FROM account_preferences WHERE account_id = ?", (account_id,))
    return _serialize(row) if row else {"hide_online": False, "no_read_receipts": True, "hide_device_type": False}


@router.get("")
async def get_privacy(account: dict[str, Any] = Depends(get_current_account)) -> dict[str, bool]:
    return await _load(account["id"])


@router.put("")
async def update_privacy(
    payload: PrivacyUpdate,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, bool]:
    current = await _load(account["id"])
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)
    updated = {**current, **updates}
    if updated["hide_online"] != current["hide_online"]:
        try:
            await set_online_visibility(account, updated["hide_online"])
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Не удалось обновить видимость статуса в Telegram") from exc
    await execute(
        """INSERT INTO account_preferences (account_id, hide_online, no_read_receipts, hide_device_type)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(account_id) DO UPDATE SET hide_online=excluded.hide_online,
             no_read_receipts=excluded.no_read_receipts, hide_device_type=excluded.hide_device_type,
             updated_at=datetime('now')""",
        (account["id"], int(updated["hide_online"]), int(updated["no_read_receipts"]), int(updated["hide_device_type"])),
    )
    if updated["hide_device_type"] != current["hide_device_type"]:
        await drop_client(account["id"])
    return updated
