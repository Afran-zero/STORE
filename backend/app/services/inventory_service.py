from __future__ import annotations

from typing import Any

from app.repositories.inventory_repository import InventoryRepository
from app.services.base import BaseService


class InventoryService(BaseService):
    def __init__(self, repository: InventoryRepository | None = None) -> None:
        super().__init__(repository or InventoryRepository(None))

    async def placeholder(self, data: Any = None, *, message: str = "Inventory module placeholder") -> dict[str, Any]:
        return await super().placeholder(data, message=message)
