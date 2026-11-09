from __future__ import annotations

import json
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response

from app.database import execute, fetchall, fetchone
from app.deps import get_current_account
from app.models import ThemeCustom
from app.themes.builtin import BUILTIN_THEMES
from app.themes.custom import build_custom

router = APIRouter(prefix="/themes", tags=["themes"])
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
COLOR_TOKEN = re.compile(r"^(#[0-9a-fA-F]{6}|rgba?\([0-9.,% ]+\))$")


@router.get("")
async def themes(account: dict[str, Any] = Depends(get_current_account)) -> dict[str, list[dict[str, Any]]]:
    rows = await fetchall(
        "SELECT id, name, tokens_json FROM custom_themes WHERE account_id IS NULL OR account_id = ? ORDER BY id DESC",
        (account["id"],),
    )
    custom: list[dict[str, Any]] = []
    for row in rows:
        try:
            theme = json.loads(row["tokens_json"])
        except (TypeError, json.JSONDecodeError):
            continue
        theme["id"] = f"custom:{row['id']}"
        custom.append(theme)
    return {"builtin": BUILTIN_THEMES, "custom": custom}


@router.post("/custom", status_code=201)
async def create_theme(
    payload: ThemeCustom,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    name = payload.name.strip()
    if not name or len(name) > 40:
        raise HTTPException(status_code=422, detail="Название темы должно быть от 1 до 40 символов")
    if not HEX_COLOR.fullmatch(payload.accent):
        raise HTTPException(status_code=422, detail="Цвет акцента должен иметь формат #RRGGBB")
    theme = build_custom(name, payload.accent, payload.dark)
    if payload.tokens:
        allowed = set(theme["tokens"])
        for key, value in payload.tokens.items():
            if key not in allowed or not COLOR_TOKEN.fullmatch(value):
                raise HTTPException(status_code=422, detail=f"Недопустимый токен темы: {key}")
            theme["tokens"][key] = value
    theme_id = await execute(
        "INSERT INTO custom_themes (account_id, name, tokens_json) VALUES (?, ?, ?)",
        (account["id"], name, json.dumps(theme, ensure_ascii=False)),
    )
    return {**theme, "id": f"custom:{theme_id}"}


@router.delete("/custom/{theme_id}", status_code=204)
async def delete_theme(
    theme_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    row = await fetchone(
        "SELECT id FROM custom_themes WHERE id = ? AND account_id = ?",
        (theme_id, account["id"]),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Пользовательская тема не найдена")
    await execute("DELETE FROM custom_themes WHERE id = ? AND account_id = ?", (theme_id, account["id"]))
    return Response(status_code=204)