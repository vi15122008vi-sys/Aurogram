"""HTML-виджеты Студии: сервер отдаёт самостоятельную страницу для WebView.

Один шаблон на два режима:
- `kind=poll` — интерактивный опрос с подсчётом голосов;
- `kind=game` — крестики-нолики против простого ИИ.
Страница автономна (без внешних ресурсов) и адаптируется под ширину экрана.
"""

from __future__ import annotations

import html
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/widgets", tags=["widgets"])
# Публичный роутер: Telegram открывает /widgets/{slug} без префикса /api.
public_router = APIRouter(prefix="/widgets", tags=["widgets"])

MAX_TITLE = 80
ACCENTS = {"blue", "indigo", "violet", "amber", "green"}

STYLES = """
:root { color-scheme: dark; --accent:#6366F1; }
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin:0; padding:0; }
body { min-height:100vh; display:flex; align-items:center; justify-content:center;
  background: radial-gradient(ellipse at 20% 0%, rgba(42,171,238,0.18), transparent 24rem),
              radial-gradient(ellipse at 90% 10%, rgba(139,92,246,0.16), transparent 22rem), #0A0A0C;
  color:#FAFAFA; font-family:-apple-system,"Segoe UI",system-ui,sans-serif; padding:12px; }
.widget { width:100%; max-width:520px; padding:16px; border-radius:22px;
  background:linear-gradient(145deg, rgba(255,255,255,0.06), rgba(24,24,27,0.55));
  border:1px solid rgba(255,255,255,0.06);
  box-shadow:0 18px 44px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.08);
  -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%); }
.head { display:flex; align-items:center; gap:10px; margin-bottom:14px; }
.emoji { font-size:22px; line-height:1; }
h1 { font-size:15px; margin:0; font-weight:600; letter-spacing:-0.01em; }
.sub { margin:2px 0 0; font-size:10px; text-transform:uppercase; letter-spacing:0.14em; color:#A1A1AA; }
.option, .cell { border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.04);
  color:#FAFAFA; border-radius:14px; padding:12px; font-size:13px; cursor:pointer; width:100%; text-align:left; }
.option:active { transform: scale(0.98); }
.bar { height:6px; margin-top:8px; border-radius:999px; background:rgba(255,255,255,0.08); overflow:hidden; }
.bar > i { display:block; height:100%; width:0; border-radius:999px; background:var(--accent); transition:width .25s ease; }
.option .row { display:flex; justify-content:space-between; gap:10px; align-items:center; }
.count { font-variant-numeric:tabular-nums; font-size:11px; color:#A1A1AA; }
.board { display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; }
.cell { display:grid; place-items:center; aspect-ratio:1; font-size:30px; font-weight:600; }
.status { margin-top:12px; font-size:12px; color:#A1A1AA; min-height:18px; }
button.reset { margin-top:10px; border:0; border-radius:999px; padding:8px 14px;
  background:var(--accent); color:#fff; font-size:12px; font-weight:600; }
"""


def _preset(accent: str) -> str:
    colors = {
        "blue": "#2AABEE",
        "indigo": "#6366F1",
        "violet": "#8B5CF6",
        "amber": "#F59E0B",
        "green": "#22C55E",
    }
    return colors.get(accent, "#6366F1")


POLL_SCRIPT = """
const options = Array.from(document.querySelectorAll('.option'));
const votes = options.map(() => 0);
options.forEach((option, index) => {
  option.addEventListener('click', () => {
    votes[index] += 1;
    const total = votes.reduce((a, b) => a + b, 0);
    options.forEach((item, i) => {
      const share = total ? Math.round((votes[i] * 100) / total) : 0;
      item.querySelector('.bar > i').style.width = share + '%';
      item.querySelector('.count').textContent = share + '% · ' + votes[i];
    });
  });
});
"""

