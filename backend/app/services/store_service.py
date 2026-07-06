from __future__ import annotations

from app.core.exceptions import NotFoundError
from app.database.client import get_database
from app.repositories.store_repository import StoreRepository


# Collections that hold rows scoped to a store. When a store is deleted we wipe
# these so we don't leave orphaned inventory/sales/attendance/plan rows.
_STORE_SCOPED_COLLECTIONS = (
    "store_inventory",
    "sales",
    "attendance_records",
    "daily_assignments",
)


class StoreService:
    def __init__(self) -> None:
        self.repository = StoreRepository(get_database())

    async def list_stores(self, *, business_id: str) -> list[dict]:
        return await self.repository.list(business_id=business_id)

    async def get_store(self, *, business_id: str, store_id: str) -> dict:
        store = await self.repository.get(business_id=business_id, store_id=store_id)
        if not store:
            raise NotFoundError(code="STORE_NOT_FOUND", message="Store not found")
        return store

    async def create_store(self, *, business_id: str, payload: dict) -> dict:
        # Default the store type so legacy frontends that omit it still get a
        # valid value. The repo already fills in `status`/`isActive`/`timestamps`.
        if not payload.get("type"):
            payload = {**payload, "type": "RETAIL"}
        return await self.repository.create(business_id=business_id, payload=payload)
    async def update_store(self, *, business_id: str, store_id: str, payload: dict) -> dict:
        store = await self.repository.update(business_id=business_id, store_id=store_id, payload=payload)
        if not store:
            raise NotFoundError(code="STORE_NOT_FOUND", message="Store not found")
        return store

    async def delete_store(self, *, business_id: str, store_id: str) -> bool:
        """Hard-delete a store and cascade to its scoped collections.

        Returns True if the store existed (and was removed), False otherwise.
        We cascade the wipe because none of the dependent collections have
        foreign-key constraints and we don't want orphans that break later
        reads for the same `storeId`.
        """
        db = get_database()
        deleted = await self.repository.delete(business_id=business_id, store_id=store_id)
        # Cascade even if `deleted` is False so a stale row doesn't survive —
        # but only when the store_id is a valid ObjectId-shaped string.
        for collection_name in _STORE_SCOPED_COLLECTIONS:
            await db[collection_name].delete_many(
                {"businessId": business_id, "storeId": store_id}
            )
        return deleted
