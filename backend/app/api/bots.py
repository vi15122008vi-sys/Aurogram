from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, HttpUrl

from app.database import execute, fetchall, fetchone
from app.deps import encrypt_secret, get_current_account
from app.models import BotOut, BotTokenIn

router = APIRouter(prefix="/bots", tags=["bots"])


class BotCreate(BotTokenIn):
    webhook_url: HttpUrl | None = None


class WebhookUpdate(BaseModel):
    url: HttpUrl | None = None


async def _telegram_request(token: str, method: str, **payload: Any) -> dict[str, Any]:
    url = f"https://api.telegram.org/bot{token}/{method}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, json=payload) if payload else await client.get(url)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Не удалось связаться с Telegram Bot API") from exc
    try:
        result = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Telegram Bot API вернул некорректный ответ") from exc
    if response.status_code >= 400 or not result.get("ok"):
        raise HTTPException(status_code=422, detail="Токен бота недействителен или запрос отклонён")
    return result["result"]


@router.get("", response_model=list[BotOut])
async def bots(account: dict[str, Any] = Depends(get_current_account)) -> list[BotOut]:
    rows = await fetchall(
        "SELECT id, username, name, webhook_url FROM bots WHERE account_id = ? ORDER BY created_at DESC",
        (account["id"],),
    )
    return [
        BotOut(
            id=row["id"],
            username=row["username"],
            name=row["name"],
            webhook_set=bool(row["webhook_url"]),
        )
        for row in rows
    ]


@router.post("", response_model=BotOut, status_code=201)
async def add_bot(
    payload: BotCreate,
    account: dict[str, Any] = Depends(get_current_account),
) -> BotOut:
    token = payload.token.strip()
    bot_info = await _telegram_request(token, "getMe")
    try:
        encrypted = encrypt_secret(token)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Настройте SECRET_KEY для хранения токенов") from exc
    webhook = str(payload.webhook_url) if payload.webhook_url else None
    bot_id = int(bot_info["id"])
    existing = await fetchone("SELECT account_id FROM bots WHERE id = ?", (bot_id,))
    if existing and existing["account_id"] != account["id"]:
        raise HTTPException(status_code=409, detail="Этот бот уже подключён к другому аккаунту")
    if webhook:
        await _telegram_request(token, "setWebhook", url=webhook)
    await execute(
        """
        INSERT INTO bots (id, account_id, username, name, token_enc, webhook_url)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            account_id = excluded.account_id,
            username = excluded.username,
            name = excluded.name,
            token_enc = excluded.token_enc,
            webhook_url = excluded.webhook_url
        """,
        (bot_id, account["id"], bot_info.get("username", ""), bot_info.get("first_name", ""), encrypted, webhook),
    )
    return BotOut(id=bot_id, username=bot_info.get("username", ""), name=bot_info.get("first_name", ""), webhook_set=bool(webhook))


@router.delete("/{bot_id}", status_code=204)
async def remove_bot(
    bot_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    row = await fetchone("SELECT id FROM bots WHERE id = ? AND account_id = ?", (bot_id, account["id"]))
    if row is None:
        raise HTTPException(status_code=404, detail="Бот не найден")
    await execute("DELETE FROM bots WHERE id = ? AND account_id = ?", (bot_id, account["id"]))
    return Response(status_code=204)


@router.put("/{bot_id}/webhook", response_model=BotOut)
async def update_webhook(
    bot_id: int,
    payload: WebhookUpdate,
    account: dict[str, Any] = Depends(get_current_account),
) -> BotOut:
    row = await fetchone(
        "SELECT * FROM bots WHERE id = ? AND account_id = ?",
        (bot_id, account["id"]),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Бот не найден")
    from app.deps import decrypt_secret

    token = decrypt_secret(row["token_enc"])
    if payload.url:
        await _telegram_request(token, "setWebhook", url=str(payload.url))
    else:
        await _telegram_request(token, "deleteWebhook")
    value = str(payload.url) if payload.url else None
    await execute("UPDATE bots SET webhook_url = ? WHERE id = ? AND account_id = ?", (value, bot_id, account["id"]))
    return BotOut(id=row["id"], username=row["username"], name=row["name"], webhook_set=bool(value))