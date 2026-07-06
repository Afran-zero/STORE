"""Redis-backed cache for AI tool calls and MCP queries.

Keys are namespaced, business-scoped, and derived from a deterministic
hash of the call parameters so that the same query from the same business
returns the same cached payload. On any Redis failure the helper falls
back to the producer so the AI path keeps working without Redis.
"""
from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Awaitable, Callable

import redis.asyncio as aioredis
from redis.exceptions import RedisError

from app.database.redis_client import get_redis, redis_manager

logger = logging.getLogger(__name__)


def _stable_key(scope: str, business_id: str, params: dict[str, Any]) -> str:
    """Build a deterministic Redis key.

    ``scope`` is a short namespace (``aitool`` / ``mcp``). ``params`` is
    normalised through ``json.dumps`` with sorted keys so that two calls
    with the same logical content hash to the same value regardless of
    dict ordering.
    """
    raw = json.dumps(params or {}, sort_keys=True, default=str, separators=(",", ":"))
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"ai:{scope}:{business_id or 'global'}:{digest}"


async def cached(
    *,
    scope: str,
    business_id: str,
    params: dict[str, Any],
    ttl: int,
    producer: Callable[[], Awaitable[Any]],
) -> Any:
    """Run ``producer`` and cache its JSON-serialisable result for ``ttl`` seconds.

    - Cache hit → return decoded value.
    - Cache miss → await producer, ``json.dumps`` the result, SETEX it, return.
    - Redis error at any point → log + fall back to producer.
    """
    key = _stable_key(scope, business_id, params)
    redis: aioredis.Redis = get_redis()
    try:
        cached_value = await redis.get(key)
    except RedisError as exc:
        logger.warning("cache.get failed for %s: %s", scope, exc)
        redis_manager.mark_unavailable()
        return await producer()

    if cached_value is not None:
        try:
            return json.loads(cached_value)
        except (TypeError, ValueError):
            # Corrupt entry — drop it and recompute.
            try:
                await redis.delete(key)
            except RedisError:
                pass

    result = await producer()
    try:
        await redis.set(key, json.dumps(result, default=str), ex=max(int(ttl), 1))
    except RedisError as exc:
        logger.warning("cache.set failed for %s: %s", scope, exc)
        redis_manager.mark_unavailable()
    return result


async def invalidate_scope(scope: str, business_id: str) -> int:
    """Drop every cached entry under ``scope`` for a single business.

    Returns the number of keys deleted. Used by the admin tools to force a
    refresh after a write that should invalidate the read-only MCP view
    (kept off the hot path).
    """
    redis: aioredis.Redis = get_redis()
    pattern = f"ai:{scope}:{business_id or 'global'}:*"
    deleted = 0
    try:
        async for key in redis.scan_iter(match=pattern, count=200):
            await redis.delete(key)
            deleted += 1
    except RedisError as exc:
        logger.warning("cache.invalidate failed: %s", exc)
    return deleted