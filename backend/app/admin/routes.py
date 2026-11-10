from __future__ import annotations

import hmac
import csv
import io
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Form, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates

from app.antispam.log import read_log
from app.cache.manager import connect_cache, touch_cached_media
from app.cache.index import get_listener_heartbeat
from app.cache.stats import global_stats, growth_30d
from app.config import get_settings
from app.database import fetchall
from app.telegram.media import download_message_media, resolve_media_file

router = APIRouter(prefix="/admin", tags=["admin"])
TEMPLATE_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

PAGES = {
    "accounts": "Аккаунты",
    "channels": "Каналы",
    "bots": "Боты",
    "chats": "Чаты",
    "media": "Медиа",
    "stats": "Статистика",
    "export": "Экспорт",
    "system": "Система",
    "logs": "Журнал",
    "antispam": "Антиспам",
    "stopwords": "Стоп-слова",
    "editor": "Редактор",
    "themes": "Темы",
    "cache": "Кэш",
    "settings": "Настройки",
}


def _admin_session(request: Request) -> bool:
    return bool(request.session.get("admin_authenticated"))


def _page_response(request: Request, page: str, data: dict[str, Any] | None = None) -> HTMLResponse:
    return templates.TemplateResponse(
        request=request,
        name=f"{page}.html",
        context={
            "request": request,
            "page": page,
            "title": PAGES.get(page, "Обзор"),
            "pages": PAGES,
            **(data or {}),
        },
    )


async def _cached_messages(limit: int) -> list[dict[str, Any]]:
    accounts = await fetchall("SELECT id, name FROM accounts ORDER BY created_at DESC")
    messages: list[dict[str, Any]] = []
    remaining = max(1, min(limit, 10_000))
    for account in accounts:
        conn = await connect_cache(account["id"])
        try:
            cur = await conn.execute(
                """SELECT chat_id, id, sender_id, text, date, out, edited, media_type
                   FROM cached_messages ORDER BY date DESC LIMIT ?""",
                (remaining,),
            )
            rows = await cur.fetchall()
            messages.extend(
                {
                    **dict(row),
                    "account_id": account["id"],
                    "account_name": account["name"],
                }
                for row in rows
            )
            remaining -= len(rows)
        finally:
            await conn.close()
        if remaining <= 0:
            break
    messages.sort(key=lambda row: row.get("date") or "", reverse=True)
    return messages[:limit]


