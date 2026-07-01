from __future__ import annotations

from typing import Any, Literal

from app.models.base import TimestampedDocument


StoreStatus = Literal["OPEN", "CLOSED", "INACTIVE"]


class StoreDocument(TimestampedDocument):
    businessId: str
    name: str
    type: str | None = None
    status: StoreStatus = "CLOSED"
    location: dict[str, Any] | None = None
    openingHours: dict[str, Any] | None = None
    managerId: str | None = None
    phone: str | None = None
    isActive: bool = True
