from __future__ import annotations

import json

import httpx

from app.config import get_settings


class BotError(RuntimeError):
    """Ошибка Bot API: токен не задан или Telegram отклонил запрос."""


def _token() -> str:
    token = get_settings().bot_token.strip()
    if not token:
        raise BotError("BOT_TOKEN не задан в окружении бэкенда")
    return token


async def call(method: str, *, data: dict[str, str] | None = None, files: dict | None = None) -> dict:
    """Вызов Bot API. Токен не покидает процесс и никогда не пишется в логи."""
    url = f"https://api.telegram.org/bot{_token()}/{method}"
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            if data or files:
                response = await client.post(url, data=data, files=files)
            else:
                response = await client.get(url)
    except httpx.HTTPError as exc:
        raise BotError("Не удалось связаться с Telegram Bot API") from exc
    try:
        payload = response.json()
    except ValueError as exc:
        raise BotError("Bot API вернул некорректный ответ") from exc
    if not payload.get("ok"):
        raise BotError(str(payload.get("description") or "Telegram отклонил запрос"))
    return payload["result"]


async def get_me() -> dict:
    return await call("getMe")


async def webhook_info() -> dict:
    return await call("getWebhookInfo")


async def set_webhook(url: str, secret_token: str) -> dict:
    data = {"url": url, "allowed_updates": json.dumps(["message", "edited_message"])}
    if secret_token:
        data["secret_token"] = secret_token
    return await call("setWebhook", data=data)


async def delete_webhook() -> dict:
    return await call("deleteWebhook")


async def get_updates(limit: int = 20) -> list[dict]:
    return list(await call("getUpdates", data={"limit": str(limit), "timeout": "0"}))


async def send_message(chat_id: int | str, text: str, *, parse_mode: str = "HTML", reply_markup: dict | None = None) -> dict:
    data: dict[str, str] = {
        "chat_id": str(chat_id),
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": "true",
    }
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)
    return await call("sendMessage", data=data)


async def send_photo(chat_id: int | str, photo: bytes, *, filename: str = "photo.png", caption: str | None = None) -> dict:
    files = {"photo": (filename, photo, "image/png")}
    data: dict[str, str] = {"chat_id": str(chat_id)}
    if caption:
        data["caption"] = caption
        data["parse_mode"] = "HTML"
    return await call("sendPhoto", data=data, files=files)


async def create_sticker_set(*, user_id: int, name: str, title: str, stickers: list[bytes], emoji: str = "⭐") -> dict:
    """Создаёт статический стикерпак через stickers.CreateStickerSet (Bot API)."""
    if not stickers:
        raise BotError("Нужен хотя бы один стикер")
    files = {
        f"file{index}": (f"sticker{index}.png", payload, "image/png")
        for index, payload in enumerate(stickers)
    }
    items = [
        {"sticker": f"attach://file{index}", "format": "static", "emoji_list": [emoji]}
        for index in range(len(stickers))
    ]
    data = {
        "user_id": str(user_id),
        "name": name,
        "title": title,
        "sticker_format": "static",
        "sticker_type": "regular",
        "stickers": json.dumps(items),
    }
    return await call("createNewStickerSet", data=data, files=files)
