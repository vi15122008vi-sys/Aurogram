"""Кросс-постинг: копия поста уходит в Discord/VK после публикации в Telegram."""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx
from fastapi import HTTPException

from app.config import get_settings
from app.database import fetchone
from app.deps import decrypt_secret

log = logging.getLogger("aurogram.integrations")

DISCORD_MAX = 1_900
VK_MAX = 15_000
TIMEOUT = 15.0


def _decrypt(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return decrypt_secret(value).strip() or None
    except HTTPException:
        log.warning("не удалось расшифровать секрет интеграции (сменился SECRET_KEY?)")
        return None


async def _post_discord(webhook: str, text: str) -> dict[str, Any]:
    payload = {
        "content": text[:DISCORD_MAX],
        "username": "Aurogram",
        "allowed_mentions": {"parse": []},
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(webhook, json=payload)
    except httpx.HTTPError as exc:
        return {"service": "discord", "ok": False, "detail": f"сеть: {exc.__class__.__name__}"}
    if response.status_code >= 400:
        return {"service": "discord", "ok": False, "detail": f"HTTP {response.status_code}"}
    return {"service": "discord", "ok": True, "detail": "отправлено"}


async def _post_vk(token: str, group_id: str, text: str) -> dict[str, Any]:
    params = {
        "owner_id": f"-{group_id.lstrip('-')}",
        "from_group": 1,
        "message": text[:VK_MAX],
        "access_token": token,
        "v": "5.199",
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post("https://api.vk.com/method/wall.post", data=params)
    except httpx.HTTPError as exc:
        return {"service": "vk", "ok": False, "detail": f"сеть: {exc.__class__.__name__}"}
    try:
        payload = response.json()
    except ValueError:
        return {"service": "vk", "ok": False, "detail": "некорректный ответ VK"}
    if "error" in payload:
        message = payload["error"].get("error_msg", "ошибка VK")
        return {"service": "vk", "ok": False, "detail": str(message)[:120]}
    return {"service": "vk", "ok": True, "detail": "опубликовано"}


async def deliver(account_id: str, channel_id: int, text: str) -> list[dict[str, Any]]:
    """Отправляет копию поста во все подключённые сервисы. Ошибки не валят публикацию."""
    if not text.strip():
        return []
    row = await fetchone(
        "SELECT discord_webhook_enc, vk_token_enc, vk_group_id FROM channel_integrations "
        "WHERE account_id = ? AND channel_id = ?",
        (account_id, channel_id),
    )
    if not row:
        return []

    results: list[dict[str, Any]] = []
    webhook = _decrypt(row["discord_webhook_enc"])
    if webhook:
        results.append(await _post_discord(webhook, text))
    vk_token = _decrypt(row["vk_token_enc"])
    if vk_token and row["vk_group_id"]:
        results.append(await _post_vk(vk_token, str(row["vk_group_id"]), text))

    for item in results:
        level = logging.INFO if item["ok"] else logging.WARNING
        log.log(level, "crosspost %s/%s → %s: %s", account_id[:8], channel_id, item["service"], item["detail"])
    return results


def mask(secret: Optional[str]) -> Optional[str]:
    """Хвост секрета для UI: показываем последние 4 символа."""
    if not secret:
        return None
    tail = secret[-4:]
    return f"…{tail}"


def settings_configured() -> bool:
    return bool(get_settings().secret_key.strip())
