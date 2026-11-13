from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.deps import get_current_account, get_optional_account
from app.invites import is_valid as invite_is_valid, mark_used as mark_invite_used
from app.models import (
    RecoverPasswordRequest,
    RegisterKeyRequest,
    SendCodeRequest,
    SignInRequest,
)
from app.ratelimit import (
    QR_LIMITER,
    RECOVER_LIMITER,
    SEND_CODE_LIMITER,
    SIGN_IN_LIMITER,
    limit_requests,
)
from app.telegram import auth as telegram_auth

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_auth_cookie(response: Response, request: Request, token: str | None) -> None:
    if token:
        forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",", 1)[0].strip()
        is_secure = request.url.scheme == "https" or forwarded_proto == "https"
        response.set_cookie(
            "auth_token",
            token,
            httponly=True,
            secure=is_secure,
            samesite="none" if is_secure else "lax",
            max_age=60 * 60 * 24 * 30,
            path="/",
        )


def _without_token(result: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in result.items() if key != "token"}


def _normalize_phone(value: str) -> str:
    """«+7 999 123-45-67» и «+79991234567» — один и тот же аккаунт."""
    return re.sub(r"[\s\-()]", "", (value or "").strip())


def _auth_payload(result: dict[str, Any]) -> dict[str, Any]:
    """Отдаём токен и в теле ответа.

    Cookie живёт на домене API; для веб-приложения на другом домене
    (aurogram.pages.dev → aurogram.dpdns.org) это сторонняя cookie,
    которую Safari/Chrome/Brave блокируют. Тогда клиент сохраняет токен
    и ходит с `Authorization: Bearer`, не завися от политики cookie.
    """
    payload = dict(result)
    token = payload.get("token")
    if isinstance(token, str) and token:
        payload["token"] = token
    return payload


@router.get("/countries")
async def countries() -> list[dict[str, Any]]:
    return [country.model_dump() for country in telegram_auth.list_countries()]


@router.post("/register-key")
async def register_key(
    payload: RegisterKeyRequest,
    request: Request,
    response: Response,
) -> dict[str, Any]:
    result = await telegram_auth.register_key(payload.api_id, payload.api_hash)
    _set_auth_cookie(response, request, result.get("token"))
    return _auth_payload(result)


@router.post("/send-code", dependencies=[Depends(limit_requests(SEND_CODE_LIMITER, "auth.send_code"))])
@router.post("/send_code", include_in_schema=False, dependencies=[Depends(limit_requests(SEND_CODE_LIMITER, "auth.send_code"))])
async def send_code(
    payload: SendCodeRequest,
    request: Request,
    response: Response,
    account: dict[str, Any] | None = Depends(get_optional_account),
) -> dict[str, Any]:
    invite_code = payload.invite_code
    if not await invite_is_valid(invite_code):
        raise HTTPException(
            status_code=403,
            detail="Неверный или отозванный код приглашения",
        )

    result = await telegram_auth.send_code(
        phone=_normalize_phone(payload.phone),
        force_method=payload.force_method,
        account=account,
        api_id=payload.api_id,
        api_hash=payload.api_hash,
        device_id=request.headers.get("x-device-id", "default"),
    )
    _set_auth_cookie(response, request, result.get("token"))
    await mark_invite_used(invite_code, _normalize_phone(payload.phone))
    return _auth_payload(result)


@router.post("/sign-in", dependencies=[Depends(limit_requests(SIGN_IN_LIMITER, "auth.sign_in"))])
@router.post("/sign_in", include_in_schema=False, dependencies=[Depends(limit_requests(SIGN_IN_LIMITER, "auth.sign_in"))])
async def sign_in(
    payload: SignInRequest,
    request: Request,
    response: Response,
    account: dict[str, Any] | None = Depends(get_optional_account),
) -> dict[str, Any]:
    normalized_phone = _normalize_phone(payload.phone)
    if account and account.get("phone") not in {"", normalized_phone}:
        raise HTTPException(status_code=403, detail="Номер не совпадает с текущей сессией")
    result = await telegram_auth.sign_in(
        phone=normalized_phone,
        phone_code_hash=payload.phone_code_hash,
        code=payload.code,
        password=payload.password,
        account_id=account["id"] if account else None,
        device_id=request.headers.get("x-device-id", "default"),
    )
    _set_auth_cookie(response, request, result.get("token"))
    return _auth_payload(result)


@router.post("/qr", dependencies=[Depends(limit_requests(QR_LIMITER, "auth.qr"))])
async def start_qr(
    request: Request,
    response: Response,
    account: dict[str, Any] | None = Depends(get_optional_account),
) -> dict[str, Any]:
    result = await telegram_auth.start_qr(account)
    _set_auth_cookie(response, request, result.get("token"))
    return _auth_payload(result)


@router.get("/qr/status")
async def qr_status(
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    return _without_token(await telegram_auth.check_qr(account["id"]))


@router.post("/recover-password", dependencies=[Depends(limit_requests(RECOVER_LIMITER, "auth.recover"))])
async def recover_password(payload: RecoverPasswordRequest) -> dict[str, Any]:
    return await telegram_auth.recover_password(payload.phone)


@router.get("/me")
async def me(account: dict[str, Any] = Depends(get_current_account)) -> dict[str, Any]:
    return {
        "id": account["id"],
        "name": account["name"],
        "phone": account["phone"],
        "username": account["username"],
        "auth_state": account["auth_state"],
    }


@router.post("/logout", status_code=204)
async def logout(
    payload: dict[str, bool] | None = None,
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    await telegram_auth.logout(account, purge_cache=bool((payload or {}).get("purge_cache")))
    response = Response(status_code=204)
    response.delete_cookie("auth_token", path="/")
    return response

