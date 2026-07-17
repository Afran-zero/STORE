from __future__ import annotations

from collections.abc import AsyncIterator

from app.core.redis_client import redis_manager
from app.schemas.sync import SyncEvent


def _channel(business_id: str) -> str:
    return f"sync:business:{business_id}"


class SyncService:
    async def publish(self, event: SyncEvent) -> None:
        client = redis_manager.client()
        await client.publish(_channel(event.businessId), event.model_dump_json())

    async def subscribe(self, business_id: str) -> AsyncIterator[SyncEvent]:
        client = redis_manager.client()
        pubsub = client.pubsub()
        try:
            await pubsub.subscribe(_channel(business_id))
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                data = message.get("data")
                if not data:
                    continue
                yield SyncEvent.model_validate_json(data)
        finally:
            await pubsub.unsubscribe(_channel(business_id))
            await pubsub.aclose()


sync_service = SyncService()
