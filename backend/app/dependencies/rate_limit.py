"""Per-user sliding-window rate limit backed by Redis.

The limiter keeps a sorted set per (scope, userId). Each request is added
with score = now (ms). Expired entries are trimmed with ZREMRANGEBYSCORE and
the cardinality is checked against the configured limit. A small burst is
allowed on top of the per-minute budget.

If Redis is unavailable the limiter falls open so the AI keeps working --
a hot path failure should not break chat.
"""
from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header
from redis.exceptions import RedisError

from app.config import get_settings
from app.core.exceptions import AppException
from app.database.redis_client import get_redis, redis_manager
from app.dependencies.auth import CurrentUser, get_current_user

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    retry_after: int  # seconds


_LUA_SCRIPT = """
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now_ms - window_ms)
local count = redis.call('ZCARD', key)
if count >= limit then
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retry_ms = window_ms
    if oldest and oldest[2] then
        retry_ms = (tonumber(oldest[2]) + window_ms) - now_ms
        if retry_ms < 0 then retry_ms = 0 end
    end
    return {0, limit, 0, retry_ms}
end
redis.call('ZADD', key, now_ms, member)
redis.call('PEXPIRE', key, window_ms)
return {1, limit, limit - count - 1, 0}
"""


class RateLimitError(AppException):
    def __init__(self, code: str, message: str, *, retry_after: int) -> None:
        super().__init__(code, message, status_code=429, details={"retry_after": retry_after})
        self.retry_after = retry_after


async def _check(scope: str, user_id: str) -> RateLimitDecision:
    settings = get_settings()
    window_ms = 60_000
    limit = settings.ai_rate_limit_per_minute + settings.ai_rate_limit_burst
    key = f"rl:ai:{scope}:{user_id}"
    now_ms = int(time.time() * 1000)
    member = f"{now_ms}:{user_id}"
    try:
        redis = get_redis()
        result = await redis.eval(_LUA_SCRIPT, 1, key, now_ms, window_ms, limit, member)
    except RedisError as exc:
        logger.warning("rate_limit redis error (fail-open): %s", exc)
        redis_manager.mark_unavailable()
        return RateLimitDecision(True, limit, limit, 0)

    allowed = bool(int(result[0]))
    cfg_limit = int(result[1])
    remaining = int(result[2])
    retry_ms = int(result[3])
    retry_after = max(1, math.ceil(retry_ms / 1000)) if retry_ms else 0
    return RateLimitDecision(allowed, cfg_limit, remaining, retry_after)


async def rate_limit_ai_chat(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    user_id = current_user.userId or "anonymous"
    decision = await _check("chat", user_id)
    if not decision.allowed:
        raise RateLimitError(
            code="AI_RATE_LIMITED",
            message=f"AI chat is rate limited. Try again in {decision.retry_after}s.",
            retry_after=decision.retry_after,
        )
    return current_user


async def rate_limit_mcp(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    user_id = current_user.userId or "anonymous"
    decision = await _check("mcp", user_id)
    if not decision.allowed:
        raise RateLimitError(
            code="MCP_RATE_LIMITED",
            message=f"Read-only data tools are rate limited. Try again in {decision.retry_after}s.",
            retry_after=decision.retry_after,
        )
    return current_user