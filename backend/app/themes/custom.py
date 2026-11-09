from __future__ import annotations

import json
from typing import Any

from app.database import execute, fetchall


def _contrast_on(accent: str, dark: bool) -> str:
    h = accent.lstrip("#")
    if len(h) != 6:
        return "#FAFAFA" if dark else "#18181B"
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return "#18181B" if luminance > 0.6 else "#FAFAFA"


def build_custom(name: str, accent: str, dark: bool = True) -> dict[str, Any]:
    surface = "#0A0A0B" if dark else "#F7F7F8"
    return {
        "id": f"custom:{name}",
        "name": name,
        "dark": dark,
        "tokens": {
            "surface": surface,
            "surfaceRaised": "#141416" if dark else "#FFFFFF",
            "surfaceOverlay": "rgba(10,10,11,0.72)" if dark else "rgba(255,255,255,0.72)",
            "border": "rgba(255,255,255,0.06)" if dark else "rgba(0,0,0,0.08)",
            "onSurface": "#FAFAFA" if dark else "#18181B",
            "onSurfaceMuted": "#A1A1AA" if dark else "#71717A",
            "onSurfaceSubtle": "#71717A" if dark else "#A1A1AA",
            "accent": accent,
            "accentHover": accent,
            "ghostIndicator": "#A78BFA",
            "success": "#22C55E",
            "warning": "#F59E0B",
            "error": "#EF4444",
            "onAccent": _contrast_on(accent, dark),
        },
    }


async def save_custom(account_id: str | None, theme: dict[str, Any]) -> int:
    return await execute(
        "INSERT INTO custom_themes (account_id, name, tokens_json) VALUES (?, ?, ?)",
        (account_id, theme["name"], json.dumps(theme, ensure_ascii=False)),
    )


async def list_custom(account_id: str | None) -> list[dict[str, Any]]:
    rows = await fetchall(
        "SELECT id, name, tokens_json FROM custom_themes WHERE account_id IS ? OR account_id = ? ORDER BY id DESC",
        (account_id, account_id),
    )
    out = []
    for r in rows:
        try:
            out.append(json.loads(r["tokens_json"]))
        except Exception:
            pass
    return out
