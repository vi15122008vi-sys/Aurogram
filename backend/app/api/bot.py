from __future__ import annotations

import re
from html import escape
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile

from app.bot.client import BotError, create_sticker_set, get_me, get_updates, send_message, set_webhook, webhook_info
from app.bot.guard import allowed_user_ids, internal_secret, is_allowed_user, is_internal_request
from app.config import get_settings
from app.deps import get_current_account

router = APIRouter(prefix="/bot", tags=["bot"])

MAX_STICKER_BYTES = 512 * 1024
MAX_STICKERS = 50


@router.get("/status")
async def bot_status(account: dict[str, Any] = Depends(get_current_account)) -> dict[str, Any]:
    """Состояние бота: без токена, без секретов — только публичные данные."""
    payload: dict[str, Any] = {
        "configured": False,
        "allowed_user_ids": allowed_user_ids(),
        "internal_secret_set": bool(internal_secret()),
        "widget_base_url": get_settings().bot_widget_base_url.strip() or None,
    }
    try:
        me = await get_me()
    except BotError as exc:
        payload["error"] = str(exc)
        return payload
    payload.update({"configured": True, "id": me.get("id"), "username": me.get("username"), "name": me.get("first_name")})
    try:
        info = await webhook_info()
        payload["webhook_url"] = info.get("url") or None
        payload["pending_updates"] = info.get("pending_update_count", 0)
    except BotError:
        payload["webhook_url"] = None
    return payload


@router.get("/updates")
async def bot_updates(account: dict[str, Any] = Depends(get_current_account)) -> dict[str, Any]:
    """Кто писал боту: помогает узнать свой user_id для белого списка."""
    try:
        updates = await get_updates()
    except BotError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    seen: dict[int, dict[str, Any]] = {}
    for update in updates:
        message = update.get("message") or update.get("edited_message") or {}
        sender = message.get("from") or {}
        user_id = sender.get("id")
        if not user_id:
            continue
        seen[int(user_id)] = {
            "user_id": int(user_id),
            "username": sender.get("username"),
            "first_name": sender.get("first_name"),
            "chat_id": (message.get("chat") or {}).get("id"),
            "text": (message.get("text") or "")[:60],
            "allowed": is_allowed_user(user_id),
        }
    return {"senders": list(seen.values()), "allowed_user_ids": allowed_user_ids()}


@router.post("/webhook/register")
async def register_webhook(payload: dict[str, Any], account: dict[str, Any] = Depends(get_current_account)) -> dict[str, Any]:
    """Ставит вебхук с secret_token — Telegram будет присылать его в заголовке."""
    url = str(payload.get("url") or "").strip()
    if not url.startswith("https://"):
        raise HTTPException(status_code=422, detail="Нужен https-адрес вебхука")
    secret = internal_secret()
    if not secret:
        raise HTTPException(status_code=503, detail="Задайте BOT_INTERNAL_SECRET в окружении")
    try:
        await set_webhook(url, secret)
    except BotError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"webhook_url": url, "secret_checked": True}


@router.post("/webhook")
async def bot_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None, alias="X-Telegram-Bot-Api-Secret-Token"),
) -> dict[str, Any]:
    """Входящие апдейты. Всё, что не прошло проверку, молча игнорируется."""
    try:
        update = await request.json()
    except ValueError:
        return {"ok": True, "ignored": "payload"}

    # 1. Запрос не от Telegram-вебхука нашего бота — не отвечаем вообще.
    if not is_internal_request(x_telegram_bot_api_secret_token):
        return {"ok": True, "ignored": "secret"}

    message = update.get("message") or update.get("edited_message") or {}
    sender = message.get("from") or {}
    chat_id = (message.get("chat") or {}).get("id")
    text = (message.get("text") or "").strip()

    # 2. Случайный человек в Telegram — игнорируем без ответа.
    if not is_allowed_user(sender.get("id")):
        return {"ok": True, "ignored": "user"}

    if chat_id is None:
        return {"ok": True, "ignored": "chat"}

    if text in {"/start", "/help", "/studio"}:
        await send_message(
            chat_id,
            "<b>Aurogram Studio</b>\n\n"
            "Бот работает только для приложения Aurogram.\n"
            "/id — ваш Telegram ID\n"
            "/status — состояние доступа",
        )
    elif text == "/id":
        await send_message(chat_id, f"Ваш user_id: <code>{sender.get('id')}</code>")
    elif text == "/status":
        ids = ", ".join(str(item) for item in sorted(allowed_user_ids())) or "—"
        await send_message(chat_id, f"Доступ разрешён: <code>{escape(ids)}</code>")
    else:
        return {"ok": True, "ignored": "text"}
    return {"ok": True}


@router.post("/widgets/send")
async def send_widget(
    payload: dict[str, Any],
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Публикует HTML-виджет в канал от имени бота (бот должен быть админом)."""
    channel = str(payload.get("channel") or "").strip()
    title = str(payload.get("title") or "").strip()
    text = str(payload.get("text") or "").strip()
    widget = str(payload.get("widget") or "").strip()
    if not channel or not title or not text:
        raise HTTPException(status_code=422, detail="Нужны channel, title и text")
    body = f"<b>{escape(title)}</b>\n\n{escape(text)}"
    markup = None
    base = get_settings().bot_widget_base_url.strip()
    if base and widget:
        url = f"{base.rstrip('/')}/{widget}?channel={channel}"
        markup = {"inline_keyboard": [[{"text": "▶️ Играть", "url": url}]]}
    try:
        result = await send_message(channel, body, reply_markup=markup)
    except BotError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"message_id": result.get("message_id"), "channel": channel, "widget": widget or None}


@router.post("/stickers/set")
async def create_sticker_pack(
    name: str = Form(...),
    title: str = Form(...),
    emoji: str = Form(default="⭐"),
    owner_id: int | None = Form(default=None),
    files: list[UploadFile] = File(...),
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Создаёт стикерпак через stickers.CreateStickerSet (Bot API)."""
    if not files:
        raise HTTPException(status_code=422, detail="Нужен хотя бы один PNG")
    if len(files) > MAX_STICKERS:
        raise HTTPException(status_code=422, detail=f"Максимум {MAX_STICKERS} стикеров в паке")
    payloads: list[bytes] = []
    for item in files:
        if not (item.content_type or "").startswith("image/"):
            raise HTTPException(status_code=415, detail="Стикеры должны быть изображениями PNG")
        raw = await item.read(MAX_STICKER_BYTES + 1)
        if len(raw) > MAX_STICKER_BYTES:
            raise HTTPException(status_code=413, detail="Стикер должен быть не больше 512 КБ")
        payloads.append(raw)

    try:
        me = await get_me()
    except BotError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    bot_username = str(me.get("username") or "")
    if not bot_username:
        raise HTTPException(status_code=503, detail="У бота нет username")

    owner = owner_id
    if owner is None:
        candidates = sorted(allowed_user_ids())
        owner = candidates[0] if candidates else None
    if owner is None:
        raise HTTPException(status_code=422, detail="Укажите owner_id: владелец должен был запустить бота")

    slug = re.sub(r"[^a-z0-9_]", "_", name.lower()).strip("_") or "aurogram"
    if len(slug) > 40:
        slug = slug[:40]
    if not slug.endswith(f"_by_{bot_username.lower()}"):
        slug = f"{slug}_by_{bot_username.lower()}"

    try:
        result = await create_sticker_set(user_id=owner, name=slug, title=title[:64], stickers=payloads, emoji=emoji)
    except BotError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"name": result.get("name"), "title": result.get("title"), "count": len(payloads), "owner_id": owner}
