from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.models import TextStyleConvert
from app.textstyles.converter import convert, detect, list_styles, strip_styles

router = APIRouter(prefix="/textstyles", tags=["textstyles"])


class TextInput(BaseModel):
    text: str


@router.get("/styles")
async def styles() -> list[dict]:
    return list_styles()


@router.post("/convert")
async def convert_text(payload: TextStyleConvert) -> dict[str, str]:
    return {"text": convert(payload.text, payload.style), "style": payload.style}


@router.post("/detect")
async def detect_styles(payload: TextInput) -> dict[str, list[str]]:
    return {"styles": detect(payload.text)}


@router.post("/strip")
async def strip_text(payload: TextInput) -> dict[str, str]:
    return {"text": strip_styles(payload.text)}