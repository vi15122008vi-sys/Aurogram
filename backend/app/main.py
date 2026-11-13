from __future__ import annotations

import asyncio
import logging
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.staticfiles import StaticFiles

from app.admin.routes import router as admin_router
from app.api.accounts import router as accounts_router
from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.bot import router as bot_router
from app.api.bots import router as bots_router
from app.api.calls import router as calls_router
from app.api.channels import router as channels_router
from app.api.chats import router as chats_router
from app.api.editor import router as editor_router
from app.api.health import router as health_router
from app.api.messages import router as messages_router
from app.api.privacy import router as privacy_router
from app.api.notifications import router as notifications_router
from app.api.profile import router as profile_router
from app.api.textstyles import router as textstyles_router
from app.api.themes import router as themes_router
from app.api.widgets import router as widgets_router
from app.config import get_settings
from app.database import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("aurogram.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await init_db()
    from app.security import audit_secrets, ensure_secret_key

    if not ensure_secret_key():
        log.warning(
            "SECRET_KEY непригоден: ключи аккаунтов и токены ботов сохранить не удастся "
            "(эндпоинты вернут 503)"
        )
    try:
        await audit_secrets()
    except Exception as exc:  # аудит не должен мешать старту
        log.warning("security audit failed: %s", exc)
    from app.telegram.listener import main as listener_main

    listener_task = asyncio.create_task(listener_main(), name="telegram-listener")
    try:
        yield
    finally:
        listener_task.cancel()
        try:
            await listener_task
        except asyncio.CancelledError:
            pass
        from app.telegram.client import _clients, drop_client

        for account_id in {key.split(":", 1)[0] for key in tuple(_clients)}:
            await drop_client(account_id)


app = FastAPI(
    title="Aurogram API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
CORS_ORIGINS = [
    # ВАЖНО: "*" здесь запрещён — при allow_credentials=True браузер отклонит
    # ответ, и фронтенд покажет «не удалось связаться с сервером».
    origin
    for origin in dict.fromkeys([
        *settings.cors_origin_list(),
        # Прод-домен API и страница админки — один origin, первый запрос с него тоже CORS.
        "https://aurogram.dpdns.org",
        # Веб-приложение на Pages: отдельный origin, ходит с Bearer-токеном.
        "https://aurogram.pages.dev",
        "http://localhost:5173",
        "http://localhost:4173",
    ])
    if origin and origin != "*"
]

# Превью-деплои Cloudflare Pages живут на <hash>.aurogram.pages.dev —
# их origin не совпадает с прод-доменом, иначе CORS рвёт /api/chats.
CORS_ORIGIN_REGEX = r"https://[a-z0-9-]+\.aurogram\.pages\.dev"

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Auth-Token", "X-Admin-Action-Token", "X-Device-Id"],
    expose_headers=["Retry-After"],
)
logging.getLogger("aurogram.cors").info(
    "CORS allow_origins=%s regex=%s", CORS_ORIGINS, CORS_ORIGIN_REGEX
)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key or secrets.token_urlsafe(32),
    same_site="lax",
    https_only=False,
)

for api_router in (
    auth_router,
    accounts_router,
    chats_router,
    messages_router,
    privacy_router,
    channels_router,
    bots_router,
    editor_router,
    textstyles_router,
    themes_router,
    notifications_router,
    bot_router,
    ai_router,
    calls_router,
    widgets_router,
    profile_router,
    health_router,
):
    app.include_router(api_router, prefix="/api")

app.include_router(admin_router)
static_dir = Path(__file__).parent / "admin" / "static"
app.mount("/admin/static", StaticFiles(directory=static_dir), name="admin-static")


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": "Aurogram API", "docs": "/api/docs", "health": "/api/health"}


@app.get("/api", include_in_schema=False)
async def api_root() -> dict[str, str]:
    return {"service": "Aurogram API", "docs": "/api/docs", "health": "/api/health"}
