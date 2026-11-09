from __future__ import annotations

import os
from pathlib import Path

from app.config import get_settings


def sessions_root() -> Path:
    root = Path(get_settings().sessions_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def session_path(account_id: str) -> Path:
    safe = "".join(c for c in account_id if c.isalnum() or c in "-_")
    path = sessions_root() / f"{safe}.session"
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
