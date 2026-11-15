from __future__ import annotations

import asyncio
import logging
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from telethon.errors import AuthKeyUnregisteredError, SessionRevokedError
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
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
from app.api.settings import router as settings_router
from app.api.stickers import router as stickers_router
from app.api.users import router as users_router
from app.api.textstyles import router as textstyles_router
from app.api.themes import router as themes_router
from app.api.widgets import public_router as widgets_public_router
from app.api.widgets import router as widgets_router
from app.config import get_settings
from app.database import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("aurogram.api")
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Пересборка контейнера не чистит /app/sessions: убираем дубли до старта listener.
    try:
        from app.telegram.sessions import cleanup_old_sessions

        cleanup_old_sessions(keep_per_account=1)
    except Exception as exc:  # очистка не должна мешать запуску
        log.warning("session cleanup failed: %s", exc)
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

# allow_origin_regex намеренно убран: остаётся только явный список CORS_ORIGINS.
# Превью-деплои (<hash>.aurogram.pages.dev) теперь НЕ допускаются — если они нужны,
# добавляйте их в CORS_ORIGINS через переменную окружения.
def _error_log_path() -> Path:
    from app.applog import log_file

    return log_file("ERROR")


def error_logger() -> logging.Logger:
    """Логгер ошибок (error.log, 5 МБ × 3). WARN пишется отдельно — см. applog."""
    from app.applog import rotating_logger

    return rotating_logger("error.log")


def emit_error_entry(  # noqa: PLR0913
    *,
    level: str,
    method: str,
    path: str,
    query: str = "",
    error_type: str,
    message: str = "",
    trace: str = "",
    source: str = "http",
) -> None:
    """WARN уходит в warn.log, ERROR — в error.log (см. app/applog.py)."""
    from app.applog import emit_entry

    emit_entry(
        level=level,
        method=method,
        path=path,
        query=query,
        error_type=error_type,
        message=message,
        trace=trace,
        source=source,
    )


def write_error_log(request: Request, exc: BaseException) -> None:
    import traceback

    emit_error_entry(
        level="ERROR",
        method=request.method,
        path=request.url.path,
        query=str(request.url.query),
        error_type=type(exc).__name__,
        message=str(exc),
        trace="".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
    )


WARN_STATUSES = {401, 403, 422, 429}


@app.middleware("http")
async def error_logging_middleware(request: Request, call_next):  # noqa: ANN001
    """Логирует необработанные исключения до того, как их отдаст CORS-слой.

    Добавлен ДО CORSMiddleware, поэтому CORS остаётся самым внешним middleware
    и заголовки попадают даже в 500-ответ.
    """
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001
        write_error_log(request, exc)
        raise
    if response.status_code in WARN_STATUSES:
        emit_error_entry(
            level="WARN",
            method=request.method,
            path=request.url.path,
            query=str(request.url.query),
            error_type=f"HTTP {response.status_code}",
            message=response.headers.get("retry-after", "") or "",
        )
    return response


@app.exception_handler(AuthKeyUnregisteredError)
async def auth_key_unregistered_handler(request: Request, exc: AuthKeyUnregisteredError) -> JSONResponse:
    write_error_log(request, exc)
    return _session_expired_response()


@app.exception_handler(SessionRevokedError)
async def session_revoked_handler(request: Request, exc: SessionRevokedError) -> JSONResponse:
    write_error_log(request, exc)
    return _session_expired_response()


def _session_expired_response() -> JSONResponse:
    response = JSONResponse(
        status_code=401,
        content={"detail": "Сессия истекла. Войдите заново"},
        headers={"Access-Control-Allow-Credentials": "true"},
    )
    response.delete_cookie("auth_token", path="/")
    return response


app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key or secrets.token_urlsafe(32),
    same_site="lax",
    https_only=False,
)

# CORS добавлен последним: он оборачивает все остальные middleware,
# поэтому даже 500 получают корректные CORS-заголовки.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Retry-After"],
)
logging.getLogger("aurogram.cors").info("CORS allow_origins=%s", CORS_ORIGINS)

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
    users_router,
    settings_router,
    stickers_router,
    health_router,
):
    app.include_router(api_router, prefix="/api")

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Любая необработанная ошибка должна вернуться через CORSMiddleware.

    Иначе FastAPI отдаёт «голый» 500 без Access-Control-Allow-Origin,
    и браузер показывает это как CORS/network error.
    """
    logging.getLogger("aurogram.errors").exception(
        "unhandled error on %s %s", request.method, request.url.path
    )
    write_error_log(request, exc)
    origin = request.headers.get("origin", "")
    headers = (
        {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true"}
        if origin in CORS_ORIGINS
        else {}
    )
    return JSONResponse({"detail": "Внутренняя ошибка сервера"}, status_code=500, headers=headers)


app.include_router(widgets_public_router)
app.include_router(admin_router)
static_dir = Path(__file__).parent / "admin" / "static"
app.mount("/admin/static", StaticFiles(directory=static_dir), name="admin-static")


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": "Aurogram API", "docs": "/api/docs", "health": "/api/health"}


@app.get("/api", include_in_schema=False)
async def api_root() -> dict[str, str]:
    return {"service": "Aurogram API", "docs": "/api/docs", "health": "/api/health"}
