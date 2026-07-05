from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.repositories.ingredient_repository import IngredientRepository
from app.repositories.store_inventory_repository import StoreInventoryRepository


class StoreInventoryService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.repo = StoreInventoryRepository(db)
        self.ingredients = IngredientRepository(db)

    async def list_for_store(self, *, business_id: str, store_id: str) -> List[Dict[str, Any]]:
        rows = await self.repo.list_by_store(business_id=business_id, store_id=store_id)
        # Enrich each row with the matching ingredient's name/unit so workers see
        # "Burger Bun (Normal)" instead of the raw id when the store_inventory row
        # was created without a snapshot of those fields.
        missing: set[str] = set()
        for row in rows:
            if not row.get("ingredientName") and row.get("ingredientId"):
                missing.add(str(row["ingredientId"]))
        name_map: dict[str, Dict[str, Any]] = {}
        unit_map: dict[str, str | None] = {}
        if missing:
            cursor = self.ingredients.collection.find(
                {"businessId": business_id, "_id": {"$in": list(missing)}}
            )
            async for ing in cursor:
                ing_id = str(ing.get("_id"))
                name_map[ing_id] = ing
                unit_map[ing_id] = ing.get("unit")
        for row in rows:
            ing_id = row.get("ingredientId")
            if not ing_id:
                continue
            ing = name_map.get(str(ing_id))
            if ing and not row.get("ingredientName"):
                row["ingredientName"] = ing.get("name")
            if ing and not row.get("unit"):
                row["unit"] = ing.get("unit")
        return rows

    async def get(self, *, business_id: str, store_id: str, ingredient_id: str) -> Dict[str, Any]:
        return await self.repo.get_one(business_id=business_id, store_id=store_id, ingredient_id=ingredient_id)

    async def set_stock(self, *, business_id: str, store_id: str, ingredient_id: str, quantity: float, minimumStock: float | None = None) -> Dict[str, Any]:
        return await self.repo.upsert(business_id=business_id, store_id=store_id, ingredient_id=ingredient_id, quantity=quantity, minimumStock=minimumStock)

    async def list_low_stock(self, *, business_id: str, store_id: str) -> List[Dict[str, Any]]:
        """Return rows below their minimum, enriched with embedded ingredient data
        so callers don't need to join separately (fixes dashboards showing IDs).
        """
        rows = await self.repo.list_by_store(business_id=business_id, store_id=store_id)
        flagged: List[Dict[str, Any]] = []
        for row in rows:
            quantity = float(row.get("quantity") or 0)
            minimum = float(row.get("minimumStock") or 0)
            if minimum > 0 and quantity <= minimum:
                ingredient_id = row.get("ingredientId")
                if ingredient_id:
                    ing = await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id)
                    if ing:
                        row["ingredient"] = {
                            "id": ing.get("id") or str(ingredient_id),
                            "name": ing.get("name"),
                            "unit": ing.get("unit"),
                            "category": ing.get("category"),
                        }
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

    # -------------------------------------------------------------------------
    # Pool-aware consumption (allocation / sales flows)
    # -------------------------------------------------------------------------

    async def try_consume_pool(
        self,
        *,
        business_id: str,
        store_id: str,
        ingredient_id: str,
        amount: float,
    ) -> Dict[str, Any]:
        """Allocate `amount` of an ingredient to ``store_id`` from the master pool.

        Semantics:
          - Reads ``ingredients.currentStock`` (the pool).
          - On success, decrements the pool and INCREMENTS the store's shelf
            (``store_inventory[store_id, ingredient_id].quantity``) by ``amount``.
            The store ends up with ``store_before_qty + amount`` units on hand.
          - Returns ``{"ok": True, "poolBefore", "poolAfter", "storeBefore", "storeAfter", "transactional"}``.
          - On insufficient pool, returns ``{"ok": False, "reason": "insufficient_pool",
            "poolCurrent", "storeCurrent"}`` and rolls back any partial write.

        Why increment-on-store: allocations place stock ONTO a store's shelf,
        not deduct from it. The pool goes down (raw materials consumed) while
        the store goes up (made available for sales).
        """
        if amount <= 0:
            return {"ok": False, "reason": "invalid_amount", "poolCurrent": None, "storeCurrent": None}

        store_before = await self.repo.get_one(
            business_id=business_id, store_id=store_id, ingredient_id=ingredient_id
        )
        store_before_qty = float((store_before or {}).get("quantity") or 0)

        client = self.db.client if hasattr(self.db, "client") else None
        used_transaction = False

        async def _do_consume(session=None) -> Dict[str, Any]:
            # 1. Decrement the master pool (validates against the budget)
            pool = await self.ingredients.decrement_pool(
                business_id=business_id,
                ingredient_id=ingredient_id,
                amount=amount,
                session=session,
            )
            if not pool.get("ok"):
                return {
                    "ok": False,
                    "reason": pool.get("reason", "insufficient_pool"),
                    "poolCurrent": pool.get("current"),
                    "storeCurrent": store_before_qty,
                    "compensated": False,
                }

            # 2. Mirror onto the store's shelf (creates row if absent)
            mirror = await self.repo.atomic_increment(
                business_id=business_id,
                store_id=store_id,
                ingredient_id=ingredient_id,
                amount=amount,
                session=session,
            )
            mirror_after = float((mirror or {}).get("quantity") or 0)

            # If the mirror somehow failed, refund the pool
            if mirror is None:
                await self.ingredients.increment_pool(
                    business_id=business_id,
                    ingredient_id=ingredient_id,
                    amount=amount,
                    session=session,
                )
                return {
                    "ok": False,
                    "reason": "store_mirror_failed",
                    "poolCurrent": pool.get("before"),
                    "storeCurrent": store_before_qty,
                    "compensated": True,
                }

            return {
                "ok": True,
                "poolBefore": pool.get("before"),
                "poolAfter": pool.get("after"),
                "storeBefore": store_before_qty,
                "storeAfter": mirror_after,
            }

        if client is not None:
            try:
                async with await client.start_session() as session:
                    async with session.start_transaction():
                        result = await _do_consume(session=session)
                used_transaction = True
                if result.get("ok"):
                    result["transactional"] = True
                    return result
                return result
            except Exception:
                # Replica-set/transactions not available — fall through to compensation path.
                pass

        result = await _do_consume(session=None)
        result["transactional"] = used_transaction
        return result

    async def refund_pool(
        self,
        *,
        business_id: str,
        store_id: str,
        ingredient_id: str,
        amount: float,
    ) -> Dict[str, Any]:
        """Reverse an allocation: take `amount` off the store's shelf and put it
        back into the master pool."""
        if amount <= 0:
            return {"ok": False, "reason": "invalid_amount"}

        client = self.db.client if hasattr(self.db, "client") else None
        used_transaction = False

        async def _do_refund(session=None) -> Dict[str, Any]:
            store = await self.repo.atomic_decrement(
                business_id=business_id,
                store_id=store_id,
                ingredient_id=ingredient_id,
                amount=amount,
                session=session,
            )
            if not store.get("ok"):
                # Nothing to refund at the store level — still try to top up the pool
                # if the store simply didn't have a row (treat as zero).
                pass
            store_after_qty = float(((store or {}).get("current") or {}).get("quantity") or 0)
            pool = await self.ingredients.increment_pool(
                business_id=business_id,
                ingredient_id=ingredient_id,
                amount=amount,
                session=session,
            )
            if not pool.get("ok"):
                if store.get("ok"):
                    await self.repo.atomic_increment(
                        business_id=business_id,
                        store_id=store_id,
                        ingredient_id=ingredient_id,
                        amount=amount,
                        session=session,
                    )
                return {"ok": False, "reason": pool.get("reason", "refund_failed")}
            return {
                "ok": True,
                "poolBefore": pool.get("before"),
                "poolAfter": pool.get("after"),
                "storeAfter": store_after_qty,
            }

        if client is not None:
            try:
                async with await client.start_session() as session:
                    async with session.start_transaction():
                        result = await _do_refund(session=session)
                used_transaction = True
                if result.get("ok"):
                    result["transactional"] = True
                    return result
                return result
            except Exception:
                pass

        result = await _do_refund(session=None)
        result["transactional"] = used_transaction
        return result