async def _page_data(page: str) -> dict[str, Any]:
    settings = get_settings()
    if page == "dashboard":
        accounts = await fetchall("SELECT id, name, phone, auth_state, last_sync FROM accounts ORDER BY created_at DESC LIMIT 8")
        bots = await fetchall("SELECT id FROM bots")
        channels = await fetchall("SELECT channel_id FROM channel_settings")
        return {
            "accounts": [dict(row) for row in accounts],
            "account_count": len(await fetchall("SELECT id FROM accounts")),
            "bot_count": len(bots),
            "channel_count": len(channels),
            "listener": await get_listener_heartbeat(),
        }
    if page == "accounts":
        rows = await fetchall("SELECT id, phone, name, username, auth_state, created_at, last_sync FROM accounts ORDER BY created_at DESC")
        return {"rows": [dict(row) for row in rows]}
    if page == "channels" or page == "antispam":
        rows = await fetchall(
            """SELECT cs.account_id, cs.channel_id, cs.antispam_json, cs.updated_at, a.name
               FROM channel_settings cs LEFT JOIN accounts a ON a.id = cs.account_id
               ORDER BY cs.updated_at DESC LIMIT 300"""
        )
        return {"rows": [dict(row) for row in rows]}
    if page == "bots":
        rows = await fetchall("SELECT id, account_id, username, name, webhook_url, created_at FROM bots ORDER BY created_at DESC")
        return {"rows": [dict(row) for row in rows]}
    if page == "editor":
        return {"rows": await _cached_messages(200)}
    if page == "stopwords":
        rows = await fetchall(
            "SELECT id, account_id, channel_id, word, category, enabled, is_builtin FROM antispam_stopwords ORDER BY id DESC LIMIT 300"
        )
        return {"rows": [dict(row) for row in rows]}
    if page == "themes":
        rows = await fetchall("SELECT id, account_id, name, created_at FROM custom_themes ORDER BY id DESC LIMIT 200")
        return {"rows": [dict(row) for row in rows]}
    if page == "media":
        accounts = await fetchall("SELECT id FROM accounts ORDER BY created_at DESC")
        files: list[dict[str, Any]] = []
        for account in accounts:
            account_media_root = Path(settings.media_dir) / account["id"]
            legacy_account_root = Path(settings.cache_dir) / account["id"]
            folders = (
                account_media_root / "media",
                account_media_root / "media_transcoded",
                legacy_account_root / "media",
                legacy_account_root / "media_transcoded",
            )
            for folder in folders:
                if not folder.exists():
                    continue
                for path in folder.rglob("*"):
                    try:
                        if path.is_file():
                            stat = path.stat()
                            files.append({
                                "account_id": account["id"],
                                "name": path.name,
                                "bytes": stat.st_size,
                                "modified": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                            })
                    except OSError:
                        continue
        files.sort(key=lambda item: item["modified"], reverse=True)
        return {"rows": files[:200]}
    if page == "stats":
        return {"stats": await global_stats(), "growth": await growth_30d()}
    if page == "export":
        return {"message_count": len(await _cached_messages(10_000)), "max_export": 10_000}
    if page == "logs":
        channels = await fetchall(
            "SELECT account_id, channel_id FROM channel_settings ORDER BY updated_at DESC LIMIT 50"
        )
        entries: list[dict[str, Any]] = []
        for channel in channels:
            try:
                entries.extend(
                    await read_log(channel["account_id"], int(channel["channel_id"]), limit=50)
                )
            except Exception:
                continue
        entries.sort(key=lambda item: item.get("created_at") or "", reverse=True)
        return {"rows": entries[:300]}
    if page == "cache":
        root = Path(settings.cache_dir)
        files = sum(1 for path in root.rglob("*") if path.is_file()) if root.exists() else 0
        return {"cache_dir": str(root), "file_count": files, "max_size_gb": settings.cache_max_size_gb}
    if page in {"settings", "system"}:
        return {
            "safe_settings": {
                "host": settings.host,
                "port": settings.port,
                "cors_origins": settings.cors_origins,
                "sessions_dir": settings.sessions_dir,
                "cache_dir": settings.cache_dir,
                "media_dir": settings.media_dir,
                "cache_ttl_days": settings.cache_ttl_days,
                "allow_per_account_keys": settings.allow_per_account_keys,
                "admin_accent": settings.admin_accent,
                "vapid_configured": bool(settings.vapid_public_key and settings.vapid_private_key),
            }
        }
    return {}


def _admin_time(value: Any) -> str:
    if not value:
        return "—"
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo:
            parsed = parsed.astimezone()
        return parsed.strftime("%d.%m.%Y %H:%M")
    except (TypeError, ValueError):
        return str(value)


def _chat_initial(title: str) -> str:
    words = [word for word in title.split() if word]
    if not words:
        return "?"
    return "".join(word[0] for word in words[:2]).upper()


async def _admin_chat_rows(account_id: str) -> list[dict[str, Any]]:
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute(
            """SELECT c.id, c.type, c.title, c.username, c.unread,
                      c.last_message_date, c.last_message_id,
                      (SELECT m.text FROM cached_messages m
                       WHERE m.chat_id = c.id AND m.id = c.last_message_id LIMIT 1) AS last_message
               FROM cached_chats c
               ORDER BY c.last_message_date DESC, c.id DESC LIMIT 300"""
        )
        rows = [dict(row) for row in await cur.fetchall()]
    finally:
        await conn.close()
    type_labels = {"user": "Личный чат", "group": "Группа", "channel": "Канал", "bot": "Бот"}
    for row in rows:
        row["title"] = row.get("title") or str(row["id"])
        row["initial"] = _chat_initial(row["title"])
        row["type_label"] = type_labels.get(row.get("type"), "Чат")
        row["last_message_label"] = _admin_time(row.get("last_message_date"))
    return rows


