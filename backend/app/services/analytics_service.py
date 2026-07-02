from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any, Dict

from app.repositories.ingredient_repository import IngredientRepository
from app.repositories.store_repository import StoreRepository
from app.repositories.sale_repository import SaleRepository
from app.services.store_inventory_service import StoreInventoryService


class AnalyticsService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.ingredients = IngredientRepository(db)
        self.stores = StoreRepository(db)
        self.sales = SaleRepository(db)
        self.store_inventory = StoreInventoryService(db)

    async def dashboard(self, *, business_id: str, store_id: str | None = None) -> Dict[str, Any]:
        all_ingredients = await self.ingredients.list(business_id=business_id)
        all_stores = await self.stores.list(business_id=business_id)
        active_stores = [s for s in all_stores if (s.get("status") or "ACTIVE").upper() == "ACTIVE"]
        now = datetime.now(timezone.utc)
        day_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        today_count = 0
        today_revenue = 0.0
        if store_id:
            today_count = await self.sales.count_for_day(business_id=business_id, store_id=store_id, day_start=day_start, day_end=day_end)
            todays = await self.sales.list(business_id=business_id, store_id=store_id, start=day_start, end=day_end, limit=500)
            today_revenue = round(sum(float(s.get("totalPrice") or 0) for s in todays), 2)

        low_stock_count = 0
        if store_id:
            low = await self.store_inventory.list_low_stock(business_id=business_id, store_id=store_id)
            low_stock_count = len(low)
        else:
            low_stock_count = sum(1 for ing in all_ingredients if float(ing.get("currentStock") or 0) <= float(ing.get("minimumStock") or 0))

        return {
            "totals": {
                "ingredients": len(all_ingredients),
                "activeStores": len(active_stores),
                "todaySales": today_count,
                "todayRevenue": today_revenue,
                "lowStockItems": low_stock_count,
            },
            "generatedAt": now.isoformat(),
        }
