"""Файловые логи для админки: error.log и warn.log с ротацией.

ВАЖНО про масштабирование: `RotatingFileHandler` не безопасен между процессами.
Сейчас backend работает в одном процессе (supervisord → один uvicorn), поэтому
этого достаточно. Если появится несколько воркеров uvicorn/gunicorn, нужно
перейти на `ConcurrentRotatingFileHandler` из пакета `concurrent-log-handler`
(или писать в stdout и собирать логи на уровне контейнера).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Any

MAX_BYTES = 5 * 1024 * 1024
BACKUP_COUNT = 3

_loggers: dict[str, logging.Logger] = {}


def _cache_dir() -> Path:
    from app.config import get_settings

    return Path(get_settings().cache_dir)


def rotating_logger(filename: str) -> logging.Logger:
    """JSON-логгер с ротацией 5 МБ × 3 файла."""
    if filename in _loggers:
        return _loggers[filename]

    path = _cache_dir() / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger(f"aurogram.{path.stem}")
    logger.setLevel(logging.INFO)
    logger.propagate = False
    if not logger.handlers:
        handler = RotatingFileHandler(path, maxBytes=MAX_BYTES, backupCount=BACKUP_COUNT, encoding="utf-8")
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
    _loggers[filename] = logger
    return logger


def log_file(level: str) -> Path:
    return _cache_dir() / ("warn.log" if level == "WARN" else "error.log")


def emit_entry(  # noqa: PLR0913
    *,
    level: str,
    method: str,
    path: str,
    error_type: str,
    message: str = "",
    query: str = "",
    trace: str = "",
    source: str = "http",
) -> None:
    """One-line JSON: warn → warn.log, всё остальное → error.log."""
    entry: dict[str, Any] = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "level": level,
        "source": source,
        "method": method,
        "path": path,
        "query": query,
        "type": error_type,
        "message": message[:500],
        "trace": trace[-4000:],
    }
    try:
        rotating_logger("warn.log" if level == "WARN" else "error.log").info(
            json.dumps(entry, ensure_ascii=False)
        )
    except Exception as exc:  # логирование не должно ронять обработку
        logging.getLogger("aurogram.errors").warning("log write failed: %s", exc)


def read_tail(limit: int = 50) -> list[dict[str, Any]]:
    """Последние записи из error.log и warn.log, свежие сверху (для админки)."""
    from collections import deque

    entries: list[dict[str, Any]] = []
    for filename in ("error.log", "warn.log"):
        path = _cache_dir() / filename
        if not path.exists():
            continue
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for line in deque(handle, maxlen=200):
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except ValueError:
                    continue
    entries.sort(key=lambda item: str(item.get("ts", "")), reverse=True)
    return entries[:limit]
