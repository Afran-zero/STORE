from __future__ import annotations

import asyncio

import pytest

from app.core.redis_client import redis_manager
from app.schemas.sync import SyncEvent
from app.services.sync_service import sync_service


def test_sync_event_deleted_action_forbids_payload() -> None:
    with pytest.raises(ValueError):
        SyncEvent(
            entity="inventory", action="deleted", businessId="biz_1",
            recordId="rec_1", payload={"should": "not be set"}, actorUserId="user_1",
        )


def test_sync_event_deleted_action_allows_no_payload() -> None:
    event = SyncEvent(entity="inventory", action="deleted", businessId="biz_1", recordId="rec_1", actorUserId="user_1")
    assert event.payload is None


class _FakePubSub:
    def __init__(self, redis: "_FakeRedis") -> None:
        self._redis = redis
        self._queue: asyncio.Queue = asyncio.Queue()
        self._channel: str | None = None

    async def subscribe(self, channel: str) -> None:
        self._channel = channel
        self._redis.subscribers.setdefault(channel, []).append(self._queue)

    async def unsubscribe(self, channel: str) -> None:
        subs = self._redis.subscribers.get(channel, [])
        if self._queue in subs:
            subs.remove(self._queue)

    async def aclose(self) -> None:
        pass

    async def listen(self):
        while True:
            message = await self._queue.get()
            yield message


class _FakeRedis:
    def __init__(self) -> None:
        self.subscribers: dict[str, list[asyncio.Queue]] = {}

    async def publish(self, channel: str, data: str) -> None:
        for queue in self.subscribers.get(channel, []):
            await queue.put({"type": "message", "channel": channel, "data": data})

    def pubsub(self) -> _FakePubSub:
        return _FakePubSub(self)


@pytest.mark.asyncio
async def test_publish_subscribe_round_trip(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_redis = _FakeRedis()
    monkeypatch.setattr(redis_manager, "_client", fake_redis)

    event = SyncEvent(
        entity="inventory", action="updated", businessId="biz_1",
        recordId="rec_1", payload={"currentStock": 5}, actorUserId="user_1",
    )

    agen = sync_service.subscribe("biz_1")
    receive_task = asyncio.create_task(agen.__anext__())
    await asyncio.sleep(0)  # let the generator subscribe and block on the queue

    await sync_service.publish(event)
    received = await asyncio.wait_for(receive_task, timeout=1)

    assert received.eventId == event.eventId
    assert received.entity == "inventory"
    assert received.businessId == "biz_1"

    await agen.aclose()


@pytest.mark.asyncio
async def test_subscribe_only_receives_own_business_channel(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_redis = _FakeRedis()
    monkeypatch.setattr(redis_manager, "_client", fake_redis)

    other_business_event = SyncEvent(
        entity="inventory", action="updated", businessId="biz_2",
        recordId="rec_1", payload=None, actorUserId="user_1",
    )
    own_business_event = SyncEvent(
        entity="inventory", action="updated", businessId="biz_1",
        recordId="rec_2", payload=None, actorUserId="user_1",
    )

    agen = sync_service.subscribe("biz_1")
    receive_task = asyncio.create_task(agen.__anext__())
    await asyncio.sleep(0)

    await sync_service.publish(other_business_event)
    await sync_service.publish(own_business_event)
    received = await asyncio.wait_for(receive_task, timeout=1)

    assert received.recordId == "rec_2"

    await agen.aclose()
