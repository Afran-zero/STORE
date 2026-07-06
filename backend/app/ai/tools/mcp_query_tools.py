from __future__ import annotations

from typing import Any

from langchain_core.tools import StructuredTool
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, Field


def _service(db: AsyncIOMotorDatabase):
    """Lazy import to break the circular import
    (app.services -> app.ai.agent -> app.ai.tools -> app.services).
    """
    from app.services.mcp_service import McpService
    return McpService(db)


def build_mcp_query_tools(db: AsyncIOMotorDatabase, business_id: str) -> list[StructuredTool]:
    """Generic, read-only MongoDB query tools for the LangChain agent.

    These wrap the in-process ``McpService`` (the same service that backs the
    HTTP bridge at ``/api/v1/mcp/*``), so every safety guarantee the bridge
    gives the Data tab carries over:

    * Collections are validated against ``ALLOWED_COLLECTIONS``.
    * Unsafe operators (``$where``, ``$expr``, ``$function``, ``$accumulator``,
      ``$jsonSchema``, …) are scrubbed from filters and pipelines.
    * Forbidden aggregation stages (``$out``, ``$merge``, ``$currentOp``, …)
      raise ``MCP_FORBIDDEN_STAGE``.
    * ``{ businessId: <jwt> }`` is auto-injected; callers cannot bypass it.
    * Result sizes are capped (``MAX_LIMIT = 200``,
      ``MAX_AGGREGATION_RESULTS = 500``).
    * Results are cached in Redis under the ``mcp`` scope, so repeated
      questions within the TTL don't re-hit MongoDB.

    Use these tools for ad-hoc operational questions that don't have a
    dedicated typed tool (``list_food_menu``, ``get_top_selling_items``, etc.).
    """

    svc = _service(db)

    class FindArgs(BaseModel):
        collection: str = Field(
            min_length=1,
            max_length=64,
            description=(
                "Collection name from the MCP allowlist "
                "(e.g. 'food_items', 'sales', 'inventory_logs', 'tickets')."
            ),
        )
        filter: dict[str, Any] | None = Field(
            default=None,
            description=(
                "Optional MongoDB filter. businessId is auto-injected and will "
                "override any value you pass; do not include it."
            ),
        )
        projection: dict[str, Any] | None = Field(
            default=None,
            description="Optional projection to limit returned fields.",
        )
        sort: list[dict[str, int]] | None = Field(
            default=None,
            description="Optional sort, e.g. [{'createdAt': -1}]. Values: 1 asc, -1 desc.",
        )
        limit: int = Field(
            default=50,
            ge=1,
            le=200,
            description="Max documents to return (1-200).",
        )

    class CountArgs(BaseModel):
        collection: str = Field(min_length=1, max_length=64)
        filter: dict[str, Any] | None = Field(
            default=None,
            description="Optional MongoDB filter. businessId is auto-injected.",
        )

    class AggregateArgs(BaseModel):
        collection: str = Field(min_length=1, max_length=64)
        pipeline: list[dict[str, Any]] = Field(
            default_factory=list,
            description=(
                "MongoDB aggregation pipeline. businessId is auto-injected into "
                "the first $match. $out / $merge / $currentOp / $killCursors are "
                "rejected."
            ),
        )
        limit: int = Field(default=100, ge=1, le=500)

    async def mcp_find(
        collection: str,
        filter: dict[str, Any] | None = None,
        projection: dict[str, Any] | None = None,
        sort: list[dict[str, int]] | None = None,
        limit: int = 50,
    ) -> dict[str, Any]:
        sort_pairs: list[tuple[str, int]] = []
        for entry in sort or []:
            for k, v in entry.items():
                sort_pairs.append((k, int(v)))
        docs = await svc.find(
            business_id=business_id,
            collection=collection,
            filter=filter,
            projection=projection,
            sort=sort_pairs or None,
            limit=limit,
        )
        # Compact the response -- strip _id and timestamps for token economy.
        return {
            "count": len(docs),
            "documents": [
                {k: v for k, v in doc.items() if k not in {"_id", "businessId"}}
                for doc in docs
            ],
        }

    async def mcp_count(collection: str, filter: dict[str, Any] | None = None) -> dict[str, Any]:
        n = await svc.count(
            business_id=business_id, collection=collection, filter=filter
        )
        return {"count": n}

    async def mcp_aggregate(
        collection: str, pipeline: list[dict[str, Any]], limit: int = 100
    ) -> dict[str, Any]:
        docs = await svc.aggregate(
            business_id=business_id,
            collection=collection,
            pipeline=pipeline,
            limit=limit,
        )
        return {
            "count": len(docs),
            "documents": [
                {k: v for k, v in doc.items() if k not in {"_id", "businessId"}}
                for doc in docs
            ],
        }

    return [
        StructuredTool.from_function(
            coroutine=mcp_find,
            func=None,
            name="mcp_find",
            description=(
                "Read documents from an allowlisted MongoDB collection. "
                "Use this for ad-hoc questions with no dedicated tool "
                "(e.g. 'show me the last 5 tickets', 'how many active employees do I have'). "
                "The collection must be from the MCP allowlist and the filter is "
                "auto-scoped to the current business."
            ),
            args_schema=FindArgs,
        ),
        StructuredTool.from_function(
            coroutine=mcp_count,
            func=None,
            name="mcp_count",
            description=(
                "Count documents in an allowlisted MongoDB collection. "
                "Use this for 'how many X?' questions. "
                "Auto-scoped to the current business."
            ),
            args_schema=CountArgs,
        ),
        StructuredTool.from_function(
            coroutine=mcp_aggregate,
            func=None,
            name="mcp_aggregate",
            description=(
                "Run a read-only MongoDB aggregation pipeline on an allowlisted "
                "collection. $out, $merge, $currentOp, $killCursors, $indexStats, "
                "$listSessions are rejected. businessId is auto-injected into the "
                "first $match. Result is capped at 500 docs. Use this for grouped "
                "or computed answers (e.g. 'total sales by store this month')."
            ),
            args_schema=AggregateArgs,
        ),
    ]
