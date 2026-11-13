from __future__ import annotations

import hmac
import csv
import io
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from fastapi import APIRouter, Body, Depends, Form, Query, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates

from app.antispam.log import read_log
from app.admin.exporter import build_channel_html
from app.cache.manager import chat_message_count, clear_chat_messages, connect_cache, touch_cached_media
from app.cache.index import get_listener_heartbeat
from app.cache.stats import global_stats, growth_30d
from app.config import get_settings
from app.database import fetchall
from app.ratelimit import ADMIN_LOGIN_LIMITER, limit_requests
from app.invites import create_code as invite_create, delete_code as invite_delete, list_codes as invite_list, master_code as invite_master, set_active as invite_set_active
from app.telegram.chats import fetch_chat_history
from app.telegram.media import download_message_media, resolve_media_file

router = APIRouter(prefix="/admin", tags=["admin"])
TEMPLATE_DIR = Path(__file__).parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

PAGES = {
    "accounts": "Аккаунты",
    "invites": "Приглашения",
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

# Иконки сайдбара: компактные stroke-SVG в духе Linear.
ICONS = {
    "dashboard": '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/>',
    "accounts": '<path d="M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19"/><circle cx="9.5" cy="7.5" r="3"/>',
    "invites": '<path d="M4 9a3 3 0 0 1 0 6v3h16v-3a3 3 0 0 1 0-6V6H4z"/><path d="M9 12h6"/>',
    "channels": '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4"/>',
    "bots": '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V5"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>',
    "chats": '<path d="M4 6h16v10H8l-4 4z"/>',
    "media": '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m5 18 5-5 4 4 3-3 3 3"/>',
    "stats": '<path d="M4 19V5M4 19h16"/><path d="M8 15v-4M12 15V8M16 15v-6"/>',
    "export": '<path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/>',
    "system": '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/>',
    "logs": '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    "antispam": '<path d="M12 4l7 3v5c0 4-3 6.5-7 8-4-1.5-7-4-7-8V7z"/>',
    "stopwords": '<circle cx="12" cy="12" r="8"/><path d="m7 7 10 10"/>',
    "editor": '<path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4 16z"/>',
    "themes": '<circle cx="12" cy="12" r="8"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><circle cx="12" cy="15" r="1"/>',
    "cache": '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/>',
    "settings": '<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>',
    "logout": '<path d="M15 12H4"/><path d="m9 8-4 4 4 4"/><path d="M14 5h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4"/>',
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
            "icons": ICONS,
            **(data or {}),
        },
    )


def _num(value: Any) -> str:
    try:
        return f"{int(value):,}".replace(",", "\u202f")
    except (TypeError, ValueError):
        return str(value)


templates.env.filters["num"] = _num


def _dir_size(path: Path) -> int:
    total = 0
    if not path.exists():
        return 0
    for item in path.rglob("*"):
        try:
            if item.is_file():
                total += item.stat().st_size
        except OSError:
            continue
    return total


async def _dashboard_cards() -> dict[str, Any]:
    """Счётчики дашборда: каналы, боты, сообщения в кэше, размер медиа."""
    accounts = await fetchall("SELECT id FROM accounts")
    channel_ids = await fetchall("SELECT DISTINCT channel_id FROM channel_settings")
    bots = await fetchall("SELECT id FROM bots")

    messages = 0
    media_files = 0
    media_indexed = 0
    for account in accounts:
        try:
            conn = await connect_cache(account["id"])
        except Exception:
            continue
        try:
            cursor = await conn.execute("SELECT COUNT(*) AS c FROM cached_messages")
            messages += int((await cursor.fetchone())["c"] or 0)
            cursor = await conn.execute(
                "SELECT COUNT(*) AS c, COALESCE(SUM(size_bytes), 0) AS s FROM cached_media"
            )
            row = await cursor.fetchone()
            media_files += int(row["c"] or 0)
            media_indexed += int(row["s"] or 0)
        except Exception:
            continue
        finally:
            await conn.close()

    settings = get_settings()
    media_disk = _dir_size(Path(settings.media_dir))
    cache_disk = _dir_size(Path(settings.cache_dir))
    media_bytes = max(media_disk, media_indexed)
    return {
        "channel_total": len(channel_ids),
        "bot_total": len(bots),
        "message_total": messages,
        "media_bytes": media_bytes,
        "media_files": media_files,
        "cache_bytes": cache_disk,
        "account_total": len(accounts),
    }


