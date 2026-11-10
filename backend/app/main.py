from __future__ import annotations

import asyncio
import logging
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware
from starlette.staticfiles import StaticFiles

from app.admin.routes import router as admin_router
from app.api.accounts import router as accounts_router
from app.api.auth import router as auth_router
from app.api.bots import router as bots_router
from app.api.channels import router as channels_router
from app.api.chats import router as chats_router
from app.api.editor import router as editor_router
from app.api.health import router as health_router
from app.api.messages import router as messages_router
from app.api.notifications import router as notifications_router
from app.api.textstyles import router as textstyles_router
from app.api.themes import router as themes_router
from app.config import get_settings
from app.database import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("aurogram.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await init_db()
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

        for account_id in tuple(_clients):
            await drop_client(account_id)


app = FastAPI(
    title="Aurogram API",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys([*settings.cors_origin_list(), "https://aurogram.pages.dev"])),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Auth-Token", "X-Admin-Action-Token"],
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
    channels_router,
    bots_router,
    editor_router,
    textstyles_router,
    themes_router,
    notifications_router,
    health_router,
):
    app.include_router(api_router, prefix="/api")

app.include_router(admin_router)
static_dir = Path(__file__).parent / "admin" / "static"
app.mount("/admin/static", StaticFiles(directory=static_dir), name="admin-static")


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse(url="/admin", status_code=307)


@app.get("/api", include_in_schema=False)
async def api_root() -> dict[str, str]:
    return {"service": "Aurogram API", "docs": "/api/docs", "health": "/api/health"}
