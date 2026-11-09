from __future__ import annotations

import io
from typing import Optional

from PIL import Image, ImageDraw, ImageFont


def render_table_image(rows: list[list[str]], title: str = "") -> bytes:
    pad = 16
    col_w = 160
    row_h = 28
    cols = max((len(r) for r in rows), default=1)
    width = pad * 2 + cols * col_w
    height = pad * 2 + (len(rows) + (1 if title else 0)) * row_h + 8
    img = Image.new("RGB", (width, height), "#0A0A0B")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    y = pad
    if title:
        draw.text((pad, y), title, fill="#F7F7F8", font=font)
        y += row_h
    for r in rows:
        x = pad
        for cell in r:
            draw.rectangle([x, y, x + col_w - 4, y + row_h - 4], outline="#FFFFFF22")
            draw.text((x + 6, y + 6), str(cell)[:28], fill="#E4E4E7", font=font)
            x += col_w
        y += row_h
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def maybe_table_from_markdown(md: str) -> Optional[bytes]:
    lines = [ln.strip() for ln in (md or "").splitlines() if "|" in ln]
    if len(lines) < 2:
        return None
    rows = []
    for ln in lines:
        if set(ln.replace("|", "").replace("-", "").replace(":", "").strip()) == set():
            continue
        cells = [c.strip() for c in ln.strip("|").split("|")]
        rows.append(cells)
    if len(rows) < 2:
        return None
    return render_table_image(rows, title="Таблица")
