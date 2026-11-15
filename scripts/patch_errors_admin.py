from __future__ import annotations

import pathlib

root = pathlib.Path(r"C:\Users\vi151\OneDrive\Desktop\Aurogram")

# ============ 1. database.py: абсолютный путь и лог пути ============
db = root / "backend/app/database.py"
src = db.read_text(encoding="utf-8")

src = src.replace(
    '''    explicit = (os.environ.get("DB_PATH") or os.environ.get("DATABASE_PATH") or "").strip()
    if explicit:
        path = Path(explicit)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path''',
    '''    explicit = (os.environ.get("DB_PATH") or os.environ.get("DATABASE_PATH") or "").strip()
    if explicit:
        path = Path(explicit)
        if not path.is_absolute():
            # относительный путь в контейнере = нестабильное место, делаем абсолютным
            path = (Path("/app") / path).resolve() if os.name != "nt" else path.resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        return path''',
)
if "meta db:" not in src:
    src = src.replace(
        '''async def init_db() -> None:''',
        '''async def init_db() -> None:
    log.info("meta db: %s", meta_db_path())''',
    )
db.write_text(src, encoding="utf-8")
print("database.py: absolute path + startup log")

# ============ 2. main.py: error.log + middleware ============
m = root / "backend/app/main.py"
src = m.read_text(encoding="utf-8")

if "error.log" not in src:
    helper = '''def _error_log_path() -> Path:
    from app.config import get_settings

    return Path(get_settings().cache_dir) / "error.log"


def write_error_log(request: Request, exc: BaseException) -> None:
    """Пишет ошибку в /app/cache_data/error.log (JSON-строки для админки)."""
    import json
    import traceback
    from datetime import datetime, timezone

    try:
        path = _error_log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "method": request.method,
            "path": request.url.path,
            "query": str(request.url.query),
            "type": type(exc).__name__,
            "message": str(exc)[:500],
            "trace": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))[-4000:],
        }
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\\n")
    except Exception as log_exc:  # логирование не должно ронять обработку
        logging.getLogger("aurogram.errors").warning("error.log write failed: %s", log_exc)


@app.middleware("http")
async def error_logging_middleware(request: Request, call_next):  # noqa: ANN001
    """Логирует необработанные исключения до того, как их отдаст CORS-слой.

    Добавлен ДО CORSMiddleware, поэтому CORS остаётся самым внешним middleware
    и заголовки попадают даже в 500-ответ.
    """
    try:
        return await call_next(request)
    except Exception as exc:  # noqa: BLE001
        write_error_log(request, exc)
        raise


'''
    anchor = 'app.add_middleware(\n    SessionMiddleware,'
    idx = src.index(anchor)
    # вставляем хелперы до Session/CORS (CORS добавляется позже и остаётся внешним)
    src = src[:idx] + helper + src[idx:]

    # 500-хендлер тоже пишет в файл
    src = src.replace(
        '''    origin = request.headers.get("origin", "")''',
        '''    write_error_log(request, exc)
    origin = request.headers.get("origin", "")''',
    )
    m.write_text(src, encoding="utf-8")
    print("main.py: error.log + logging middleware")

# ============ 3. admin: страница «Ошибки» ============
r = root / "backend/app/admin/routes.py"
src = r.read_text(encoding="utf-8")

if '"errors"' not in src:
    src = src.replace(
        '    "logs": "Журнал",',
        '    "logs": "Журнал",\n    "errors": "Ошибки",',
    )
    src = src.replace(
        '''    "logs": '<path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>',''',
        '''    "logs": '<path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    "errors": '<path d="M12 4 3 20h18z"/><path d="M12 10v4"/><path d="M12 17h.01"/>',''',
    )
    src = src.replace(
        '''    if page == "invites":''',
        '''    if page == "errors":
        import json
        from pathlib import Path

        from app.config import get_settings

        path = Path(get_settings().cache_dir) / "error.log"
        entries: list[dict[str, Any]] = []
        if path.exists():
            lines = path.read_text(encoding="utf-8", errors="replace").strip().splitlines()[-200:]
            for line in reversed(lines):
                try:
                    entries.append(json.loads(line))
                except ValueError:
                    continue
                if len(entries) >= 50:
                    break
        return {"entries": entries, "log_path": str(path)}

    if page == "invites":''',
    )
    r.write_text(src, encoding="utf-8")
    print("admin: errors page data")

