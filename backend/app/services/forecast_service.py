from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List

from app.repositories.food_repository import FoodRepository
from app.repositories.sale_repository import SaleRepository


class ForecastService:
    def __init__(self, db: Any) -> None:
        self.db = db
        self.food = FoodRepository(db)
        self.sales = SaleRepository(db)

    async def daily_forecast(self, *, business_id: str, days: int = 7) -> List[Dict[str, Any]]:
        since = datetime.now(timezone.utc) - timedelta(days=days)
        aggregates = await self.sales.aggregate_quantity(business_id=business_id, since=since)
        by_food: Dict[str, Dict[str, Any]] = {}
        for agg in aggregates:
            food_id = str(agg.get("_id"))
            if not food_id or food_id == "None":
                continue
            by_food[food_id] = {
                "foodItemId": food_id,
                "totalQuantity": float(agg.get("totalQuantity") or 0),
                "totalRevenue": float(agg.get("totalRevenue") or 0),
            }
        items = []
        for food_id, agg in by_food.items():
            avg = agg["totalQuantity"] / float(days)
            food = await self.food.get(business_id=business_id, food_id=food_id)
            items.append({
                "foodItemId": food_id,
                "name": (food or {}).get("name"),
                "category": (food or {}).get("category"),
                "averageQuantity": round(avg, 2),
                "predictedQuantity": int(math.ceil(avg)),
                "totalRevenue": round(agg["totalRevenue"], 2),
                "basedOnDays": days,
            })
        items.sort(key=lambda x: x.get("predictedQuantity", 0), reverse=True)
        return items
