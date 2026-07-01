from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, Field


class StoreCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1)]
    type: str | None = None
    location: dict[str, Any] | None = None
    openingHours: dict[str, Any] | None = None
    phone: str | None = None


class StoreUpdateRequest(BaseModel):
    name: str | None = None
    type: str | None = None
    location: dict[str, Any] | None = None
    openingHours: dict[str, Any] | None = None
    phone: str | None = None


class StoreStatusUpdateRequest(BaseModel):
    status: str


class StoreOpenCloseRequest(BaseModel):
    date: str | None = None