# шаблон
tmpl = root / "backend/app/admin/templates/errors.html"
tmpl.write_text('''{% extends "base.html" %}{% block content %}
<section class="mx-auto max-w-6xl">
  <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div>
      <p class="font-mono text-[10px] uppercase tracking-[0.16em] text-rose-300/70">OPS / ERRORS</p>
      <h1 class="mt-1 text-2xl font-semibold text-zinc-100">Ошибки бэкенда</h1>
      <p class="mt-1 text-xs text-zinc-500">Последние 50 необработанных исключений из <code class="font-mono">{{ log_path }}</code>.</p>
    </div>
    <a href="/admin/errors" class="admin-btn">Обновить</a>
  </div>

  {% if entries %}
  <div class="overflow-x-auto rounded-xl border border-white/10">
    <table class="w-full text-left text-sm">
      <thead class="bg-white/5 text-[11px] uppercase tracking-wide text-zinc-500">
        <tr><th class="p-3">Время (UTC)</th><th class="p-3">Тип</th><th class="p-3">Запрос</th><th class="p-3">Сообщение</th><th class="p-3">Стектрейс</th></tr>
      </thead>
      <tbody>
        {% for row in entries %}
        <tr class="border-t border-white/5 align-top">
          <td class="whitespace-nowrap p-3 font-mono text-xs text-zinc-400">{{ row.ts }}</td>
          <td class="p-3"><span class="rounded-full bg-rose-400/10 px-2 py-0.5 text-[11px] text-rose-300">{{ row.type }}</span></td>
          <td class="p-3 font-mono text-xs text-zinc-300">{{ row.method }} {{ row.path }}</td>
          <td class="max-w-xs p-3 text-xs text-zinc-300">{{ row.message }}</td>
          <td class="p-3">
            <details><summary class="cursor-pointer text-[11px] text-indigo-300">показать</summary>
              <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-zinc-950/70 p-2 font-mono text-[10px] leading-4 text-zinc-400">{{ row.trace }}</pre>
            </details>
          </td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>
  {% else %}
  <p class="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">Ошибок не зафиксировано.</p>
  {% endif %}
</section>
{% endblock %}
''', encoding="utf-8")
print("admin: errors.html")

# ============ 4. auth.py: 401 + delete_cookie на мёртвой сессии ============
a = root / "backend/app/api/auth.py"
src = a.read_text(encoding="utf-8")
if "_session_expired_response" not in src:
    src = src.replace(
        '''router = APIRouter(prefix="/auth", tags=["auth"])''',
        '''router = APIRouter(prefix="/auth", tags=["auth"])


def _session_expired_response() -> JSONResponse:
    """401 + удаление cookie: фронт не должен зацикливаться на мёртвом токене."""
    response = JSONResponse(status_code=401, content={"detail": "Сессия истекла. Войдите заново"})
    response.delete_cookie("auth_token", path="/")
    return response''',
    )
    if "JSONResponse" not in src.split("\n")[5]:
        src = src.replace("from fastapi.responses import", "from fastapi.responses import JSONResponse,") if "from fastapi.responses import" in src else src
        if "from fastapi.responses import JSONResponse" not in src:
            src = src.replace("from fastapi import", "from fastapi.responses import JSONResponse\nfrom fastapi import", 1)
    a.write_text(src, encoding="utf-8")
    print("auth.py: session expired helper")
