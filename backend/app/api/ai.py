from __future__ import annotations

from fastapi import APIRouter, status

from app.core.exceptions import AppException


router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("")
async def ai_stub() -> None:
    raise AppException(code="AI_NOT_IMPLEMENTED", message="AI module is a stub in Module 1", status_code=status.HTTP_501_NOT_IMPLEMENTED)
