"""Unit tests for the rate-limit helper.

We do not require a running Redis here. The Lua script is exercised by
mocking the Redis client's ``eval`` to return sliding-window counts. The
``RateLimitError`` is constructed directly and verified for status code +
Retry-After value.

Run with:
    cd STORE/backend && python -m pytest tests/test_ai_rate_limit.py -q
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.dependencies.rate_limit import RateLimitError, _LUA_SCRIPT  # noqa: E402


def test_rate_limit_error_shape():
    err = RateLimitError("AI_RATE_LIMITED", "Slow down", retry_after=12)
    assert err.status_code == 429
    assert (err.details or {}).get("retry_after") == 12
    assert "Slow down" in err.message


def test_rate_limit_lua_script_loads():
    assert "ZREMRANGEBYSCORE" in _LUA_SCRIPT
    assert "ZCARD" in _LUA_SCRIPT
    assert "ZADD" in _LUA_SCRIPT


def test_rate_limit_dependency_fails_open_when_redis_missing():
    """If Redis is unreachable, the dependency should allow the request."""
    import asyncio

    from app.dependencies.rate_limit import _check  # noqa: E402

    class _Down:
        async def eval(self, *_args, **_kwargs):  # pragma: no cover - test
            from redis.exceptions import RedisError

            raise RedisError("down")

    async def run():
        # Should NOT raise when Redis errors.
        decision = await _check("test", "u-1")
        assert decision.allowed is True

    asyncio.run(run())


def test_rate_limit_dependency_allows_under_limit():
    """When the Lua script returns (1, limit, remaining, 0) we allow."""
    import asyncio

    from app.dependencies.rate_limit import _check  # noqa: E402

    class _StubRedis:
        async def eval(self, *_args, **_kwargs):
            return [1, 25, 24, 0]

    async def run():
        decision = await _check("test", "u-1")
        assert decision.allowed is True

    # Patch the redis client.
    from app.dependencies import rate_limit as rl_mod

    original_get_redis = rl_mod.get_redis
    rl_mod.get_redis = lambda: _StubRedis()  # type: ignore[assignment]
    try:
        asyncio.run(run())
    finally:
        rl_mod.get_redis = original_get_redis  # type: ignore[assignment]


def test_rate_limit_dependency_blocks_over_limit():
    import asyncio

    from app.dependencies.rate_limit import _check  # noqa: E402

    class _StubRedis:
        async def eval(self, *_args, **_kwargs):
            # allowed=0, limit=25, remaining=0, retry_ms=8000
            return [0, 25, 0, 8000]

    async def run():
        decision = await _check("test", "u-1")
        assert decision.allowed is False
        assert decision.retry_after == 8

    from app.dependencies import rate_limit as rl_mod

    original_get_redis = rl_mod.get_redis
    rl_mod.get_redis = lambda: _StubRedis()  # type: ignore[assignment]
    try:
        asyncio.run(run())
    finally:
        rl_mod.get_redis = original_get_redis  # type: ignore[assignment]