from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.exceptions import UnauthorizedError
from app.core.security import decode_access_token


bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    userId: str | None = None
    businessId: str | None = None
    role: str | None = None
    assignedStore: str | None = None


async def get_current_user(credentials: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)] = None) -> CurrentUser:
    if credentials is None:
        raise UnauthorizedError()
    token_payload = decode_access_token(credentials.credentials)
    return CurrentUser(
        userId=token_payload.get("sub"),
        businessId=token_payload.get("businessId"),
        role=token_payload.get("role"),
        assignedStore=token_payload.get("assignedStore"),
    )
