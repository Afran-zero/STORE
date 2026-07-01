from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field


StoreType = Literal["RETAIL", "FOOD", "WAREHOUSE", "KITCHEN"]
StoreStatus = Literal["OPEN", "CLOSED", "INACTIVE"]


class StoreCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1)]
    type: StoreType
    location: dict[str, Any] | None = None
    openingHours: dict[str, Any] | None = None
    phone: str | None = None


class StoreUpdateRequest(BaseModel):
    name: str | None = None
    type: StoreType | None = None
    location: dict[str, Any] | None = None
    openingHours: dict[str, Any] | None = None
    phone: str | None = None


class StoreStatusUpdateRequest(BaseModel):
    status: StoreStatus


class StoreOpenCloseRequest(BaseModel):
    date: str | None = None

