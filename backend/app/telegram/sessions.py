from __future__ import annotations

import os
from pathlib import Path

from app.config import get_settings


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
