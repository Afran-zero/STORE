"""Pure unit tests for the cache key derivation.

The ``cached()`` helper itself requires a live Redis; instead we validate the
helper that derives stable cache keys, and confirm that the wrapper degrades
gracefully when Redis is unavailable.

Run with:
    cd STORE/backend && python -m pytest tests/test_ai_cache.py -q
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.services.cache import _stable_key  # noqa: E402


def test_key_is_deterministic_for_same_params():
    params = {"businessId": "biz-1", "collection": "sales", "limit": 5}
    a = _stable_key("mcp", "biz-1", params)
    b = _stable_key("mcp", "biz-1", params)
    assert a == b


def test_key_differs_across_tenants():
    params = {"collection": "sales", "limit": 5}
    a = _stable_key("mcp", "biz-1", params)
    b = _stable_key("mcp", "biz-2", params)
    assert a != b


def test_key_differs_across_scopes():
    params = {"x": 1}
    assert _stable_key("aitool", "biz-1", params) != _stable_key("mcp", "biz-1", params)


def test_key_ignores_dict_order():
    params_a = {"a": 1, "b": 2, "c": 3}
    params_b = {"c": 3, "b": 2, "a": 1}
    assert _stable_key("mcp", "biz-1", params_a) == _stable_key("mcp", "biz-1", params_b)


def test_cached_falls_back_when_redis_unavailable():
    """If Redis is unreachable, ``cached`` should still return the producer result."""
    from app.services import cache as cache_mod  # noqa: E402
    from app.services.cache import cached  # noqa: E402

    calls = {"count": 0}

    async def producer():
        calls["count"] += 1
        return {"value": 42}

    async def run():
        # Replace the redis client used by cached with a stub whose ``get`` /
        # ``set`` raise RedisError, simulating an unavailable server.
        class _BrokenRedis:
            async def get(self, *_args, **_kwargs):  # pragma: no cover - test
                from redis.exceptions import RedisError

                raise RedisError("simulated outage")

            async def set(self, *_args, **_kwargs):  # pragma: no cover - test
                from redis.exceptions import RedisError

                raise RedisError("simulated outage")

        original = cache_mod.get_redis
        cache_mod.get_redis = lambda: _BrokenRedis()  # type: ignore[assignment]
        try:
            result_a = await cached(scope="test", business_id="biz-x", params={"k": "v"}, ttl=60, producer=producer)
            result_b = await cached(scope="test", business_id="biz-x", params={"k": "v"}, ttl=60, producer=producer)
        finally:
            cache_mod.get_redis = original  # type: ignore[assignment]

        assert result_a == {"value": 42}
        assert result_b == {"value": 42}
        # Both calls invoked the producer since cache is disabled.
        assert calls["count"] == 2

    asyncio.run(run())