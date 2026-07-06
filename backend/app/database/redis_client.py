from __future__ import annotations

import logging
from typing import Any

from redis.asyncio import Redis

from app.config import get_settings

logger = logging.getLogger(__name__)


class RedisClientManager:
    """Lazy async Redis pool.

    A single ``redis.asyncio.Redis`` instance is created on first access and
    reused for the lifetime of the process. ``aclose()`` is called from the
    FastAPI lifespan so the pool is drained cleanly on shutdown.
    """

    def __init__(self) -> None:
        self._client: Redis | None = None
        self._available: bool = True

    def client(self) -> Redis:
        if self._client is None:
            settings = get_settings()
            self._client = Redis.from_url(
                settings.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
                health_check_interval=30,
            )
        return self._client

    def is_available(self) -> bool:
        return self._available and self._client is not None

    def mark_unavailable(self) -> None:
        self._available = False

    async def aclose(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception as exc:  # pragma: no cover — best effort
                logger.warning("Redis aclose failed: %s", exc)
            self._client = None


redis_manager = RedisClientManager()


def get_redis() -> Redis:
    """Return the shared async Redis client.

    Callers must handle ``RedisError`` themselves; the cache and rate-limit
    helpers swallow them so the AI path keeps working if Redis is down.
    """
    return redis_manager.client()


async def ping() -> bool:
    try:
        return bool(await get_redis().ping())
    except Exception as exc:  # pragma: no cover — best effort
        logger.warning("Redis ping failed: %s", exc)
        redis_manager.mark_unavailable()
        return False


def safe_call(awaitable_factory: Any) -> Any:
    """Helper kept for tests; production paths use try/except inline."""
    return awaitable_factory