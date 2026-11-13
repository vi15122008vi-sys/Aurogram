from __future__ import annotations

from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.database import execute, fetchone
from app.deps import get_current_account

router = APIRouter(prefix="/settings", tags=["settings"])

DENSITY = Literal["compact", "comfortable", "spacious"]
CARD_STYLE = Literal["glass", "flat", "neo"]
REPLY_STYLE = Literal["strict", "friendly", "brief"]

DEFAULTS = {
    "density": "comfortable",
    "card_style": "glass",
    "ai_translate": False,
    "ai_reply_style": "brief",
    "energy_save": False,
}


class SettingsUpdate(BaseModel):
    density: Optional[DENSITY] = None
    card_style: Optional[CARD_STYLE] = None
    ai_translate: Optional[bool] = None
    ai_reply_style: Optional[REPLY_STYLE] = None
    energy_save: Optional[bool] = None


async def _load(account_id: str) -> dict[str, Any]:
    row = await fetchone(
        """SELECT density, card_style, ai_translate, ai_reply_style, energy_save
           FROM account_preferences WHERE account_id = ?""",
        (account_id,),
    )
    if not row:
        return dict(DEFAULTS)
    return {
        "density": row["density"] or DEFAULTS["density"],
        "card_style": row["card_style"] or DEFAULTS["card_style"],
        "ai_translate": bool(row["ai_translate"]),
        "ai_reply_style": row["ai_reply_style"] or DEFAULTS["ai_reply_style"],
        "energy_save": bool(row["energy_save"]),
    }


@router.get("")
async def get_settings(account: dict[str, Any] = Depends(get_current_account)) -> dict[str, Any]:
    return await _load(account["id"])


@router.patch("")
async def update_settings(
    payload: SettingsUpdate,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    current = await _load(account["id"])
    merged = {
        "density": payload.density or current["density"],
        "card_style": payload.card_style or current["card_style"],
        "ai_translate": current["ai_translate"] if payload.ai_translate is None else payload.ai_translate,
        "ai_reply_style": payload.ai_reply_style or current["ai_reply_style"],
        "energy_save": current["energy_save"] if payload.energy_save is None else payload.energy_save,
    }
    await execute(
        """
        INSERT INTO account_preferences (account_id, density, card_style, ai_translate, ai_reply_style, energy_save, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(account_id) DO UPDATE SET
            density = excluded.density,
            card_style = excluded.card_style,
            ai_translate = excluded.ai_translate,
            ai_reply_style = excluded.ai_reply_style,
            energy_save = excluded.energy_save,
            updated_at = datetime('now')
        """,
        (
            account["id"],
            merged["density"],
            merged["card_style"],
            1 if merged["ai_translate"] else 0,
            merged["ai_reply_style"],
            1 if merged["energy_save"] else 0,
        ),
    )
    return await _load(account["id"])
