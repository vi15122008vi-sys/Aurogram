from __future__ import annotations

import asyncio
import json
from typing import Any

from app.config import get_settings
from app.database import execute, fetchall


def _deliver(endpoint: str, keys: dict[str, str], payload: str, private_key: str, subject: str) -> tuple[bool, bool]:
    from pywebpush import WebPushException, webpush

    try:
        webpush(
            subscription_info={"endpoint": endpoint, "keys": keys},
            data=payload,
            vapid_private_key=private_key,
            vapid_claims={"sub": subject},
        )
        return True, False
    except WebPushException as exc:
        response = getattr(exc, "response", None)
        return False, getattr(response, "status_code", None) in {404, 410}
    except Exception:
        return False, False


async def send_push(account_id: str, message: dict[str, Any]) -> int:
    settings = get_settings()
    if not settings.vapid_public_key or not settings.vapid_private_key:
        return 0
    rows = await fetchall(
        "SELECT endpoint, keys_json FROM push_subscriptions WHERE account_id = ?",
        (account_id,),
    )
    if not rows:
        return 0
    payload = json.dumps(message, ensure_ascii=False)
    deliveries = []
    endpoints: list[str] = []
    for row in rows:
        try:
            keys = json.loads(row["keys_json"])
        except (TypeError, json.JSONDecodeError):
            continue
        endpoints.append(row["endpoint"])
        deliveries.append(
            asyncio.to_thread(
                _deliver,
                row["endpoint"],
                keys,
                payload,
                settings.vapid_private_key,
                settings.vapid_subject,
            )
        )
    results = await asyncio.gather(*deliveries)
    sent = 0
    for endpoint, (success, expired) in zip(endpoints, results):
        sent += int(success)
        if expired:
            await execute(
                "DELETE FROM push_subscriptions WHERE account_id = ? AND endpoint = ?",
                (account_id, endpoint),
            )
    return sent