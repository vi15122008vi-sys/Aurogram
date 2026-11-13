from __future__ import annotations

import csv
import io
import json
import re
import secrets
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Query, Response
from pydantic import BaseModel, Field

from app.antispam.checker import check_message
from app.antispam.log import metrics_24h, read_log
from app.antispam.settings import dump_settings, load_channel_settings
from app.antispam.stopwords import add_history, ensure_seeded, list_words, load_builtin
from app.config import get_settings
from app.telegram.client import get_client
from app.telegram.floodwait import with_floodwait
from app.database import execute, fetchall, fetchone
from app.deps import decrypt_secret, encrypt_secret, get_current_account
from app.models import (
    AntiSpamSettings,
    AntispamTestRequest,
    ChannelOut,
    StopWord,
    WordCreate,
    WordImport,
    WordPatch,
)
from app.telegram.channels import get_channel_full, list_admined_public_channels, list_channels

router = APIRouter(prefix="/channels", tags=["channels"])

async def _require_channel_admin(account: dict[str, Any], channel_id: int) -> None:
    """403, если у аккаунта нет прав администратора/владельца канала (Telethon GetParticipant)."""
    try:
        from telethon.tl.functions.channels import GetParticipantRequest

        client = await get_client(account["id"], account)
        result = await with_floodwait(
            lambda: client(GetParticipantRequest(channel=channel_id, participant="me"))
        )
        participant = result.participant
        creator = bool(getattr(participant, "creator", False)) or type(participant).__name__.endswith("Creator")
        rights = getattr(participant, "admin_rights", None)
        if not creator and rights is None:
            raise PermissionError
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail="Нужны права администратора канала",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=403, detail=f"Нет доступа к каналу: {exc}") from exc



def _validate_category(category: str) -> None:
    categories = set(load_builtin().get("categories", {})) | {"custom"}
    if category not in categories:
        raise HTTPException(status_code=422, detail="Неизвестная категория стоп-слова")


async def _channel_settings(account_id: str, channel_id: int) -> AntiSpamSettings:
    row = await fetchone(
        "SELECT antispam_json FROM channel_settings WHERE account_id = ? AND channel_id = ?",
        (account_id, channel_id),
    )
    return load_channel_settings(row["antispam_json"] if row else None)


@router.get("", response_model=list[ChannelOut])
async def channels(
    account: dict[str, Any] = Depends(get_current_account),
) -> list[ChannelOut]:
    return await list_channels(account)


@router.get("/admined", response_model=list[ChannelOut])
async def admined_channels(
    account: dict[str, Any] = Depends(get_current_account),
) -> list[ChannelOut]:
    return await list_admined_public_channels(account)


