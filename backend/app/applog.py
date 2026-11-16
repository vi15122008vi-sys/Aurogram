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


TAIL_BYTES = 50 * 1024


def _tail_lines(path: Path, max_bytes: int = TAIL_BYTES) -> list[str]:
    """Последние строки файла без чтения целиком: seek в конец, читаем хвост."""
    with path.open("rb") as handle:
        handle.seek(0, 2)
        size = handle.tell()
        handle.seek(max(0, size - max_bytes))
        data = handle.read()
    lines = data.decode("utf-8", errors="replace").splitlines()
    if size > max_bytes and lines:
        lines = lines[1:]  # первая строка могла обрезаться посередине
    return lines


def read_tail(
    limit: int = 50,
    *,
    level: str | None = None,
    source: str | None = None,
) -> list[dict[str, Any]]:
    """Последние записи логов с фильтрацией по уровню и источнику.

    level="WARN" читает только warn.log, level="ERROR" — только error.log,
    без level — оба файла (свежие сверху).
    """
    normalized = (level or "").upper()
    files = ["warn.log"] if normalized == "WARN" else ["error.log"] if normalized == "ERROR" else ["error.log", "warn.log"]
    entries: list[dict[str, Any]] = []
    for filename in files:
        path = _cache_dir() / filename
        if not path.exists():
            continue
        for line in _tail_lines(path):
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if source and str(entry.get("source") or "http") != source:
                continue
            entries.append(entry)
    entries.sort(key=lambda item: str(item.get("ts", "")), reverse=True)
    return entries[:limit]


def log_file_for(level: str | None) -> Path:
    """Путь к файлу, который соответствует выбранному уровню (для подсказки в UI)."""
    return _cache_dir() / ("warn.log" if (level or "").upper() == "WARN" else "error.log")
