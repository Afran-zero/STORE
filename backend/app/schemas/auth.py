from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field


PASSWORD_PATTERN = r"^(?=.*\d).{8,}$"


class RegisterRequest(BaseModel):
    businessName: Annotated[str, Field(min_length=1)]
    username: Annotated[str, Field(min_length=3)]
    password: Annotated[str, Field(min_length=8, pattern=PASSWORD_PATTERN)]
    name: Annotated[str, Field(min_length=1)]
    industry: str | None = None


class LoginRequest(BaseModel):
    username: Annotated[str, Field(min_length=1)]
    password: Annotated[str, Field(min_length=1)]


class RefreshTokenRequest(BaseModel):
    refreshToken: Annotated[str, Field(min_length=1)]


class ForgotPasswordRequest(BaseModel):
    username: Annotated[str, Field(min_length=1)]


class ResetPasswordRequest(BaseModel):
    token: Annotated[str, Field(min_length=1)]
    password: Annotated[str, Field(min_length=8, pattern=PASSWORD_PATTERN)]


class ChangePasswordRequest(BaseModel):
    currentPassword: Annotated[str, Field(min_length=1)]
    newPassword: Annotated[str, Field(min_length=8, pattern=PASSWORD_PATTERN)]


class TokenPairResponse(BaseModel):
    accessToken: str
    refreshToken: str