async def _search_cached(
    needle: str,
    per_account: int = 6,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Глобальный поиск: аккаунты (по id/имени/телефону), чаты и сообщения.

    Сообщения ищем гибридно: SQL `LIKE` (быстро, регистронезависимо для ASCII
    и точно для кириллицы) + добор по свежим строкам в Python, чтобы находить
    кириллицу в другом регистре.
    """
    term = needle.strip().lower()
    chats: list[dict[str, Any]] = []
    messages: list[dict[str, Any]] = []
    account_hits: list[dict[str, Any]] = []
    if len(term) < 2:
        return chats, messages, account_hits

    accounts = await fetchall("SELECT id, name, phone FROM accounts")
    for account in accounts:
        haystack = f"{account['id']} {account['name'] or ''} {account['phone'] or ''}".lower()
        if term in haystack:
            account_hits.append(
                {"account_id": account["id"], "name": account["name"], "phone": account["phone"]}
            )

    chat_limit = per_account * max(1, len(accounts))
    for account in accounts:
        try:
            conn = await connect_cache(account["id"])
        except Exception:
            continue
        try:
            cursor = await conn.execute("SELECT id, type, title, username FROM cached_chats LIMIT 3000")
            for row in await cursor.fetchall():
                haystack = f"{row['title'] or ''} {row['username'] or ''}".lower()
                if term in haystack:
                    chats.append({**dict(row), "account_id": account["id"], "account_name": account["name"]})
                    if len(chats) >= chat_limit:
                        break

            candidates: list[dict[str, Any]] = []
            cursor = await conn.execute(
                "SELECT chat_id, id, text, date, media_type FROM cached_messages "
                "WHERE text LIKE ? ORDER BY date DESC LIMIT ?",
                (f"%{term}%", per_account * 4),
            )
            candidates.extend(dict(row) for row in await cursor.fetchall())
            if len(candidates) < per_account:
                cursor = await conn.execute(
                    "SELECT chat_id, id, text, date, media_type FROM cached_messages "
                    "WHERE text IS NOT NULL ORDER BY date DESC LIMIT 1500"
                )
                candidates.extend(dict(row) for row in await cursor.fetchall())

            seen: set[tuple[int, int]] = set()
            for row in candidates:
                key = (int(row["chat_id"]), int(row["id"]))
                if key in seen:
                    continue
                if term in (row["text"] or "").lower():
                    seen.add(key)
                    messages.append({**row, "account_id": account["id"], "account_name": account["name"]})
                    if len(messages) >= chat_limit:
                        break
        except Exception:
            continue
        finally:
            await conn.close()
    chats.sort(key=lambda item: (item.get("type") or "", item.get("title") or ""))
    messages.sort(key=lambda item: item.get("date") or "", reverse=True)
    return chats, messages, account_hits


async def _hourly_activity() -> tuple[list[dict[str, Any]], int]:
    """Гистограмма активности по часам суток: когда в чатах пишут чаще всего."""
    accounts = await fetchall("SELECT id FROM accounts")
    buckets = [0] * 24
    for account in accounts:
        try:
            conn = await connect_cache(account["id"])
        except Exception:
            continue
        try:
            cursor = await conn.execute(
                """SELECT CAST(substr(date, 12, 2) AS INTEGER) AS hour, COUNT(*) AS c
                   FROM cached_messages
                   WHERE date IS NOT NULL AND length(date) >= 13
                   GROUP BY hour"""
            )
            for row in await cursor.fetchall():
                hour = int(row["hour"] or 0)
                if 0 <= hour < 24:
                    buckets[hour] += int(row["c"] or 0)
        except Exception:
            continue
        finally:
            await conn.close()

    total = sum(buckets)
    peak = max(buckets) or 1
    hourly = [
        {
            "hour": hour,
            "count": buckets[hour],
            "percent": round(buckets[hour] * 100 / peak),
            "share": round(buckets[hour] * 100 / total) if total else 0,
            "label": f"{hour:02d}:00",
        }
        for hour in range(24)
    ]
    return hourly, total


def _recommend_window(hourly: list[dict[str, Any]]) -> dict[str, Any]:
    """Лучшее двухчасовое окно публикации (по сумме двух соседних часов)."""
    counts = [row["count"] for row in hourly]
    if not any(counts):
        return {"available": False, "hour": None, "label": "—", "share": 0, "count": 0}
    best = max(range(24), key=lambda hour: counts[hour] + counts[(hour + 1) % 24])
    window = counts[best] + counts[(best + 1) % 24]
    total = sum(counts)
    return {
        "available": True,
        "hour": best,
        "label": f"{best:02d}:00–{(best + 2) % 24:02d}:00",
        "share": round(window * 100 / total) if total else 0,
        "count": window,
    }


async def _exportable_channels() -> list[dict[str, Any]]:
    """Каналы из кэша — для экспорта в HTML."""
    accounts = await fetchall("SELECT id, name FROM accounts ORDER BY created_at DESC")
    rows: list[dict[str, Any]] = []
    for account in accounts:
        try:
            conn = await connect_cache(account["id"])
        except Exception:
            continue
        try:
            cursor = await conn.execute(
                """SELECT id, title, username FROM cached_chats
                   WHERE type = 'channel' ORDER BY last_message_date DESC LIMIT 40"""
            )
            for chat in await cursor.fetchall():
                rows.append(
                    {
                        "account_id": account["id"],
                        "account_name": account["name"],
                        "channel_id": chat["id"],
                        "title": chat["title"] or str(chat["id"]),
                        "username": chat["username"],
                    }
                )
        except Exception:
            continue
        finally:
            await conn.close()
    return rows


def _csv_response(rows: list[dict[str, Any]], fields: list[str], filename: str) -> Response:
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
        stats = await _dashboard_cards()
        return {
            "accounts": [dict(row) for row in accounts],
            "account_count": stats["account_total"],
            "bot_count": stats["bot_total"],
            "channel_count": stats["channel_total"],
            "stats": stats,
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
    if page == "invites":
        return {"codes": await invite_list(), "master_code": invite_master()}
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
        hourly, total = await _hourly_activity()
        return {
            "stats": await global_stats(),
            "growth": await growth_30d(),
            "hourly": hourly,
            "hourly_total": total,
            "recommended": _recommend_window(hourly),
        }
    if page == "export":
        return {
            "message_count": len(await _cached_messages(10_000)),
            "max_export": 10_000,
            "channels": await _exportable_channels(),
        }
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
            row.get("media_type") in {"MessageMediaDocument", "voice"}
            and str(row.get("media_mime") or "").startswith("audio/")
        ) or row.get("media_type") == "voice"
        row["is_photo"] = row.get("media_type") in {"MessageMediaPhoto", "photo"} or str(row.get("media_mime") or "").startswith("image/")
        row["is_video"] = row.get("media_type") in {"MessageMediaVideo", "video"} or str(row.get("media_mime") or "").startswith("video/")
        row["media_label"] = (
            "🎙 Голосовое сообщение" if row["is_voice"]
            else "🎬 Видео" if row["is_video"]
            else "📷 Фото" if row["is_photo"]
            else media_labels.get(row.get("media_type"), "📎 Медиа") if row.get("media_type")
            else None
        )
        if row.get("deleted"):
            row["text"] = "Сообщение удалено"
        elif (row["is_voice"] or row["is_photo"] or row["is_video"]) and not row.get("text"):
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
    conn = await connect_cache(account_id)
    try:
        cur = await conn.execute(
            """SELECT m.media_type, m.waveform_data,
                      (SELECT cm.mime FROM cached_media cm
                       WHERE cm.chat_id = m.chat_id AND cm.message_id = m.id
                       ORDER BY cm.id DESC LIMIT 1) AS media_mime
               FROM cached_messages m WHERE m.chat_id = ? AND m.id = ? LIMIT 1""",
            (chat_id, message_id),
        )
        cached_message = await cur.fetchone()
    finally:
        await conn.close()
    media_type = (cached_message["media_mime"] if cached_message else None) or mimetypes.guess_type(path.name)[0]
    if path.suffix.lower() in {".ogg", ".opus"}:
        media_type = "audio/ogg"
    elif cached_message and (cached_message["media_type"] == "voice" or cached_message["waveform_data"]):
        media_type = "audio/ogg"
    elif cached_message and cached_message["media_type"] == "video":
        media_type = media_type if media_type and media_type.startswith("video/") else "video/mp4"
    elif cached_message and cached_message["media_type"] in {"MessageMediaPhoto", "photo"}:
        media_type = media_type if media_type and media_type.startswith("image/") else "image/jpeg"
    return FileResponse(
        path,
        media_type=media_type or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"},
    )


CHAT_TYPE_FILTERS = [
    ("all", "Все"),
    ("channel", "Каналы"),
    ("group", "Группы"),
    ("user", "Личные"),
    ("bot", "Боты"),
]


@router.get("/chats", response_class=HTMLResponse)
async def admin_chats(
    request: Request,
    account_id: str | None = None,
    chat_type: str = Query(default="all", alias="type"),
) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    accounts = [dict(row) for row in await fetchall(
        "SELECT id, name, phone FROM accounts ORDER BY created_at DESC"
    )]
    valid_ids = {account["id"] for account in accounts}
    selected_account_id = account_id if account_id in valid_ids else ""
    rows = await _admin_chat_rows(selected_account_id) if selected_account_id else []

    counts: dict[str, int] = {"all": len(rows)}
    for row in rows:
        key = str(row.get("type") or "other")
        counts[key] = counts.get(key, 0) + 1
    allowed = {key for key, _ in CHAT_TYPE_FILTERS}
    active_type = chat_type if chat_type in allowed else "all"
    visible = rows if active_type == "all" else [row for row in rows if row.get("type") == active_type]

    context: dict[str, Any] = {
        "rows": visible,
        "account_id": selected_account_id,
        "active_type": active_type,
        "type_filters": [(key, label, counts.get(key, 0)) for key, label in CHAT_TYPE_FILTERS],
        "total": len(rows),
        "shown": len(visible),
    }
    if request.headers.get("HX-Request") == "true":
        return templates.TemplateResponse(
            request=request,
            name="chat_results.html",
            context={"request": request, **context},
        )
    return _page_response(request, "chats", {
        "accounts": accounts,
        "selected_account_id": selected_account_id,
        **context,
    })


@router.get("/chat/{chat_id}", response_class=HTMLResponse)
async def admin_chat(
    request: Request,
    chat_id: int,
    account_id: str = "",
    fetched: int | None = None,
    cleared: int | None = None,
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
    cached_count = await chat_message_count(account_id, chat_id)
    return _page_response(request, "chat_reader", {
        "account": account,
        "cached_count": cached_count,
        "account_id": account_id,
        "chat": chat,
        "messages": messages,
        "has_more": has_more,
        "next_offset": len(messages),
        "fetched": fetched,
        "cleared": cleared,
    })


@router.post("/chat/{chat_id}/fetch")
async def admin_fetch_chat_history(
    request: Request,
    chat_id: int,
    account_id: str = Form(...),
    limit: int = Form(default=100, ge=1, le=5000),
) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    account = await _admin_account(account_id)
    if not account:
        return HTMLResponse("Аккаунт не найден", status_code=404)
    fetched = await fetch_chat_history(account, chat_id, limit=limit)
    query = urlencode({"account_id": account_id, "fetched": fetched})
    return RedirectResponse(f"/admin/chat/{chat_id}?{query}", status_code=303)


@router.post("/chat/{chat_id}/clear")
async def admin_clear_chat_cache(
    request: Request,
    chat_id: int,
    account_id: str = Form(...),
) -> Response:
    """Удалить из SQLite все сообщения выбранного чата."""
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    removed = await clear_chat_messages(account_id, chat_id)
    query = urlencode({"account_id": account_id, "cleared": removed})
    return RedirectResponse(f"/admin/chat/{chat_id}?{query}", status_code=303)


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


@router.post(
    "/login",
    response_class=HTMLResponse,
    dependencies=[Depends(limit_requests(ADMIN_LOGIN_LIMITER, "admin.login"))],
)
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


@router.get("/search", response_class=HTMLResponse)
async def admin_search(request: Request, q: str = Query(default="", max_length=120)) -> Response:
    """Фрагмент для палитры ⌘K: аккаунты (id/имя/телефон), чаты и сообщения."""
    if not _admin_session(request):
        return HTMLResponse("", status_code=401)
    chats, messages, accounts = await _search_cached(q)
    return templates.TemplateResponse(
        request=request,
        name="search_results.html",
        context={"request": request, "q": q, "chats": chats, "messages": messages, "accounts": accounts},
    )


@router.get("/stats/recommend", response_class=HTMLResponse)
async def stats_recommend(request: Request) -> Response:
    """Фрагмент «Рекомендовать время» для страницы статистики."""
    if not _admin_session(request):
        return HTMLResponse("", status_code=401)
    hourly, total = await _hourly_activity()
    return templates.TemplateResponse(
        request=request,
        name="stats_recommend.html",
        context={
            "request": request,
            "recommended": _recommend_window(hourly),
            "hourly_total": total,
        },
    )


@router.get("/accounts", response_class=HTMLResponse)
async def admin_accounts(request: Request, state: str = "all") -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    rows = [
        dict(row)
        for row in await fetchall(
            "SELECT id, phone, name, username, auth_state, created_at, last_sync "
            "FROM accounts ORDER BY created_at DESC"
        )
    ]
    authorized = sum(1 for row in rows if (row.get("auth_state") or "") == "authorized")
    counts = {"all": len(rows), "authorized": authorized, "pending": len(rows) - authorized}
    active_state = state if state in counts else "all"
    if active_state == "authorized":
        visible = [row for row in rows if (row.get("auth_state") or "") == "authorized"]
    elif active_state == "pending":
        visible = [row for row in rows if (row.get("auth_state") or "") != "authorized"]
    else:
        visible = rows

    context: dict[str, Any] = {
        "rows": visible,
        "active_state": active_state,
        "state_filters": [
            ("all", "Все", counts["all"]),
            ("authorized", "Активные", counts["authorized"]),
            ("pending", "Ожидают", counts["pending"]),
        ],
        "total": len(rows),
        "shown": len(visible),
    }
    if request.headers.get("HX-Request") == "true":
        return templates.TemplateResponse(
            request=request,
            name="accounts_table.html",
            context={"request": request, **context},
        )
    return _page_response(request, "accounts", context)


@router.get("/export/chats.csv")
async def export_chats_csv(
    request: Request,
    account_id: str = "",
    chat_type: str = Query(default="all", alias="type"),
) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    rows = await _admin_chat_rows(account_id) if account_id else []
    if chat_type != "all":
        rows = [row for row in rows if row.get("type") == chat_type]
    for row in rows:
        row["account_id"] = account_id
        row["last_message"] = row.get("last_message") or ""
    return _csv_response(
        rows,
        ["account_id", "id", "type", "title", "username", "unread", "last_message_date", "last_message"],
        "aurogram-chats.csv",
    )


@router.get("/export/accounts.csv")
async def export_accounts_csv(request: Request, state: str = "all") -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    rows = [
        dict(row)
        for row in await fetchall(
            "SELECT id, phone, name, username, auth_state, created_at, last_sync "
            "FROM accounts ORDER BY created_at DESC"
        )
    ]
    if state == "authorized":
        rows = [row for row in rows if (row.get("auth_state") or "") == "authorized"]
    elif state == "pending":
        rows = [row for row in rows if (row.get("auth_state") or "") != "authorized"]
    return _csv_response(
        rows,
        ["id", "phone", "name", "username", "auth_state", "created_at", "last_sync"],
        "aurogram-accounts.csv",
    )


@router.get("/export/channel/{channel_id}.html")
async def export_channel_html(
    request: Request,
    channel_id: int,
    account_id: str = Query(default="", max_length=64),
) -> Response:
    """Красивый самостоятельный HTML-файл с историей постов канала."""
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    if not account_id:
        return HTMLResponse("Не указан аккаунт", status_code=422)
    content = await build_channel_html(account_id, channel_id)
    return Response(
        content=content,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="aurogram-channel-{channel_id}.html"'},
    )


@router.post("/invites")
async def admin_invite_create(request: Request, code: str = Form(default="")) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    await invite_create(code or None)
    return RedirectResponse("/admin/invites", status_code=303)


@router.patch("/invites/{code_id}")
async def admin_invite_patch(
    request: Request,
    code_id: int,
    body: dict[str, Any] | None = Body(default=None),
) -> JSONResponse:
    if not _admin_session(request):
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    rows = await invite_list()
    current = next((row for row in rows if int(row["id"]) == code_id), None)
    if not current:
        return JSONResponse({"detail": "not found"}, status_code=404)
    active = bool(body.get("is_active")) if body and "is_active" in body else not bool(current["is_active"])
    updated = await invite_set_active(code_id, active)
    return JSONResponse({"status": "ok", "code": updated})


@router.delete("/invites/{code_id}")
async def admin_invite_delete_request(request: Request, code_id: int) -> JSONResponse:
    if not _admin_session(request):
        return JSONResponse({"detail": "unauthorized"}, status_code=401)
    removed = await invite_delete(code_id)
    return JSONResponse({"status": "deleted" if removed else "missing"}, status_code=200 if removed else 404)


@router.post("/invites/{code_id}/toggle")
async def admin_invite_toggle(request: Request, code_id: int) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    rows = await invite_list()
    current = next((row for row in rows if int(row["id"]) == code_id), None)
    if current:
        await invite_set_active(code_id, not bool(current["is_active"]))
    return RedirectResponse("/admin/invites", status_code=303)


@router.post("/invites/{code_id}/delete")
async def admin_invite_delete_form(request: Request, code_id: int) -> Response:
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    await invite_delete(code_id)
    return RedirectResponse("/admin/invites", status_code=303)


@router.get("/{page}", response_class=HTMLResponse)
async def admin_page(request: Request, page: str) -> Response:
    if page not in PAGES:
        return HTMLResponse("Страница не найдена", status_code=404)
    if not _admin_session(request):
        return RedirectResponse("/admin/login", status_code=303)
    return _page_response(request, page, await _page_data(page))
