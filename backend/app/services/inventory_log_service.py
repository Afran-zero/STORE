from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.repositories.ingredient_repository import IngredientRepository
from app.repositories.inventory_log_repository import InventoryLogRepository
from app.repositories.purchase_order_repository import PurchaseOrderRepository


class InventoryLogService:
    """Ledger-backed writes for ingredient stock.

    `inventory_logs` is the immutable source of truth; `ingredients.currentStock`
    is a cached aggregate. Every state-changing operation writes a log entry
    AND updates the cache + weighted-average cost where relevant.
    """

    def __init__(self, db: Any) -> None:
        self.db = db
        self.ingredients = IngredientRepository(db)
        self.logs = InventoryLogRepository(db)
        self.purchase_orders = PurchaseOrderRepository(db)

    async def _current_stock(self, *, business_id: str, ingredient_id: str) -> float:
        item = await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id)
        if not item:
            raise LookupError(ingredient_id)
        return float(item.get("currentStock") or 0)

    async def _write_log(
        self,
        *,
        business_id: str,
        ingredient_id: str,
        action: str,
        quantity: float,
        before: float,
        after: float,
        store_id: Optional[str] = None,
        worker_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        reference_id: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return await self.logs.insert(
            payload={
                "businessId": business_id,
                "ingredientId": ingredient_id,
                "storeId": store_id,
                "workerId": worker_id,
                "action": action,
                "quantity": quantity,
                "before": before,
                "after": after,
                "referenceType": reference_type,
                "referenceId": reference_id,
                "reason": reason,
            }
        )

    async def purchase(
        self,
        *,
        business_id: str,
        ingredient_id: str,
        quantity: float,
        unit_price: float,
        supplier_id: Optional[str] = None,
        store_id: Optional[str] = None,
        worker_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        item = await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id)
        if not item:
            raise LookupError(ingredient_id)
        before = float(item.get("currentStock") or 0)
        prev_avg = float(item.get("averageCost") or item.get("costPerUnit") or unit_price)
        after = before + quantity
        new_avg = ((prev_avg * before) + (unit_price * quantity)) / after if after else prev_avg

        await self.ingredients.update(
            business_id=business_id,
            ingredient_id=ingredient_id,
            payload={
                "currentStock": after,
                "averageCost": new_avg,
                "costPerUnit": new_avg,
                "purchasePrice": unit_price,
                "lastPurchaseAt": datetime.now(timezone.utc),
            },
        )

        po = await self.purchase_orders.insert(
            payload={
                "businessId": business_id,
                "supplierId": supplier_id,
                "ingredientId": ingredient_id,
                "quantity": quantity,
                "unitPrice": unit_price,
                "totalCost": round(quantity * unit_price, 4),
                "status": "COMPLETED",
                "storeId": store_id,
            }
        )

        log = await self._write_log(
            business_id=business_id,
            ingredient_id=ingredient_id,
            action="PURCHASE",
            quantity=quantity,
            before=before,
            after=after,
            store_id=store_id,
            worker_id=worker_id,
            reference_type="purchase_order",
            reference_id=str(po.get("id", "")),
        )
        return {"ingredient": await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id), "log": log, "purchaseOrder": po}

    async def adjust(
        self,
        *,
        business_id: str,
        ingredient_id: str,
        quantity: float,
        reason: str,
        store_id: Optional[str] = None,
        worker_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        item = await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id)
        if not item:
            raise LookupError(ingredient_id)
        before = float(item.get("currentStock") or 0)
        after = before + quantity
        await self.ingredients.update(
            business_id=business_id,
            ingredient_id=ingredient_id,
            payload={"currentStock": after},
        )
        log = await self._write_log(
            business_id=business_id,
            ingredient_id=ingredient_id,
            action="ADJUSTMENT",
            quantity=quantity,
            before=before,
            after=after,
            store_id=store_id,
            worker_id=worker_id,
            reason=reason,
        )
        return {"ingredient": await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id), "log": log}

    async def transfer(
        self,
        *,
        business_id: str,
        ingredient_id: str,
        from_store_id: str,
        to_store_id: str,
        quantity: float,
        worker_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        item = await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id)
        if not item:
            raise LookupError(ingredient_id)
        before = float(item.get("currentStock") or 0)
        if before < quantity:
            raise ValueError(f"Insufficient stock: have {before}, need {quantity}")
        after = before - quantity
        await self.ingredients.update(
            business_id=business_id,
            ingredient_id=ingredient_id,
            payload={"currentStock": after},
        )
        out_log = await self._write_log(
            business_id=business_id,
            ingredient_id=ingredient_id,
            action="TRANSFER",
            quantity=-quantity,
            before=before,
            after=after,
            store_id=from_store_id,
            worker_id=worker_id,
            reference_type="transfer_out",
        )
        await self._write_log(
            business_id=business_id,
            ingredient_id=ingredient_id,
            action="TRANSFER",
            quantity=quantity,
            before=after,
            after=after,
            store_id=to_store_id,
            worker_id=worker_id,
            reference_type="transfer_in",
            reference_id=str(out_log.get("id", "")),
        )
        return {"ingredient": await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id), "log": out_log}

    async def allocate(
        self,
        *,
        business_id: str,
        ingredient_id: str,
        store_id: str,
        quantity: float,
        worker_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        item = await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id)
        if not item:
            raise LookupError(ingredient_id)
        before = float(item.get("currentStock") or 0)
        if before < quantity:
            raise ValueError(f"Insufficient stock: have {before}, need {quantity}")
        after = before - quantity
        await self.ingredients.update(
            business_id=business_id,
            ingredient_id=ingredient_id,
            payload={"currentStock": after},
        )
        log = await self._write_log(
            business_id=business_id,
            ingredient_id=ingredient_id,
            action="ALLOCATION",
            quantity=-quantity,
            before=before,
            after=after,
            store_id=store_id,
            worker_id=worker_id,
        )
        return {"ingredient": await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id), "log": log}

    async def return_stock(
        self,
        *,
        business_id: str,
        ingredient_id: str,
        store_id: str,
        quantity: float,
        worker_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        item = await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id)
        if not item:
            raise LookupError(ingredient_id)
        before = float(item.get("currentStock") or 0)
        after = before + quantity
        await self.ingredients.update(
            business_id=business_id,
            ingredient_id=ingredient_id,
            payload={"currentStock": after},
        )
        log = await self._write_log(
            business_id=business_id,
            ingredient_id=ingredient_id,
            action="RETURN",
            quantity=quantity,
            before=before,
            after=after,
            store_id=store_id,
            worker_id=worker_id,
        )
        return {"ingredient": await self.ingredients.get(business_id=business_id, ingredient_id=ingredient_id), "log": log}

    async def history(self, *, business_id: str, ingredient_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        return await self.logs.history(business_id=business_id, ingredient_id=ingredient_id, limit=limit)
