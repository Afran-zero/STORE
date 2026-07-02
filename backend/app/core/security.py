"""Password hashing + JWT helpers.

Uses ``bcrypt`` directly (passlib currently has a known incompatibility with
``bcrypt>=4.1`` on Python 3.14). All admin/worker passwords round-trip through
``hash_password`` and ``verify_password``.
"""
from __future__ import annotations

import hmac
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.config import get_settings


# bcrypt has a hard 72-byte limit on the password input; truncate silently.
def _truncate(password: str) -> bytes:
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(_truncate(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time bcrypt comparison; tolerant of length mismatches."""
    try:
        return bcrypt.checkpw(_truncate(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _encode_token(payload: dict[str, Any], *, secret: str, expires_delta: timedelta) -> str:
    token_payload = payload.copy()
    token_payload["exp"] = datetime.now(timezone.utc) + expires_delta
    return jwt.encode(token_payload, secret, algorithm="HS256")


def create_access_token(payload: dict[str, Any]) -> str:
    settings = get_settings()
    return _encode_token(payload, secret=settings.jwt_secret, expires_delta=timedelta(minutes=settings.access_token_expiry_minutes))


def create_refresh_token(payload: dict[str, Any]) -> str:
    settings = get_settings()
    return _encode_token(payload, secret=settings.jwt_refresh_secret, expires_delta=timedelta(days=settings.refresh_token_expiry_days))


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])


def decode_refresh_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_refresh_secret, algorithms=["HS256"])


def is_token_valid(token: str, *, refresh: bool = False) -> bool:
    try:
        if refresh:
            decode_refresh_token(token)
        else:
            decode_access_token(token)
        return True
    except JWTError:
        return False


def safe_compare(a: str, b: str) -> bool:
    """Constant-time string comparison for secrets."""
    return hmac.compare_digest(a.encode("utf-8"), b.encode("utf-8"))
