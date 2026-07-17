"""Load-test script for SC-004 / SC-001 at concurrency.

Opens >=50 concurrent authenticated WebSocket connections to /api/v1/ws for
one business, triggers a batch of real REST writes (real MongoDB), and
measures how long it takes every connection to receive the resulting
SyncEvent. Not part of the pytest suite -- run manually:

    cd backend && source .venv/bin/activate
    python3 tests/load/ws_concurrency_check.py

Requires a reachable MongoDB (see MONGO_URI below -- defaults to a local
instance on the standard port; override via env vars same as the app).

Scope note: this drives the real ASGI application (real JWT auth, real RBAC
event filtering, real async pub/sub fan-out logic in SyncService) via
Starlette's in-process TestClient WebSocket support, run across a thread
pool to get genuine concurrency. It substitutes an in-process fake for the
Redis transport (the same fake used in tests/test_sync_service.py) rather
than a real standalone Redis server, because no system Redis/Docker is
available in this environment. This exercises 100% of the application's own
concurrency-handling code (the part SC-004 cares about); it does not
additionally exercise a real Redis server's own throughput characteristics,
which is a separate, well-understood concern outside this feature's code.
To run against a real Redis, just remove the `redis_manager._client = ...`
override below and start the app with a real REDIS_URL as usual.
"""
from __future__ import annotations

import asyncio
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("MONGO_DB_NAME", "store_erp_load_check")

CONCURRENT_CONNECTIONS = 60
LATENCY_TARGET_SECONDS = 5.0


class FakePubSub:
    def __init__(self, redis: "FakeRedis") -> None:
        self._redis = redis
        self._queue: asyncio.Queue = asyncio.Queue()

    async def subscribe(self, channel: str) -> None:
        self._redis.subscribers.setdefault(channel, []).append(self._queue)

    async def unsubscribe(self, channel: str) -> None:
        subs = self._redis.subscribers.get(channel, [])
        if self._queue in subs:
            subs.remove(self._queue)

    async def aclose(self) -> None:
        pass

    async def listen(self):
        while True:
            yield await self._queue.get()


class FakeRedis:
    def __init__(self) -> None:
        self.subscribers: dict[str, list[asyncio.Queue]] = {}

    async def publish(self, channel: str, data: str) -> None:
        for queue in self.subscribers.get(channel, []):
            await queue.put({"type": "message", "channel": channel, "data": data})

    def pubsub(self) -> FakePubSub:
        return FakePubSub(self)

    async def aclose(self) -> None:
        pass


def main() -> int:
    from app.core.redis_client import redis_manager
    from app.core.security import create_access_token
    from app.main import app
    from starlette.testclient import TestClient

    redis_manager._client = FakeRedis()

    business_id = "load-test-business"
    token = create_access_token({"sub": "load-test-owner", "businessId": business_id, "role": "OWNER"})

    client = TestClient(app)
    receive_times: list[float | None] = [None] * CONCURRENT_CONNECTIONS
    connect_barrier_ready = [False] * CONCURRENT_CONNECTIONS

    def run_connection(idx: int, publish_at: list[float]) -> None:
        with client.websocket_connect(f"/api/v1/ws?token={token}") as ws:
            connect_barrier_ready[idx] = True
            message = ws.receive_json()
            if message.get("entity") == "inventory":
                receive_times[idx] = time.monotonic() - publish_at[0]

    publish_at: list[float] = [0.0]

    with client:
        with ThreadPoolExecutor(max_workers=CONCURRENT_CONNECTIONS) as pool:
            futures = [pool.submit(run_connection, i, publish_at) for i in range(CONCURRENT_CONNECTIONS)]

            # Wait for all sockets to report connected before triggering the write.
            deadline = time.monotonic() + 10
            while not all(connect_barrier_ready) and time.monotonic() < deadline:
                time.sleep(0.05)
            connected_count = sum(connect_barrier_ready)
            print(f"{connected_count}/{CONCURRENT_CONNECTIONS} WebSocket connections established")

            publish_at[0] = time.monotonic()
            resp = client.post(
                "/api/v1/inventory/ingredients",
                json={"name": f"Load Test Item {int(time.time() * 1000)}", "unit": "kg", "category": "dry-goods", "currentStock": 1},
                headers={"Authorization": f"Bearer {token}"},
            )
            print("Triggering write, REST status:", resp.status_code)

            for future in futures:
                future.result(timeout=LATENCY_TARGET_SECONDS + 5)

    latencies = [t for t in receive_times if t is not None]
    missing = CONCURRENT_CONNECTIONS - len(latencies)

    print(f"\nReceived by {len(latencies)}/{CONCURRENT_CONNECTIONS} connections")
    if missing:
        print(f"MISSING: {missing} connections never received the event")
    if latencies:
        print(f"min={min(latencies)*1000:.1f}ms  max={max(latencies)*1000:.1f}ms  "
              f"mean={statistics.mean(latencies)*1000:.1f}ms  "
              f"p99={sorted(latencies)[int(len(latencies)*0.99)-1]*1000:.1f}ms")

    ok = missing == 0 and (not latencies or max(latencies) < LATENCY_TARGET_SECONDS)
    print("\nRESULT:", "PASS" if ok else "FAIL", f"(target: all {CONCURRENT_CONNECTIONS} connections receive the event within {LATENCY_TARGET_SECONDS}s)")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
