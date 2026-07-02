from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from app.repositories.base import BaseRepository


class IngredientRepository(BaseRepository):
    def __init__(self, db: Any | None) -> None:
        super().__init__(db, "ingredients")

    @property
    def collection(self):
        return self.db[self.collection_name]

    @staticmethod
    def _serialize(doc):
        if not doc:
            return None
        payload = dict(doc)
        payload["id"] = str(payload.pop("_id"))
        return payload

    async def list(self, *, business_id, category=None, low_stock=None):
        query = {"businessId": business_id}
        if category:
            query["category"] = category
        cursor = self.collection.find(query).sort("createdAt", -1)
        rows = [self._serialize(item) async for item in cursor]
        if low_stock is True:
            rows = [r for r in rows if (r.get("currentStock", 0) or 0) <= (r.get("minimumStock", 0) or 0)]
        elif low_stock is False:
            rows = [r for r in rows if (r.get("currentStock", 0) or 0) > (r.get("minimumStock", 0) or 0)]
        return rows

    async def get(self, *, business_id, ingredient_id):
        try:
            oid = ObjectId(ingredient_id)
        except Exception:
            return None
        doc = await self.collection.find_one({"_id": oid, "businessId": business_id})
        return self._serialize(doc)

    async def get_by_name(self, *, business_id, name):
        doc = await self.collection.find_one({"businessId": business_id, "name": name})
        return self._serialize(doc)

    async def create(self, *, business_id, payload):
        now = datetime.now(timezone.utc)
        doc = {"businessId": business_id, "currentStock": 0, "createdAt": now, "updatedAt": now}
        for k, v in payload.items():
            if k in {"currentStock", "minimumStock"}:
                doc[k] = v if v is not None else 0
            elif v is not None:
                doc[k] = v
        result = await self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return self._serialize(doc)

    async def update(self, *, business_id, ingredient_id, payload):
        try:
            oid = ObjectId(ingredient_id)
        except Exception:
            return None
        update = {k: v for k, v in payload.items() if v is not None}
        update["updatedAt"] = datetime.now(timezone.utc)
        await self.collection.update_one({"_id": oid, "businessId": business_id}, {"$set": update})
        doc = await self.collection.find_one({"_id": oid, "businessId": business_id})
        return self._serialize(doc)

    async def delete(self, *, business_id, ingredient_id):
        try:
            oid = ObjectId(ingredient_id)
        except Exception:
            return False
        result = await self.collection.delete_one({"_id": oid, "businessId": business_id})
        return result.deleted_count == 1

    async def low_stock(self, *, business_id):
        return await self.list(business_id=business_id, low_stock=True)
