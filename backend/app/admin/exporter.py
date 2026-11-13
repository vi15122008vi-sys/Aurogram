"""Экспорт канала в самостоятельный HTML-файл (Liquid Glass, без зависимостей)."""

from __future__ import annotations

import base64
import html
from datetime import datetime
from typing import Any, Optional

from app.cache.manager import connect_cache
from app.telegram.media import thumb_path

MAX_EMBED_BYTES = 400_000
WATERMARK = "Powered by Aurogram"

STYLES = """
:root { color-scheme: dark; --canvas:#0A0A0C; --surface:rgba(255,255,255,0.05); --ink:#FAFAFA; --muted:#A1A1AA; --accent:#6366F1; }
* { box-sizing: border-box; }
body { margin:0; padding:32px 16px 56px; background:
    radial-gradient(ellipse at 10% -10%, rgba(99,102,241,0.18), transparent 40rem),
    radial-gradient(ellipse at 95% 6%, rgba(139,92,246,0.12), transparent 34rem),
    linear-gradient(160deg, #0A0A0C 0%, #111114 60%, #0A0A0C 100%);
  color:var(--ink); font-family:"Inter Tight","Segoe UI",system-ui,-apple-system,sans-serif; -webkit-font-smoothing:antialiased; }
.wrap { max-width:760px; margin:0 auto; }
header { display:flex; align-items:center; gap:14px; padding:18px; border-radius:26px;
  background:linear-gradient(145deg, rgba(255,255,255,0.06), rgba(24,24,27,0.58));
  border:1px solid rgba(255,255,255,0.05); box-shadow:0 18px 48px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.08);
  -webkit-backdrop-filter:blur(24px) saturate(180%); backdrop-filter:blur(24px) saturate(180%); }
.avatar { width:52px; height:52px; border-radius:50%; flex:0 0 auto; display:grid; place-items:center;
  font-weight:700; font-size:18px; color:#fff; background:linear-gradient(135deg,var(--accent),#8B5CF6); }
h1 { margin:0; font-size:20px; letter-spacing:-0.01em; }
.sub { margin:3px 0 0; font-size:12px; color:var(--muted); font-family:ui-monospace,monospace; }
.stats { margin-left:auto; text-align:right; }
.stats b { display:block; font-size:20px; font-family:ui-monospace,monospace; }
.stats span { font-size:11px; color:var(--muted); }
.posts { margin-top:18px; display:grid; gap:12px; }
.post { padding:16px; border-radius:20px; background:linear-gradient(145deg, rgba(255,255,255,0.055), rgba(24,24,27,0.55));
  border:1px solid rgba(255,255,255,0.05); box-shadow:0 12px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.07);
  -webkit-backdrop-filter:blur(20px) saturate(170%); backdrop-filter:blur(20px) saturate(170%); }
.post time { display:block; font-size:11px; color:var(--muted); font-family:ui-monospace,monospace; margin-bottom:8px; }
.post p { margin:0; font-size:14px; line-height:1.6; white-space:pre-wrap; word-break:break-word; }
.post img { display:block; width:100%; max-height:360px; object-fit:cover; margin-top:12px; border-radius:16px; }
.badge { display:inline-block; margin-top:10px; padding:3px 9px; border-radius:999px; font-size:10px;
  text-transform:uppercase; letter-spacing:0.12em; color:var(--accent); background:rgba(99,102,241,0.12); }
.empty { padding:40px; text-align:center; color:var(--muted); font-size:14px; }
footer { margin-top:26px; text-align:center; font-size:11px; color:#71717A; }
footer a { color:#A5B4FC; text-decoration:none; }
@media print { body { background:#fff; color:#111; } .post, header { background:#fff; border-color:#e4e4e7; box-shadow:none; -webkit-backdrop-filter:none; backdrop-filter:none; } .sub, time, footer { color:#52525B; } }
"""


def _esc(value: Optional[str]) -> str:
    return html.escape(value or "", quote=True)


def _format_date(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)
    return parsed.strftime("%d.%m.%Y · %H:%M")


def _embed_thumb(account_id: str, chat_id: int, message_id: int) -> Optional[str]:
    try:
        path = thumb_path(account_id, chat_id, message_id)
    except OSError:
        return None
    if not path.is_file() or path.stat().st_size > MAX_EMBED_BYTES:
        return None
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


async def build_channel_html(account_id: str, channel_id: int, limit: int = 120) -> str:
    conn = await connect_cache(account_id)
    try:
        cursor = await conn.execute("SELECT id, title, username FROM cached_chats WHERE id = ? LIMIT 1", (channel_id,))
        chat_row = await cursor.fetchone()
        cursor = await conn.execute(
            """SELECT id, text, date, media_type FROM cached_messages
               WHERE chat_id = ? AND deleted = 0
               ORDER BY date ASC LIMIT ?""",
            (channel_id, max(1, min(limit, 1000))),
        )
        posts: list[dict[str, Any]] = [dict(row) for row in await cursor.fetchall()]
    finally:
        await conn.close()

    title = (chat_row["title"] if chat_row else None) or f"Канал {channel_id}"
    username = chat_row["username"] if chat_row else None
    initial = (title.strip()[:1] or "A").upper()
    exported_at = datetime.now().strftime("%d.%m.%Y %H:%M")

    cards: list[str] = []
    for post in posts:
        media = _embed_thumb(account_id, channel_id, int(post["id"])) if post.get("media_type") else None
        body = _esc(post.get("text"))
        text_html = f"<p>{body}</p>" if body else ""
        image_html = f'<img src="{media}" alt="Медиа поста" loading="lazy">' if media else ""
        badge = f'<span class="badge">{_esc(post.get("media_type"))}</span>' if post.get("media_type") and not media else ""
        cards.append(
            f'<article class="post"><time>{_format_date(post.get("date"))}</time>{text_html}{image_html}{badge}</article>'
        )

    posts_html = "\n".join(cards) if cards else '<div class="empty">В канале пока нет постов в кэше.</div>'
    subtitle = f"@{_esc(username)}" if username else f"ID {channel_id}"
    return f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{_esc(title)} · Aurogram</title>
<style>{STYLES}</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="avatar">{initial}</div>
    <div>
      <h1>{_esc(title)}</h1>
      <p class="sub">{subtitle} · экспорт {exported_at}</p>
    </div>
    <div class="stats"><b>{len(posts)}</b><span>постов</span></div>
  </header>
  <section class="posts">
    {posts_html}
  </section>
  <footer>{WATERMARK} · <a href="https://aurogram.dpdns.org">aurogram.dpdns.org</a></footer>
</div>
</body>
</html>"""
