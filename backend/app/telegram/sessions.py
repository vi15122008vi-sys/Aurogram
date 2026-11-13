from __future__ import annotations

import logging
import re

import os
from pathlib import Path

from app.config import get_settings

log = logging.getLogger("aurogram.sessions")


def sessions_root() -> Path:
    root = Path(get_settings().sessions_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def session_path(account_id: str, device_id: str = "default") -> Path:
    safe_account = "".join(c for c in account_id if c.isalnum() or c in "-_")
    safe_device = "".join(c for c in device_id if c.isalnum() or c in "-_")[:80] or "default"
    path = sessions_root() / f"session_user_{safe_account}_device_{safe_device}.session"
    # Adopt pre-device session files on first access so existing logins survive the migration.
    legacy = sessions_root() / f"{safe_account}.session"
    if safe_device == "default" and not path.exists() and legacy.exists():
        try:
            os.replace(legacy, path)
            for suffix in ("-journal", "-wal", "-shm"):
                old_sidecar, new_sidecar = Path(str(legacy) + suffix), Path(str(path) + suffix)
                if old_sidecar.exists():
                    os.replace(old_sidecar, new_sidecar)
        except OSError:
            return legacy
    return path


def secure_session_file(path: Path) -> None:
    if path.exists():
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass


def delete_session(account_id: str) -> None:
    path = session_path(account_id)
    for candidate in (path, Path(str(path) + "-journal")):
        if candidate.exists():
            try:
                candidate.unlink()
            except OSError:
                pass


_SESSION_NAME = re.compile(r"^session_user_(?P<account>.+?)_device_[^/\\]+?\.session$")


def cleanup_old_sessions(keep_per_account: int = 1) -> list[Path]:
    """Удаляет лишние файлы сессий, оставляя самый свежий на каждый аккаунт.

    Пересборка контейнера не трогает /app/sessions, и там могут накопиться
    дубли одного и того же аккаунта — Listener путается и Telegram отвечает
    SessionRevokedError. Чистим при старте: по одному (самому новому) файлу
    на аккаунт; сессии разных аккаунтов не затрагиваются.
    """
    root = sessions_root()
    grouped: dict[str, list[Path]] = {}
    for path in root.glob("session_user_*device_*.session"):
        match = _SESSION_NAME.match(path.name)
        account = match.group("account") if match else path.stem
        grouped.setdefault(account, []).append(path)

    removed: list[Path] = []
    for account, paths in grouped.items():
        if len(paths) <= keep_per_account:
            continue
        paths.sort(key=lambda item: item.stat().st_mtime, reverse=True)
        for stale in paths[keep_per_account:]:
            try:
                stale.unlink(missing_ok=True)
                for suffix in ("-journal", "-wal", "-shm"):
                    Path(str(stale) + suffix).unlink(missing_ok=True)
                removed.append(stale)
            except OSError as exc:
                log.warning("не удалось удалить сессию %s: %s", stale.name, exc)

    if removed:
        log.warning(
            "Удалены старые сессии, оставлена только одна: %s",
            ", ".join(path.name for path in removed),
        )
    return removed
