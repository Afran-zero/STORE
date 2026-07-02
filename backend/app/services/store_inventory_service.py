from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.repositories.store_inventory_repository import StoreInventoryRepository


class StoreInventoryService:
    def __init__(self, db: Any) -> None:
        self.repo = StoreInventoryRepository(db)

    async def list_for_store(self, *, business_id: str, store_id: str) -> List[Dict[str, Any]]:
        return await self.repo.list_by_store(business_id=business_id, store_id=store_id)

    async def get(self, *, business_id: str, store_id: str, ingredient_id: str) -> Dict[str, Any]:
        return await self.repo.get_one(business_id=business_id, store_id=store_id, ingredient_id=ingredient_id)

    async def set_stock(self, *, business_id: str, store_id: str, ingredient_id: str, quantity: float, minimumStock: float | None = None) -> Dict[str, Any]:
        return await self.repo.upsert(business_id=business_id, store_id=store_id, ingredient_id=ingredient_id, quantity=quantity, minimumStock=minimumStock)

    async def list_low_stock(self, *, business_id: str, store_id: str) -> List[Dict[str, Any]]:
        rows = await self.repo.list_by_store(business_id=business_id, store_id=store_id)
        flagged = []
        for row in rows:
            quantity = float(row.get("quantity") or 0)
            minimum = float(row.get("minimumStock") or 0)
            if minimum > 0 and quantity <= minimum:
                flagged.append(row)
        return flagged

    async def allocate(self, *, business_id: str, store_id: str, ingredient_id: str, quantity: float) -> Dict[str, Any]:
        return await self.repo.upsert(business_id=business_id, store_id=store_id, ingredient_id=ingredient_id, allocated=quantity)

    async def try_consume(self, *, business_id: str, store_id: str, ingredient_id: str, amount: float) -> Dict[str, Any]:
        return await self.repo.atomic_decrement(business_id=business_id, store_id=store_id, ingredient_id=ingredient_id, amount=amount)

    async def ensure_row(self, *, business_id: str, store_id: str, ingredient_id: str) -> Dict[str, Any]:
        existing = await self.repo.get_one(business_id=business_id, store_id=store_id, ingredient_id=ingredient_id)
        if existing:
            return existing
        return await self.repo.upsert(business_id=business_id, store_id=store_id, ingredient_id=ingredient_id, quantity=0)
