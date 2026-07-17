from __future__ import annotations

from redis.asyncio import Redis

from app.config import get_settings


class RedisClientManager:
    def __init__(self) -> None:
        self._client: Redis | None = None

    def client(self) -> Redis:
        if self._client is None:
            settings = get_settings()
            self._client = Redis.from_url(settings.redis_url, decode_responses=True)
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None


redis_manager = RedisClientManager()
