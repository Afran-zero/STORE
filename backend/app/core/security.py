from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


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