GAME_SCRIPT = """
const board = document.getElementById('board');
const status = document.getElementById('status');
const cells = Array.from(board.querySelectorAll('.cell'));
let state = Array(9).fill('');
let human = 'X';

function lines() {
  return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
}
function winner(player) {
  return lines().some(([a,b,c]) => state[a] === player && state[b] === player && state[c] === player);
}
function render() {
  cells.forEach((cell, index) => { cell.textContent = state[index]; });
}
function aiMove() {
  const empty = state.map((value, index) => value ? -1 : index).filter((index) => index >= 0);
  if (!empty.length) return;
  for (const [a,b,c] of lines()) {
    const line = [a,b,c];
    const mine = line.filter((i) => state[i] === 'O');
    const free = line.filter((i) => !state[i]);
    if (mine.length === 2 && free.length === 1) { state[free[0]] = 'O'; return; }
  }
  for (const [a,b,c] of lines()) {
    const line = [a,b,c];
    const theirs = line.filter((i) => state[i] === 'X');
    const free = line.filter((i) => !state[i]);
    if (theirs.length === 2 && free.length === 1) { state[free[0]] = 'O'; return; }
  }
  state[empty[Math.floor(Math.random() * empty.length)]] = 'O';
}
function finish() {
  if (winner(human)) { status.textContent = 'Вы победили 🎉'; return true; }
  if (winner('O')) { status.textContent = 'Победил ИИ'; return true; }
  if (!state.includes('')) { status.textContent = 'Ничья'; return true; }
  return false;
}
cells.forEach((cell, index) => {
  cell.addEventListener('click', () => {
    if (state[index] || finish()) return;
    state[index] = human;
    render();
    if (finish()) return;
    aiMove();
    render();
    finish();
  });
});
document.getElementById('reset').addEventListener('click', () => {
  state = Array(9).fill('');
  status.textContent = 'Ваш ход: X';
  render();
});
"""


@router.get("/{widget_id}.html", response_class=HTMLResponse)
async def widget_page(
    widget_id: str,
    title: str = Query(default="Виджет", max_length=MAX_TITLE),
    kind: Literal["poll", "game"] = Query(default="poll"),
    accent: str = Query(default="indigo"),
) -> HTMLResponse:
    safe_id = "".join(char for char in widget_id if char.isalnum() or char in "-_")[:40] or "widget"
    safe_title = html.escape(title.strip() or "Виджет")
    emoji = "🎮" if kind == "game" else "📊"
    subtitle = "Игра" if kind == "game" else "Опрос"

    if kind == "game":
        content = """
      <div class="board" id="board">
        <button class="cell" type="button"></button><button class="cell" type="button"></button><button class="cell" type="button"></button>
        <button class="cell" type="button"></button><button class="cell" type="button"></button><button class="cell" type="button"></button>
        <button class="cell" type="button"></button><button class="cell" type="button"></button><button class="cell" type="button"></button>
      </div>
      <p class="status" id="status">Ваш ход: X</p>
      <button class="reset" id="reset" type="button">Заново</button>
      <script>__SCRIPT__</script>""".replace("__SCRIPT__", GAME_SCRIPT)
    else:
        content = """
      <div style="display:grid; gap:10px">
        <button class="option" type="button"><span class="row"><span>Вариант 1</span><span class="count">0%</span></span><span class="bar"><i></i></span></button>
        <button class="option" type="button"><span class="row"><span>Вариант 2</span><span class="count">0%</span></span><span class="bar"><i></i></span></button>
        <button class="option" type="button"><span class="row"><span>Вариант 3</span><span class="count">0%</span></span><span class="bar"><i></i></span></button>
      </div>
      <script>__SCRIPT__</script>""".replace("__SCRIPT__", POLL_SCRIPT)

    document = f"""<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{safe_title}</title>
<style>{STYLES}</style>
</head>
<body data-widget="{safe_id}">
  <div class="widget" style="--accent:{_preset(accent)}">
    <div class="head">
      <span class="emoji">{emoji}</span>
      <div>
        <h1>{safe_title}</h1>
        <p class="sub">{subtitle} · Aurogram Studio</p>
      </div>
    </div>
    {content}
  </div>
</body>
</html>"""
    return HTMLResponse(
        content=document,
        headers={"Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff"},
    )


async def _stored_html(slug: str) -> str:
    from app.database import fetchone

    row = await fetchone("SELECT html FROM widgets WHERE slug = ?", (slug,))
    if not row:
        raise HTTPException(status_code=404, detail="Виджет не найден")
    return row["html"]


@router.get("/{slug}", response_class=HTMLResponse)
async def get_stored_widget(slug: str) -> HTMLResponse:
    """HTML сгенерированного виджета по UUID-slug."""
    return _widget_response(await _stored_html(slug))


@public_router.get("/{slug}", response_class=HTMLResponse)
async def get_stored_widget_public(slug: str) -> HTMLResponse:
    return _widget_response(await _stored_html(slug))


def _widget_response(html: str) -> HTMLResponse:
    return HTMLResponse(
        content=html,
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
        },
    )
