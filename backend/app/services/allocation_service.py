from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId

from app.repositories.allocation_repository import AllocationRepository
from app.repositories.food_repository import FoodRepository
from app.repositories.ingredient_repository import IngredientRepository
from app.repositories.inventory_log_repository import InventoryLogRepository
from app.repositories.recipe_repository import RecipeRepository
from app.services.store_inventory_service import StoreInventoryService


class AllocationError(Exception):
    """Raised when an allocation cannot be created or modified."""


class AllocationService:
    """Manage allocations of food items (recipe-quantities) to stores.

    Each allocation pulls ingredient stock from the master pool
    (`ingredients.currentStock`) and mirrors it onto the store's shelf
    (`store_inventory[store_id, ingredient_id]`). Reverting an allocation
    takes the stock off the shelf and refunds it to the pool so the net
    effect is zero.
    """

    def __init__(self, db: Any) -> None:
        self.db = db
        self.allocations = AllocationRepository(db)
        self.food = FoodRepository(db)
        self.recipes = RecipeRepository(db)
        self.ingredients = IngredientRepository(db)
        self.store_inventory = StoreInventoryService(db)
        self.logs = InventoryLogRepository(db)

    @staticmethod
    def _today_iso() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async def create_allocation(
        self,
        *,
        business_id: str,
        store_id: str,
        food_id: str,
        quantity: float,
        created_by: Optional[str] = None,
        date: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        if quantity <= 0:
            raise AllocationError("quantity must be positive")

        food = await self.food.get(business_id=business_id, food_id=food_id)
        if not food:
            raise AllocationError(f"Food item {food_id} not found")

        recipe = await self.recipes.get_active_for_food(business_id=business_id, food_id=food_id)
        if not recipe:
            raise AllocationError("No active recipe linked to this food item. Edit the recipe and pick a food item first.")

        ingredients_list = recipe.get("ingredients") or []
        if not ingredients_list:
            raise AllocationError("Recipe has no ingredient lines")

        # Pre-flight: compute required per ingredient and read each ingredient's
        # master-pool (`ingredients.currentStock`) quantity.
        plan: List[Dict[str, Any]] = []
        for line in ingredients_list:
            ing_id = line.get("ingredientId")
            per_unit = float(line.get("quantity") or 0)
            if not ing_id or per_unit <= 0:
                continue
            required = per_unit * float(quantity)
            ing_doc = await self.ingredients.get(business_id=business_id, ingredient_id=ing_id)
            if not ing_doc:
                raise AllocationError(f"Ingredient {ing_id} no longer exists")
            pool_before = float(ing_doc.get("currentStock") or 0)
            ing_name = ing_doc.get("name") or ing_id
            if pool_before < required:
                raise AllocationError(
                    f"Insufficient stock pool for '{ing_name}' ({ing_id}): "
                    f"have {pool_before:g}, need {required:g} for {quantity:g} × "
                    f"{food.get('name') or food_id}. Restock from Inventory → Restock first."
                )
            plan.append({
                "ingredientId": ing_id,
                "ingredientName": ing_name,
                "perUnit": per_unit,
                "required": required,
                "before": pool_before,
            })

        if not plan:
            raise AllocationError("Recipe has no usable ingredient lines")

        # Atomic dual-write: decrement the pool, mirror onto the store's shelf.
        deductions: List[Dict[str, Any]] = []
        used_transaction = False

        for entry in plan:
            result = await self.store_inventory.try_consume_pool(
                business_id=business_id,
                store_id=store_id,
                ingredient_id=entry["ingredientId"],
                amount=entry["required"],
            )
            if not result.get("ok"):
                # Roll back any deductions already applied
                for done in deductions:
                    await self.store_inventory.refund_pool(
                        business_id=business_id,
                        store_id=store_id,
                        ingredient_id=done["ingredientId"],
                        amount=done["required"],
                    )
                raise AllocationError(
                    f"Insufficient stock pool for '{entry['ingredientName']}' "
                    f"({entry['ingredientId']}): "
                    f"have {result.get('poolCurrent', 0):g}, need {entry['required']:g}. "
                    f"Restock from Inventory → Restock first."
                )
            if result.get("transactional"):
                used_transaction = True
            deductions.append({
                **entry,
                "after": result.get("poolAfter"),
                "storeAfter": result.get("storeAfter"),
            })

        # Compute cost snapshot.
        # unitPrice = selling price per food unit (revenue basis).
        # unitCost  = sum(ingredient.costPerUnit * perUnit) for the recipe (ingredient basis).
        # totalCost = unitCost * quantity (ingredient cost of the whole allocation).
        unit_price = float(food.get("price") or 0)
        unit_cost = 0.0
        for line in ingredients_list:
            per_unit = float(line.get("quantity") or 0)
            if per_unit <= 0:
                continue
            ing_doc = await self.ingredients.get(business_id=business_id, ingredient_id=line.get("ingredientId"))
            ing_unit_cost = float((ing_doc or {}).get("costPerUnit") or (ing_doc or {}).get("cost") or 0)
            unit_cost += per_unit * ing_unit_cost
        unit_cost = round(unit_cost, 4)
        total_cost = round(unit_cost * float(quantity), 4)

        allocation_doc = await self.allocations.insert(
            payload={
                "businessId": business_id,
                "storeId": store_id,
                "foodItemId": food_id,
                "foodName": food.get("name"),
                "recipeId": recipe.get("id"),
                "quantity": float(quantity),
                "unitPrice": unit_price,
                "unitCost": unit_cost,
                "totalCost": total_cost,
                "status": "ACTIVE",
                "date": date or self._today_iso(),
                "createdBy": created_by,
                "deductions": deductions,
                "notes": notes,
            }
        )

        # Best-effort inventory logs
        now = datetime.now(timezone.utc)
        for d in deductions:
            await self.logs.insert(
                payload={
                    "businessId": business_id,
                    "ingredientId": d["ingredientId"],
                    "storeId": store_id,
                    "workerId": created_by,
                    "action": "ALLOCATION",
                    "quantity": -d["required"],
                    "before": d["before"],
                    "after": d["after"],
                    "referenceType": "allocation",
                    "referenceId": str(allocation_doc.get("id", "")),
                    "reason": f"Allocated {quantity}× {food.get('name') or food_id}",
                    "timestamp": now,
                }
            )

        allocation_doc["transactional"] = used_transaction
        return allocation_doc

    async def update_allocation(
        self,
        *,
        business_id: str,
        allocation_id: str,
        new_quantity: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        existing = await self.allocations.get_by_id(business_id=business_id, allocation_id=allocation_id)
        if not existing:
            raise AllocationError(f"Allocation {allocation_id} not found")
        if existing.get("status") == "REVERSED":
            raise AllocationError("Cannot edit a reversed allocation")

        if new_quantity is None and notes is None:
            return existing  # no-op

        updates: Dict[str, Any] = {}
        if notes is not None:
            updates["notes"] = notes

        old_quantity = float(existing.get("quantity") or 0)
        if new_quantity is not None and float(new_quantity) != old_quantity:
            if new_quantity <= 0:
                raise AllocationError("quantity must be positive")
            # Adjust per-ingredient stock by the delta (positive for increase)
            delta = float(new_quantity) - old_quantity
            applied: List[Dict[str, Any]] = []
            try:
                for d in existing.get("deductions") or []:
                    per_unit = float(d.get("perUnit") or 0)
                    ingredient_delta = per_unit * delta
                    if ingredient_delta > 0:
                        # Increasing allocation — pull more from the pool onto the shelf
                        result = await self.store_inventory.try_consume_pool(
                            business_id=business_id,
                            store_id=existing["storeId"],
                            ingredient_id=d["ingredientId"],
                            amount=ingredient_delta,
                        )
                        if not result.get("ok"):
                            raise AllocationError(
                                f"Insufficient stock pool to increase allocation of "
                                f"{d.get('ingredientName') or d['ingredientId']}"
                            )
                        applied.append({"ingredientId": d["ingredientId"], "amount": ingredient_delta})
                    elif ingredient_delta < 0:
                        # Decreasing allocation — refund the difference
                        await self.store_inventory.refund_pool(
                            business_id=business_id,
                            store_id=existing["storeId"],
                            ingredient_id=d["ingredientId"],
                            amount=-ingredient_delta,
                        )
            except AllocationError:
                # Roll back anything we applied
                for a in applied:
                    await self.store_inventory.refund_pool(
                        business_id=business_id,
                        store_id=existing["storeId"],
                        ingredient_id=a["ingredientId"],
                        amount=a["amount"],
                    )
                raise
            # Recompute deductions (snapshot before/after for the delta)
            # Note: keeping original deductions for audit; updates capture the delta in 'notes'.
            updates["quantity"] = float(new_quantity)
            # `unitCost` is per-unit ingredient cost (set on creation).
            # `unitPrice` is per-unit selling price (revenue basis).
            # `totalCost` is the *ingredient* cost of the whole allocation, not revenue.
            unit_cost = float(existing.get("unitCost") or 0)
            updates["totalCost"] = round(unit_cost * float(new_quantity), 4)

        updated = await self.allocations.update(
            business_id=business_id,
            allocation_id=allocation_id,
            payload=updates,
        )
        return updated or existing

    async def revert_allocation(self, *, business_id: str, allocation_id: str, reversed_by: Optional[str] = None) -> Dict[str, Any]:
        """Reverse the allocation: refund all ingredient deductions and mark REVERSED."""
        existing = await self.allocations.get_by_id(business_id=business_id, allocation_id=allocation_id)
        if not existing:
            raise AllocationError(f"Allocation {allocation_id} not found")
        if existing.get("status") == "REVERSED":
            return existing  # idempotent

        now = datetime.now(timezone.utc)
        for d in existing.get("deductions") or []:
            amount = float(d.get("required") or 0)
            if amount <= 0:
                continue
            await self.store_inventory.refund_pool(
                business_id=business_id,
                store_id=existing["storeId"],
                ingredient_id=d["ingredientId"],
                amount=amount,
            )
            await self.logs.insert(
                payload={
                    "businessId": business_id,
                    "ingredientId": d["ingredientId"],
                    "storeId": existing["storeId"],
                    "workerId": reversed_by,
                    "action": "REVERSAL",
                    "quantity": amount,
                    "before": float(d.get("after") or 0),
                    "after": float(d.get("after") or 0) + amount,
                    "referenceType": "allocation",
                    "referenceId": str(allocation_id),
                    "reason": f"Reversed allocation {allocation_id} ({existing.get('foodName')})",
                    "timestamp": now,
                }
            )

        updated = await self.allocations.update(
            business_id=business_id,
            allocation_id=allocation_id,
            payload={
                "status": "REVERSED",
                "reversedAt": now,
                "reversedBy": reversed_by,
            },
        )
        return updated or existing

    async def reclaim_remaining(
        self,
        *,
        business_id: str,
        allocation_id: str,
        reclaimed_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Reclaim unsold leftover ingredients from an ACTIVE allocation.

        Computes ``remaining = quantity - sold`` for the allocation and
        refunds ``per_unit * remaining`` of each ingredient back to the
        master pool (and decrements the same amount from the store's shelf).
        Marks the allocation as ``RECLAIMED`` (distinct from ``REVERSED`` —
        a reclaim is the normal end-of-shift action; a reversal is a full
        undo).

        Idempotent: reclaims against a RECLAIMED allocation are a no-op.
        """
        existing = await self.allocations.get_by_id(business_id=business_id, allocation_id=allocation_id)
        if not existing:
            raise AllocationError(f"Allocation {allocation_id} not found")
        status = existing.get("status")
        if status != "ACTIVE":
            # RECLAIMED / REVERSED → nothing more to do, return current row
            existing["_reclaimAction"] = "noop-already-claimed"
            return existing

        allocated_qty = float(existing.get("quantity") or 0)
        if allocated_qty <= 0:
            raise AllocationError("Allocation has zero quantity")

        # Use the on-doc "sold" counter maintained by FIFO consumption at sale-time.
        sold = await self.allocations.sold_for_allocation(allocation=existing)
        remaining = max(allocated_qty - sold, 0)

        if remaining <= 0:
            # Nothing to reclaim — mark as fully-consumed but keep status ACTIVE for record.
            existing["_reclaimAction"] = "noop-nothing-remaining"
            return existing

        # Refund each ingredient's share of the remaining units back to the pool.
        refunded: List[Dict[str, Any]] = []
        for d in existing.get("deductions") or []:
            per_unit = float(d.get("perUnit") or 0)
            if per_unit <= 0:
                continue
            refund_amount = per_unit * remaining  # absolute quantity in master pool
            await self.store_inventory.refund_pool(
                business_id=business_id,
                store_id=existing["storeId"],
                ingredient_id=d["ingredientId"],
                amount=refund_amount,
            )
            refunded.append({
                "ingredientId": d["ingredientId"],
                "ingredientName": d.get("ingredientName"),
                "perUnit": per_unit,
                "refunded": refund_amount,
            })

        now = datetime.now(timezone.utc)
        # Write audit log rows for the reclaim.
        for r in refunded:
            await self.logs.insert(
                payload={
                    "businessId": business_id,
                    "ingredientId": r["ingredientId"],
                    "storeId": existing["storeId"],
                    "workerId": reclaimed_by,
                    "action": "RECLAIM",
                    "quantity": r["refunded"],
                    "before": None,
                    "after": None,
                    "referenceType": "allocation",
                    "referenceId": str(allocation_id),
                    "reason": (
                        f"Reclaimed {remaining:g} unsold × {existing.get('foodName')} "
                        f"({r['refunded']:g} {r['ingredientName']})"
                    ),
                    "timestamp": now,
                }
            )

        updated = await self.allocations.update(
            business_id=business_id,
            allocation_id=allocation_id,
            payload={
                "status": "RECLAIMED",
                "reclaimedAt": now,
                "reclaimedBy": reclaimed_by,
                "reclaimedRemaining": remaining,
                "refunds": refunded,
            },
        )
        result = updated or existing
        result["_reclaimAction"] = "reclaimed"
        return result

    async def list_for_store(
        self,
        *,
        business_id: str,
        store_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 200,
    ) -> Dict[str, Any]:
        rows = await self.allocations.list(
            business_id=business_id,
            store_id=store_id,
            start_date=start_date,
            end_date=end_date,
            status=status,
            limit=limit,
        )
        # Annotate with sold/remaining
        annotated: List[Dict[str, Any]] = []
        totals = {
            "allocated": 0.0,
            "activeAllocated": 0.0,
            "reclaimedAllocated": 0.0,
            "reversedAllocated": 0.0,
            "sold": 0,
            "revenue": 0.0,
            "cost": 0.0,
            "remaining": 0.0,
        }
        for row in rows:
            entry = dict(row)
            qty = float(row.get("quantity") or 0)
            unit_price = float(row.get("unitPrice") or 0)
            row_status = (row.get("status") or "ACTIVE").upper()
            # Use the on-doc "sold" counter maintained by FIFO consumption at sale-time.
            sold = await self.allocations.sold_for_allocation(allocation=row)
            remaining = max(qty - sold, 0)
            revenue = round(sold * unit_price, 2)
            entry["sold"] = sold
            entry["remaining"] = remaining
            entry["revenue"] = revenue
            annotated.append(entry)
            # Lifetime allocated = everything ever allocated in range, regardless of status.
            # This is what a worker dashboard should call out as the "full breakdown":
            # active + reclaimed + reversed. ActiveAllocated is the working total that
            # matters for remaining stock; reclaimed/reversed are recorded separately
            # so the UI can show "X active, Y reclaimed today".
            totals["allocated"] += qty
            totals["sold"] += sold
            if row_status == "ACTIVE":
                totals["activeAllocated"] += qty
                totals["remaining"] += remaining
                totals["revenue"] += revenue
                totals["cost"] += float(row.get("totalCost") or 0)
            elif row_status == "RECLAIMED":
                totals["reclaimedAllocated"] += qty
            elif row_status == "REVERSED":
                totals["reversedAllocated"] += qty

        return {
            "storeId": store_id,
            "start": start_date,
            "end": end_date,
            "allocations": annotated,
            "totals": {
                # Lifetime allocated: everything ever allocated in the date range.
                "allocated": totals["allocated"],
                # Active-only totals — the numbers a worker dashboard should use as
                # the "working" stock and revenue.
                "activeAllocated": totals["activeAllocated"],
                "remaining": totals["remaining"],
                "revenue": round(totals["revenue"], 2),
                "cost": round(totals["cost"], 2),
                # Full breakdown by status, so the UI can render "12 active · 10 reclaimed".
                "reclaimedAllocated": totals["reclaimedAllocated"],
                "reversedAllocated": totals["reversedAllocated"],
                "sold": totals["sold"],
            },
        }

    async def list_all(
        self,
        *,
        business_id: str,
        store_id: Optional[str] = None,
        food_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        rows = await self.allocations.list(
            business_id=business_id,
            store_id=store_id,
            food_id=food_id,
            start_date=start_date,
            end_date=end_date,
            status=status,
            limit=limit,
        )
        # Annotate each row with sold / remaining / revenue (same shape as list_for_store).
        # Falls back to 0 when no sales data exists yet.
        annotated: List[Dict[str, Any]] = []
        for row in rows:
            entry = dict(row)
            qty = float(row.get("quantity") or 0)
            unit_price = float(row.get("unitPrice") or 0)
            # Use the on-doc "sold" counter maintained by FIFO consumption at sale-time.
            sold = await self.allocations.sold_for_allocation(allocation=row)
            remaining = max(qty - sold, 0)
            revenue = round(sold * unit_price, 2)
            entry["sold"] = sold
            entry["remaining"] = remaining
            entry["revenue"] = revenue
            entry["totalCost"] = float(row.get("totalCost") or 0)
            annotated.append(entry)
        return annotated

    async def aggregated_by_ingredient(
        self,
        *,
        business_id: str,
        store_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        statuses: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Aggregate allocation deductions per ingredient for a store.

        Returns a per-ingredient view of how much was allocated to ``store_id``
        within the optional date range, filtered to ``statuses`` (default:
        ACTIVE only). Each row sums ``deductions[].required`` across all
        matching allocations so the worker screen can display the *allocated*
        amount for the day rather than the cumulative shelf stock from
        ``store_inventory``.

        Shape::

            {
                "storeId": "...",
                "start": "...",
                "end": "...",
                "statuses": ["ACTIVE"],
                "items": [
                    {
                        "ingredientId": "...",
                        "ingredientName": "Burger Bun (Normal)",
                        "unit": "pcs",
                        "allocated": 10.0,           # sum of deductions[].required
                        "byFood": [                  # breakdown per food item
                            {"foodItemId": "...", "foodName": "...", "quantity": 10.0}
                        ]
                    },
                    ...
                ]
            }
        """
        rows = await self.allocations.list(
            business_id=business_id,
            store_id=store_id,
            start_date=start_date,
            end_date=end_date,
            status=None,
            limit=500,
        )
        allowed = {s.upper() for s in (statuses or ["ACTIVE"])}
        per_ingredient: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            row_status = str(row.get("status") or "").upper()
            if allowed and row_status not in allowed:
                continue
            food_id = str(row.get("foodItemId") or "")
            food_name = row.get("foodName") or "Item"
            qty = float(row.get("quantity") or 0)
            for ded in row.get("deductions") or []:
                ing_id = str(ded.get("ingredientId") or "")
                if not ing_id:
                    continue
                required = float(ded.get("required") or 0)
                bucket = per_ingredient.setdefault(
                    ing_id,
                    {
                        "ingredientId": ing_id,
                        "ingredientName": ded.get("ingredientName") or ing_id,
                        "unit": ded.get("unit"),
                        "allocated": 0.0,
                        "byFood": [],
                    },
                )
                if not bucket.get("unit") and ded.get("unit"):
                    bucket["unit"] = ded.get("unit")
                bucket["allocated"] += required
                bucket["byFood"].append(
                    {
                        "foodItemId": food_id,
                        "foodName": food_name,
                        "quantity": required,
                    }
                )
        # Hydrate unit + canonical name from ingredients collection so the row
        # is self-describing even when deductions were recorded before the
        # ingredient was renamed.
        if per_ingredient:
            # _id values are ObjectIds; per_ingredient keys are strings.
            # Convert the keys to ObjectIds so the $in lookup matches.
            id_filter: List[ObjectId] = []
            for key in per_ingredient.keys():
                try:
                    id_filter.append(ObjectId(key))
                except (InvalidId, TypeError):
                    continue
            if id_filter:
                try:
                    cursor = self.ingredients.collection.find(
                        {
                            "businessId": business_id,
                            "_id": {"$in": id_filter},
                        }
                    )
                    async for ing in cursor:
                        ing_id = str(ing.get("_id"))
                        bucket = per_ingredient.get(ing_id)
                        if not bucket:
                            continue
                        if not bucket.get("ingredientName") or bucket["ingredientName"] == ing_id:
                            bucket["ingredientName"] = ing.get("name") or bucket["ingredientName"]
                        if not bucket.get("unit"):
                            bucket["unit"] = ing.get("unit")
                except Exception:
                    # Non-fatal: aggregation still valid without the lookup
                    pass
        items = list(per_ingredient.values())
        items.sort(
            key=lambda x: (
                -float(x.get("allocated") or 0),
                str(x.get("ingredientName") or ""),
            )
        )
        return {
            "storeId": store_id,
            "start": start_date,
            "end": end_date,
            "statuses": sorted(allowed),
            "items": items,
        }


__all__ = ["AllocationService", "AllocationError"]