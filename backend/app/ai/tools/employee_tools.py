from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from langchain_core.tools import StructuredTool
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field


def _date_range_window(date_range: str) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    normalized = (date_range or "last_7_days").strip().lower()
    if normalized in {"today", "day"}:
        start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        return start, now
    if normalized in {"last_30_days", "30d", "month"}:
        return now - timedelta(days=30), now
    return now - timedelta(days=7), now


class EmployeePerformanceArgs(BaseModel):
    employee_name_or_id: str
    date_range: str = Field(default="last_7_days")


class EmployeeRosterArgs(BaseModel):
    role: str | None = Field(
        default=None,
        description="Optional role filter, e.g. 'WORKER', 'OWNER', 'MANAGER'. Case-insensitive.",
    )
    status: str | None = Field(
        default=None,
        description="Optional status filter: 'active' or 'inactive'. Maps to isActive=true|false.",
    )
    store_id: str | None = Field(
        default=None,
        description="Optional store id to filter workers assigned to that store.",
    )
    search: str | None = Field(
        default=None,
        description="Optional case-insensitive substring match against name or email.",
    )
    limit: int = Field(default=50, ge=1, le=200)


def build_employee_tools(
    db: AsyncIOMotorDatabase,
    *,
    business_id: str,
    current_user_id: str,
    current_user_role: str | None,
) -> list[StructuredTool]:
    async def get_employee_performance(employee_name_or_id: str, date_range: str = "last_7_days") -> dict[str, Any]:
        target_user = await db["users"].find_one(
            {
                "businessId": business_id,
                "$or": [
                    {"_id": employee_name_or_id},
                    {"fullName": {"$regex": employee_name_or_id, "$options": "i"}},
                    {"name": {"$regex": employee_name_or_id, "$options": "i"}},
                    {"email": {"$regex": employee_name_or_id, "$options": "i"}},
                ],
            }
        )
        if not target_user:
            return {"found": False, "employee": employee_name_or_id}

        target_user_id = str(target_user.get("_id", ""))
        if (current_user_role or "").upper() == "WORKER" and target_user_id != current_user_id:
            return {
                "found": False,
                "error": "WORKER_ROLE_RESTRICTED",
                "message": "Workers can only access their own performance data.",
            }

        start, end = _date_range_window(date_range)
        sales = await (
            db["sales"]
            .aggregate(
                [
                    {
                        "$match": {
                            "businessId": business_id,
                            "createdBy": {"$in": [target_user_id, target_user.get("_id")]},
                            "createdAt": {"$gte": start, "$lte": end},
                            "status": {"$ne": "REFUNDED"},
                        }
                    },
                    {
                        "$group": {
                            "_id": None,
                            "transactions": {"$sum": 1},
                            "revenue": {"$sum": {"$ifNull": ["$netRevenue", 0]}},
                            "profit": {"$sum": {"$ifNull": ["$grossProfit", 0]}},
                        }
                    },
                ]
            )
            .to_list(length=1)
        )
        totals = sales[0] if sales else {"transactions": 0, "revenue": 0, "profit": 0}
        totals.pop("_id", None)
        return {
            "found": True,
            "employeeId": target_user_id,
            "employee": target_user.get("fullName") or target_user.get("name") or target_user.get("email"),
            "dateRange": date_range,
            "from": start,
            "to": end,
            **totals,
        }

    async def list_employees(
        role: str | None = None,
        status: str | None = None,
        store_id: str | None = None,
        search: str | None = None,
        limit: int = 50,
    ) -> dict[str, Any]:
        """Return a roster of employees/workers for the current business.

        This is what the **Members** page renders. Use it whenever the user asks
        for a list, roster, or "general details" of workers / employees / staff /
        team members, or asks how many of a given role are active.
        """

        query: dict[str, Any] = {"businessId": business_id}

        if role:
            query["role"] = {"$regex": f"^{role.strip()}$", "$options": "i"}
        if status:
            normalized = status.strip().lower()
            if normalized in {"active", "enabled"}:
                query["isActive"] = True
            elif normalized in {"inactive", "disabled"}:
                query["isActive"] = False
        if store_id:
            query["$or"] = [
                {"assignedStore": store_id},
                {"assignedStoreId": store_id},
                {"storeId": store_id},
            ]
        if search:
            escaped = search.strip().replace("\\", "\\\\")
            query["$and"] = query.get("$and", []) + [
                {
                    "$or": [
                        {"name": {"$regex": escaped, "$options": "i"}},
                        {"fullName": {"$regex": escaped, "$options": "i"}},
                        {"email": {"$regex": escaped, "$options": "i"}},
                    ]
                }
            ]

        # Hide password material even if the projection gets bypassed somehow.
        cursor = (
            db["users"]
            .find(
                query,
                {
                    "passwordHash": 0,
                    "password": 0,
                    "refreshToken": 0,
                    "refreshTokens": 0,
                },
            )
            .sort([("name", 1)])
            .limit(limit)
        )
        docs = [doc async for doc in cursor]

        # Resolve store ids to names so the LLM can show "Basar — BasharBurger"
        # instead of "Basar — 6a4a2527a4e93e36dd99b677". Single batched query.
        store_ids = {
            str(doc.get("assignedStore") or doc.get("assignedStoreId") or doc.get("storeId"))
            for doc in docs
            if doc.get("assignedStore") or doc.get("assignedStoreId") or doc.get("storeId")
        }
        store_name_by_id: dict[str, str] = {}
        if store_ids:
            from bson import ObjectId

            obj_ids: list[ObjectId] = []
            for sid in store_ids:
                try:
                    obj_ids.append(ObjectId(sid))
                except Exception:
                    # Not a valid ObjectId -- leave as raw id, name lookup will skip.
                    continue
            if obj_ids:
                async for store in db["stores"].find(
                    {"_id": {"$in": obj_ids}, "businessId": business_id},
                    {"name": 1, "code": 1},
                ):
                    store_name_by_id[str(store["_id"])] = store.get("name") or store.get("code")

        workers = [
            {
                "id": str(doc.get("_id")),
                "name": doc.get("fullName") or doc.get("name") or doc.get("email"),
                "email": doc.get("email"),
                "role": doc.get("role"),
                "store": store_name_by_id.get(
                    str(doc.get("assignedStore") or doc.get("assignedStoreId") or doc.get("storeId")),
                    str(doc.get("assignedStore") or doc.get("assignedStoreId") or doc.get("storeId") or ""),
                ) or None,
                "status": "active" if doc.get("isActive") else "inactive",
                "joinedAt": doc.get("createdAt"),
            }
            for doc in docs
        ]

        # Build a small by-role breakdown so "how many X" questions are answered
        # without a second tool call.
        role_counts: dict[str, int] = {}
        for w in workers:
            r = (w.get("role") or "UNKNOWN").upper()
            role_counts[r] = role_counts.get(r, 0) + 1

        return {
            "count": len(workers),
            "roleCounts": role_counts,
            "workers": workers,
        }

    return [
        StructuredTool.from_function(
            coroutine=get_employee_performance,
            func=None,
            name="get_employee_performance",
            description="Get employee sales performance summary for a date range.",
            args_schema=EmployeePerformanceArgs,
        ),
        StructuredTool.from_function(
            coroutine=list_employees,
            func=None,
            name="list_employees",
            description=(
                "List employees / workers / staff members for the current business. "
                "Use this when the user asks for a roster, a member list, or 'general "
                "details' about workers. Supports filtering by role, status (active/inactive), "
                "store, and a search substring. Returns name, email, role, store, status, "
                "and a role breakdown."
            ),
            args_schema=EmployeeRosterArgs,
        ),
    ]
