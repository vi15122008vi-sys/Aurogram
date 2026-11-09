from __future__ import annotations

import hmac
import csv
import io
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates

from app.antispam.log import read_log
from app.cache.manager import connect_cache
from app.cache.index import get_listener_heartbeat
from app.cache.stats import global_stats, growth_30d
from app.config import get_settings
from app.database import fetchall

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
    if page == "chats":
        accounts = await fetchall("SELECT id, name FROM accounts ORDER BY created_at DESC")
        rows: list[dict[str, Any]] = []
        for account in accounts:
            conn = await connect_cache(account["id"])
            try:
                cur = await conn.execute(
                    "SELECT id, type, title, last_message_date, last_message_id FROM cached_chats ORDER BY last_message_date DESC LIMIT 100"
                )
                rows.extend(
                    {**dict(row), "account_name": account["name"]}
                    for row in await cur.fetchall()
                )
            finally:
                await conn.close()
        return {"rows": rows}
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