async def _admin_account(account_id: str) -> dict[str, Any] | None:
    rows = await fetchall(
        "SELECT id, name, phone FROM accounts WHERE id = ? LIMIT 1",
        (account_id,),
    )
    return dict(rows[0]) if rows else None


async def _admin_message_page(account_id: str, chat_id: int, offset: int) -> tuple[list[dict[str, Any]], bool]:
    page_size = 50
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute(
            """SELECT m.id, m.sender_id, m.text, m.date, m.out, m.edited, m.deleted, m.media_type,
                      m.waveform_data,
                      (SELECT cm.mime FROM cached_media cm
                       WHERE cm.chat_id = m.chat_id AND cm.message_id = m.id
                       ORDER BY cm.id DESC LIMIT 1) AS media_mime,
                      cm.name AS sender_name
               FROM cached_messages m
               LEFT JOIN cached_members cm ON cm.chat_id = m.chat_id AND cm.user_id = m.sender_id
               WHERE m.chat_id = ?
               ORDER BY COALESCE(m.date, '') ASC, m.id ASC
               LIMIT ? OFFSET ?""",
            (chat_id, page_size + 1, offset),
        )
        rows = [dict(row) for row in await cur.fetchall()]
    finally:
        await conn.close()

    has_more = len(rows) > page_size
    rows = rows[:page_size]
    media_labels = {
        "MessageMediaPhoto": "📷 Фото",
        "MessageMediaDocument": "📎 Файл или медиа",
        "MessageMediaGeo": "📍 Геопозиция",
        "MessageMediaWebPage": "🔗 Ссылка",
        "MessageMediaContact": "👤 Контакт",
        "MessageMediaPoll": "📊 Опрос",
    }
    for row in rows:
        row["time_label"] = _admin_time(row.get("date"))
        row["is_voice"] = bool(row.get("waveform_data")) or (
            row.get("media_type") == "MessageMediaDocument"
            and str(row.get("media_mime") or "").startswith("audio/")
        )
        row["media_label"] = (
            "🎙 Голосовое сообщение" if row["is_voice"]
            else media_labels.get(row.get("media_type"), "📎 Медиа") if row.get("media_type")
            else None
        )
        if row.get("deleted"):
            row["text"] = "Сообщение удалено"
        elif row["is_voice"] and not row.get("text"):
            row["text"] = ""
        elif not row.get("text") and row.get("media_type"):
            row["text"] = "Медиа-сообщение"
        elif not row.get("text"):
            row["text"] = ""
        row["out"] = bool(row.get("out"))
    return rows, has_more


