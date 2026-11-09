from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import AnyHttpUrl, BaseModel, Field

from app.database import execute, fetchall, fetchone
from app.deps import get_current_account
from app.notifications import send_push

router = APIRouter(prefix="/notifications", tags=["notifications"])
ALLOWED_PUSH_HOSTS = (
    "fcm.googleapis.com",
    "push.services.mozilla.com",
    "updates.push.services.mozilla.com",
    "web.push.apple.com",
)


class SubscriptionInput(BaseModel):
    endpoint: AnyHttpUrl
    keys: dict[str, str]


class SubscriptionDelete(BaseModel):
    endpoint: AnyHttpUrl


def _validate_subscription(payload: SubscriptionInput) -> tuple[str, dict[str, str]]:
    endpoint = str(payload.endpoint)
    parsed = urlparse(endpoint)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not any(host == allowed or host.endswith(f".{allowed}") for allowed in ALLOWED_PUSH_HOSTS):
        raise HTTPException(status_code=422, detail="Push endpoint недопустим")
    keys = payload.keys
    if not keys.get("p256dh") or not keys.get("auth") or len(keys) > 4:
        raise HTTPException(status_code=422, detail="Некорректные ключи push subscription")
    if any(len(value) > 512 for value in keys.values()):
        raise HTTPException(status_code=422, detail="Push key слишком длинный")
    return endpoint, keys


@router.get("/subscriptions")
async def subscription_count(
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, int]:
    rows = await fetchall("SELECT id FROM push_subscriptions WHERE account_id = ?", (account["id"],))
    return {"count": len(rows)}


@router.post("/subscriptions", status_code=201)
async def subscribe(
    payload: SubscriptionInput,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, bool]:
    endpoint, keys = _validate_subscription(payload)
    existing = await fetchone("SELECT account_id FROM push_subscriptions WHERE endpoint = ?", (endpoint,))
    if existing and existing["account_id"] not in {None, account["id"]}:
        raise HTTPException(status_code=409, detail="Push subscription уже связана с другим аккаунтом")
    if existing is None:
        rows = await fetchall("SELECT id FROM push_subscriptions WHERE account_id = ?", (account["id"],))
        if len(rows) >= 10:
            raise HTTPException(status_code=429, detail="Достигнут лимит push-устройств")
    await execute(
        """
        INSERT INTO push_subscriptions (account_id, endpoint, keys_json)
        VALUES (?, ?, ?)
        ON CONFLICT(endpoint) DO UPDATE SET account_id = excluded.account_id, keys_json = excluded.keys_json
        """,
        (account["id"], endpoint, json.dumps(keys)),
    )
    return {"subscribed": True}


@router.delete("/subscriptions", status_code=204)
async def unsubscribe(
    payload: SubscriptionDelete,
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    await execute(
        "DELETE FROM push_subscriptions WHERE account_id = ? AND endpoint = ?",
        (account["id"], str(payload.endpoint)),
    )
    return Response(status_code=204)


@router.post("/test")
async def test_push(
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, int]:
    sent = await send_push(
        account["id"],
        {"title": "Aurogram", "body": "Тестовое уведомление", "url": "/settings"},
    )
    return {"sent": sent}