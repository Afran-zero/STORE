from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field


class UserCreateRequest(BaseModel):
    name: Annotated[str, Field(min_length=1)]
    email: Annotated[str, Field(min_length=1)]
    role: Annotated[str, Field(min_length=1)]
    assignedStore: str | None = None


class UserUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    role: str | None = None


class UserStatusUpdateRequest(BaseModel):
    isActive: bool


class UserAssignStoreRequest(BaseModel):
    storeId: str | None = None


class UserResetPasswordRequest(BaseModel):
    email: Annotated[str, Field(min_length=1)]