@router.get("/media/{account_id}/{chat_id}/{message_id}")
async def admin_media(
    request: Request,
    account_id: str,
    chat_id: int,
    message_id: int,
) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    account = await _admin_account(account_id)
    if not account:
        return HTMLResponse("Аккаунт не найден", status_code=404)
    path = resolve_media_file(account_id, chat_id, message_id)
    if path is None or not path.is_file():
        path = await download_message_media(account, chat_id, message_id)
    if path is None or not path.is_file():
        return HTMLResponse("Медиафайл не найден", status_code=404)
    await touch_cached_media(account_id, path, chat_id, message_id)
    media_type, _ = mimetypes.guess_type(path.name)
    return FileResponse(
        path,
        media_type=media_type or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.get("/chats", response_class=HTMLResponse)
async def admin_chats(request: Request, account_id: str | None = None) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    accounts = [dict(row) for row in await fetchall(
        "SELECT id, name, phone FROM accounts ORDER BY created_at DESC"
    )]
    valid_ids = {account["id"] for account in accounts}
    selected_account_id = account_id if account_id in valid_ids else ""
    rows = await _admin_chat_rows(selected_account_id) if selected_account_id else []
    if request.headers.get("HX-Request") == "true":
        return templates.TemplateResponse(
            request=request,
            name="chat_list.html",
            context={"request": request, "rows": rows, "account_id": selected_account_id},
        )
    return _page_response(request, "chats", {
        "accounts": accounts,
        "selected_account_id": selected_account_id,
        "rows": rows,
    })


@router.get("/chat/{chat_id}", response_class=HTMLResponse)
async def admin_chat(
    request: Request,
    chat_id: int,
    account_id: str = "",
) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    account = await _admin_account(account_id) if account_id else None
    if not account:
        return RedirectResponse("/admin/chats", status_code=303)
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute(
            "SELECT id, type, title, username FROM cached_chats WHERE id = ? LIMIT 1",
            (chat_id,),
        )
        chat_row = await cur.fetchone()
    finally:
        await conn.close()
    if not chat_row:
        return HTMLResponse("Чат не найден в кэше", status_code=404)
    chat = dict(chat_row)
    chat["title"] = chat.get("title") or str(chat_id)
    messages, has_more = await _admin_message_page(account_id, chat_id, 0)
    return _page_response(request, "chat_reader", {
        "account": account,
        "account_id": account_id,
        "chat": chat,
        "messages": messages,
        "has_more": has_more,
        "next_offset": len(messages),
    })


@router.get("/chat/{chat_id}/messages", response_class=HTMLResponse)
async def admin_chat_messages(
    request: Request,
    chat_id: int,
    account_id: str,
    offset: int = Query(default=50, ge=0, le=1_000_000),
) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    account = await _admin_account(account_id)
    if not account:
        return HTMLResponse("Аккаунт не найден", status_code=404)
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute("SELECT type FROM cached_chats WHERE id = ? LIMIT 1", (chat_id,))
        chat_row = await cur.fetchone()
    finally:
        await conn.close()
    if not chat_row:
        return HTMLResponse("Чат не найден в кэше", status_code=404)
    rows, has_more = await _admin_message_page(account_id, chat_id, offset)
    return templates.TemplateResponse(
        request=request,
        name="message_page.html",
        context={
            "request": request,
            "messages": rows,
            "has_more": has_more,
            "next_offset": offset + len(rows),
            "account_id": account_id,
            "chat_id": chat_id,
            "chat_type": chat_row["type"],
        },
    )


@router.get("", response_class=HTMLResponse)
@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    return _page_response(request, "dashboard", await _page_data("dashboard"))


@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request) -> Response:
    if _admin_session(request):
        return RedirectResponse("/admin", status_code=303)
    return templates.TemplateResponse(request=request, name="login.html", context={"request": request, "error": None})


@router.post("/login", response_class=HTMLResponse)
async def login(
    request: Request,
    username: str = Form(..., max_length=128),
    password: str = Form(..., max_length=256),
) -> Response:
    settings = get_settings()
    valid_user = hmac.compare_digest(username, settings.admin_user)
    valid_password = hmac.compare_digest(password, settings.admin_password)
    if not (valid_user and valid_password):
        return templates.TemplateResponse(
            request=request,
            name="login.html",
            context={"request": request, "error": "Неверный логин или пароль"},
            status_code=401,
        )
    request.session.clear()
    request.session["admin_authenticated"] = True
    return RedirectResponse("/admin", status_code=303)


@router.post("/logout")
async def logout(request: Request) -> RedirectResponse:
    request.session.clear()
    return RedirectResponse("/admin/login", status_code=303)


@router.get("/export/messages.json")
async def export_messages_json(request: Request) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    return JSONResponse(
        content={"messages": await _cached_messages(10_000)},
        headers={"Content-Disposition": 'attachment; filename="aurogram-messages.json"'},
    )


@router.get("/export/messages.csv")
async def export_messages_csv(request: Request) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    messages = await _cached_messages(10_000)
    fields = ["account_id", "chat_id", "id", "sender_id", "text", "date", "out", "edited", "media_type"]
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(messages)
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="aurogram-messages.csv"'},
    )


@router.get("/{page}", response_class=HTMLResponse)
async def admin_page(request: Request, page: str) -> Response:
    if page not in PAGES:
        return HTMLResponse("Страница не найдена", status_code=404)
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    return _page_response(request, page, await _page_data(page))