@router.get("/{channel_id}")
async def channel(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    return await get_channel_full(account, channel_id)


class IntegrationUpdate(BaseModel):
    """Секреты приходят в открытом виде и шифруются перед записью."""

    discord_webhook: Optional[str] = Field(default=None, max_length=512)
    vk_token: Optional[str] = Field(default=None, max_length=512)
    vk_group_id: Optional[str] = Field(default=None, max_length=32)


def _reveal(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return decrypt_secret(value)
    except HTTPException:
        return None


def _masked(value: Optional[str]) -> Optional[str]:
    revealed = _reveal(value)
    return f"…{revealed[-4:]}" if revealed else None


async def _integration_row(account_id: str, channel_id: int) -> Optional[dict[str, Any]]:
    row = await fetchone(
        "SELECT * FROM channel_integrations WHERE account_id = ? AND channel_id = ?",
        (account_id, channel_id),
    )
    return dict(row) if row else None


@router.get("/{channel_id}/integrations")
async def get_integrations(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    row = await _integration_row(account["id"], channel_id)
    if not row:
        return {
            "discord_webhook_set": False,
            "discord_webhook_hint": None,
            "vk_token_set": False,
            "vk_token_hint": None,
            "vk_group_id": None,
        }
    return {
        "discord_webhook_set": bool(row.get("discord_webhook_enc")),
        "discord_webhook_hint": _masked(row.get("discord_webhook_enc")),
        "vk_token_set": bool(row.get("vk_token_enc")),
        "vk_token_hint": _masked(row.get("vk_token_enc")),
        "vk_group_id": row.get("vk_group_id"),
    }


@router.put("/{channel_id}/integrations")
async def save_integrations(
    channel_id: int,
    payload: IntegrationUpdate,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    await _require_channel_admin(account, channel_id)
    row = await _integration_row(account["id"], channel_id) or {}
    webhook = row.get("discord_webhook_enc")
    vk_token = row.get("vk_token_enc")
    vk_group = row.get("vk_group_id")

    # Пустая строка — осознанная очистка, None — «не трогать».
    if payload.discord_webhook is not None:
        value = payload.discord_webhook.strip()
        webhook = encrypt_secret(value) if value else None
    if payload.vk_token is not None:
        value = payload.vk_token.strip()
        vk_token = encrypt_secret(value) if value else None
    if payload.vk_group_id is not None:
        group = payload.vk_group_id.strip().lstrip("-")
        vk_group = group or None

    await execute(
        """INSERT INTO channel_integrations
               (account_id, channel_id, discord_webhook_enc, vk_token_enc, vk_group_id, updated_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(account_id, channel_id) DO UPDATE SET
               discord_webhook_enc = excluded.discord_webhook_enc,
               vk_token_enc = excluded.vk_token_enc,
               vk_group_id = excluded.vk_group_id,
               updated_at = excluded.updated_at""",
        (account["id"], channel_id, webhook, vk_token, vk_group),
    )
    return await get_integrations(channel_id, account)


@router.get("/{channel_id}/antispam", response_model=AntiSpamSettings)
async def get_antispam_settings(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> AntiSpamSettings:
    return await _channel_settings(account["id"], channel_id)


@router.put("/{channel_id}/antispam", response_model=AntiSpamSettings)
async def update_antispam_settings(
    channel_id: int,
    payload: AntiSpamSettings,
    account: dict[str, Any] = Depends(get_current_account),
) -> AntiSpamSettings:
    await execute(
        """
        INSERT INTO channel_settings (account_id, channel_id, antispam_json)
        VALUES (?, ?, ?)
        ON CONFLICT(account_id, channel_id) DO UPDATE SET
            antispam_json = excluded.antispam_json,
            updated_at = datetime('now')
        """,
        (account["id"], channel_id, dump_settings(payload)),
    )
    return payload


@router.post("/{channel_id}/antispam/test")
async def test_antispam(
    channel_id: int,
    payload: AntispamTestRequest,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    settings = await _channel_settings(account["id"], channel_id)
    message = type(
        "TestMessage",
        (),
        {"message": payload.text, "raw_text": payload.text, "sender_id": secrets.randbits(63)},
    )()
    verdict = await check_message(
        message,
        settings,
        account_id=account["id"],
        channel_id=channel_id,
    )
    return verdict.model_dump()


@router.get("/{channel_id}/stopwords", response_model=list[StopWord])
async def stopwords(
    channel_id: int,
    category: str | None = None,
    q: str | None = Query(default=None, max_length=100),
    enabled: bool | None = None,
    account: dict[str, Any] = Depends(get_current_account),
) -> list[StopWord]:
    settings = await _channel_settings(account["id"], channel_id)
    await ensure_seeded(account["id"], channel_id, settings.level.value)
    return await list_words(account["id"], channel_id, category=category, q=q, enabled=enabled)


@router.get("/{channel_id}/stopwords/builtin")
async def builtin_stopwords(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    settings = await _channel_settings(account["id"], channel_id)
    data = load_builtin()
    return {
        "version": data.get("version", 1),
        "level": settings.level.value,
        "categories": data.get("categories", {}),
    }


@router.get("/{channel_id}/stopwords/export")
async def export_stopwords(
    channel_id: int,
    format: Literal["json", "txt"] = Query(default="json"),
    account: dict[str, Any] = Depends(get_current_account),
) -> Response:
    settings = await _channel_settings(account["id"], channel_id)
    await ensure_seeded(account["id"], channel_id, settings.level.value)
    words = await list_words(account["id"], channel_id)
    if format == "json":
        content = json.dumps(
            {
                "version": 1,
                "words": [word.model_dump(mode="json") for word in words],
            },
            ensure_ascii=False,
            indent=2,
        )
        media_type = "application/json"
    else:
        content = "\n".join(word.word for word in words if word.enabled)
        if content:
            content += "\n"
        media_type = "text/plain"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="stopwords-{channel_id}.{format}"'},
    )


@router.post("/{channel_id}/stopwords", response_model=StopWord, status_code=201)
async def create_stopword(
    channel_id: int,
    payload: WordCreate,
    account: dict[str, Any] = Depends(get_current_account),
) -> StopWord:
    word = payload.word.strip()
    if not word or len(word) > 200:
        raise HTTPException(status_code=422, detail="Длина стоп-слова должна быть от 1 до 200 символов")
    category = payload.category if payload.category != "custom" else "custom"
    _validate_category(category)
    if payload.is_regex:
        try:
            re.compile(word)
        except re.error as exc:
            raise HTTPException(status_code=422, detail=f"Некорректное регулярное выражение: {exc}") from exc
    await execute(
        """
        INSERT OR IGNORE INTO antispam_stopwords
        (account_id, channel_id, word, category, enabled, is_regex, is_builtin, created_by)
        VALUES (?, ?, ?, ?, 1, ?, 0, ?)
        """,
        (account["id"], channel_id, word, category, int(payload.is_regex), account.get("username")),
    )
    row = await fetchone(
        "SELECT * FROM antispam_stopwords WHERE account_id = ? AND channel_id = ? AND word = ? AND category = ?",
        (account["id"], channel_id, word, category),
    )
    if row is None:
        raise HTTPException(status_code=500, detail="Не удалось сохранить стоп-слово")
    await add_history(account["id"], channel_id, "add", word, account.get("username"))
    return StopWord(
        id=row["id"], word=row["word"], category=row["category"], enabled=bool(row["enabled"]),
        is_regex=bool(row["is_regex"]), is_builtin=bool(row["is_builtin"]),
        created_at=row["created_at"], created_by=row["created_by"],
    )


@router.patch("/{channel_id}/stopwords/{word_id}", response_model=StopWord)
async def update_stopword(
    channel_id: int,
    word_id: int,
    payload: WordPatch,
    account: dict[str, Any] = Depends(get_current_account),
) -> StopWord:
    row = await fetchone(
        "SELECT * FROM antispam_stopwords WHERE id = ? AND account_id = ? AND channel_id = ?",
        (word_id, account["id"], channel_id),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Стоп-слово не найдено")
    updates = payload.model_dump(exclude_unset=True)
    if row["is_builtin"] and any(key in updates for key in ("word", "category")):
        raise HTTPException(status_code=409, detail="Встроенное стоп-слово можно только включить или отключить")
    if "word" in updates:
        updates["word"] = str(updates["word"]).strip()
        if not updates["word"] or len(updates["word"]) > 200:
            raise HTTPException(status_code=422, detail="Недопустимая длина стоп-слова")
    if "category" in updates:
        _validate_category(str(updates["category"]))
    if updates:
        columns = ", ".join(f"{key} = ?" for key in updates)
        values = [int(value) if key == "enabled" else value for key, value in updates.items()]
        await execute(
            f"UPDATE antispam_stopwords SET {columns} WHERE id = ? AND account_id = ? AND channel_id = ?",
            (*values, word_id, account["id"], channel_id),
        )
        await add_history(account["id"], channel_id, "update", str(row["word"]), account.get("username"))
    updated = await fetchone("SELECT * FROM antispam_stopwords WHERE id = ?", (word_id,))
    return StopWord(
        id=updated["id"], word=updated["word"], category=updated["category"],
        enabled=bool(updated["enabled"]), is_regex=bool(updated["is_regex"]),
        is_builtin=bool(updated["is_builtin"]), created_at=updated["created_at"],
        created_by=updated["created_by"],
    )


@router.delete("/{channel_id}/stopwords/{word_id}", status_code=204)
async def delete_stopword(
    channel_id: int,
    word_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> None:
    row = await fetchone(
        "SELECT word, is_builtin FROM antispam_stopwords WHERE id = ? AND account_id = ? AND channel_id = ?",
        (word_id, account["id"], channel_id),
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Стоп-слово не найдено")
    if row["is_builtin"]:
        raise HTTPException(status_code=409, detail="Встроенное стоп-слово нельзя удалить, только отключить")
    await execute(
        "DELETE FROM antispam_stopwords WHERE id = ? AND account_id = ? AND channel_id = ?",
        (word_id, account["id"], channel_id),
    )
    await add_history(account["id"], channel_id, "delete", row["word"], account.get("username"))


@router.post("/{channel_id}/stopwords/import")
async def import_stopwords(
    channel_id: int,
    payload: WordImport,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, int]:
    _validate_category(payload.category)
    if len(payload.data) > 1_000_000:
        raise HTTPException(status_code=413, detail="Файл импорта слишком большой")
    try:
        if payload.format == "json":
            content = json.loads(payload.data)
            entries = content if isinstance(content, list) else content.get("words", [])
        elif payload.format == "csv":
            entries = [row[0] for row in csv.reader(io.StringIO(payload.data)) if row]
        else:
            entries = payload.data.splitlines()
    except (json.JSONDecodeError, AttributeError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Не удалось разобрать импорт") from exc
    if not isinstance(entries, list):
        raise HTTPException(status_code=422, detail="Импорт должен содержать список слов")
    if len(entries) > 10_000:
        raise HTTPException(status_code=413, detail="В одном импорте допускается не более 10000 слов")
    channel_settings = await _channel_settings(account["id"], channel_id)
    await ensure_seeded(account["id"], channel_id, channel_settings.level.value)
    normalized: dict[tuple[str, str], tuple[bool, bool]] = {}
    for entry in entries:
        if isinstance(entry, dict):
            word = str(entry.get("word", "")).strip()
            category = str(entry.get("category") or payload.category)
            enabled = bool(entry.get("enabled", True))
            is_regex = bool(entry.get("is_regex", word.startswith("re:")))
        else:
            word = str(entry).strip()
            category = payload.category
            enabled = True
            is_regex = word.startswith("re:")
        if not word or len(word) > 200:
            continue
        _validate_category(category)
        if is_regex:
            try:
                re.compile(word[3:] if word.startswith("re:") else word)
            except re.error as exc:
                raise HTTPException(status_code=422, detail="Импорт содержит некорректное регулярное выражение") from exc
        normalized[(word, category)] = (enabled, is_regex)

    before_words = await list_words(account["id"], channel_id)
    before = {(word.word, word.category) for word in before_words}
    for (word, category), (enabled, is_regex) in normalized.items():
        await execute(
            """
            INSERT OR IGNORE INTO antispam_stopwords
            (account_id, channel_id, word, category, enabled, is_regex, is_builtin, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (
                account["id"], channel_id, word, category, int(enabled),
                int(is_regex), account.get("username"),
            ),
        )
    after_words = await list_words(account["id"], channel_id)
    after = {(word.word, word.category) for word in after_words}
    imported = len(after - before)
    if imported:
        await add_history(account["id"], channel_id, "import", str(imported), account.get("username"))
    return {"imported": imported, "skipped": len(normalized) - imported}


@router.get("/{channel_id}/antispam/log")
async def antispam_log(
    channel_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    account: dict[str, Any] = Depends(get_current_account),
) -> list[dict[str, Any]]:
    return await read_log(account["id"], channel_id, limit)


@router.get("/{channel_id}/antispam/metrics")
async def antispam_metrics(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, int]:
    return await metrics_24h(account["id"], channel_id)


class WelcomePayload(BaseModel):
    text: str = Field(default="", max_length=1024)
    enabled: bool = True
    photo_data_url: Optional[str] = None


@router.get("/{channel_id}/access")
async def channel_access(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Есть ли у аккаунта права администратора канала (для скрытия админ-UI)."""
    try:
        await _require_channel_admin(account, channel_id)
        return {"is_admin": True}
    except HTTPException:
        return {"is_admin": False}


@router.get("/{channel_id}/welcome")
async def get_welcome(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    await _require_channel_admin(account, channel_id)
    row = await fetchone(
        "SELECT text, photo_path, enabled, updated_at FROM channel_welcome WHERE account_id = ? AND channel_id = ?",
        (account["id"], channel_id),
    )
    if not row:
        return {"text": "", "enabled": True, "has_photo": False, "updated_at": None}
    return {
        "text": row["text"] or "",
        "enabled": bool(row["enabled"]),
        "has_photo": bool(row["photo_path"]),
        "updated_at": row["updated_at"],
    }


@router.get("/{channel_id}/welcome/photo")
async def get_welcome_photo(
    channel_id: int,
    account: dict[str, Any] = Depends(get_current_account),
) -> FileResponse:
    await _require_channel_admin(account, channel_id)
    row = await fetchone(
        "SELECT photo_path FROM channel_welcome WHERE account_id = ? AND channel_id = ?",
        (account["id"], channel_id),
    )
    path = row["photo_path"] if row else None
    if not path or not Path(path).exists():
        raise HTTPException(status_code=404, detail="Фото приветствия не найдено")
    return FileResponse(path, headers={"Cache-Control": "private, max-age=60"})


@router.put("/{channel_id}/welcome")
async def save_welcome(
    channel_id: int,
    payload: WelcomePayload,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    await _require_channel_admin(account, channel_id)
    photo_path: Optional[str] = None
    if payload.photo_data_url:
        import base64
        import re as _re

        match = _re.match(r"^data:image/(png|jpe?g|webp);base64,(.+)$", payload.photo_data_url)
        if not match:
            raise HTTPException(status_code=422, detail="Ожидается data-url картинки")
        raw = base64.b64decode(match.group(2)[: 3_000_000])
        directory = Path(get_settings().media_dir) / account["id"] / "welcome"
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / f"{channel_id}.img"
        target.write_bytes(raw)
        photo_path = str(target)
    await execute(
        """INSERT INTO channel_welcome (account_id, channel_id, text, photo_path, enabled, updated_at)
           VALUES (?, ?, ?, COALESCE(?, NULL), ?, datetime('now'))
           ON CONFLICT(account_id, channel_id) DO UPDATE SET
               text = excluded.text,
               photo_path = COALESCE(excluded.photo_path, channel_welcome.photo_path),
               enabled = excluded.enabled,
               updated_at = datetime('now')""",
        (account["id"], channel_id, payload.text.strip(), photo_path, 1 if payload.enabled else 0),
    )
    return await get_welcome(channel_id, account)


class ScheduleMove(BaseModel):
    schedule_at: str


@router.patch("/{channel_id}/posts/{post_id}/schedule")
async def move_scheduled_post(
    channel_id: int,
    post_id: int,
    payload: ScheduleMove,
    account: dict[str, Any] = Depends(get_current_account),
) -> dict[str, Any]:
    """Перенос даты отложенного поста (Telethon EditMessageRequest + schedule_date)."""
    from datetime import datetime, timezone

    from telethon.tl.functions.messages import EditMessageRequest

    await _require_channel_admin(account, channel_id)
    try:
        target = datetime.fromisoformat(payload.schedule_at.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Ожидается ISO-дата") from exc
    if target.tzinfo is None:
        target = target.replace(tzinfo=timezone.utc)
    if target <= datetime.now(timezone.utc):
        raise HTTPException(status_code=422, detail="Дата должна быть в будущем")

    client = await get_client(account["id"], account)
    try:
        message = await with_floodwait(lambda: client.get_messages(channel_id, ids=post_id))
        text = getattr(message, "message", "") or ""
        entity = await client.get_input_entity(channel_id)
        await with_floodwait(
            lambda: client(
                EditMessageRequest(peer=entity, id=post_id, message=text, schedule_date=target)
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Не удалось перенести пост: {exc}") from exc
    return {"status": "ok", "post_id": post_id, "schedule_at": target.isoformat()}
