from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, Field


EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
PASSWORD_PATTERN = r"^(?=.*\d).{8,}$"


class RegisterRequest(BaseModel):
    businessName: Annotated[str, Field(min_length=1)]
    email: Annotated[str, Field(pattern=EMAIL_PATTERN)]
    password: Annotated[str, Field(min_length=8, pattern=PASSWORD_PATTERN)]
    name: Annotated[str, Field(min_length=1)]
    industry: str | None = None


class LoginRequest(BaseModel):
    email: Annotated[str, Field(pattern=EMAIL_PATTERN)]
    password: Annotated[str, Field(min_length=1)]


class RefreshTokenRequest(BaseModel):
    refreshToken: Annotated[str, Field(min_length=1)]


class ForgotPasswordRequest(BaseModel):
    email: Annotated[str, Field(pattern=EMAIL_PATTERN)]


class ResetPasswordRequest(BaseModel):
    token: Annotated[str, Field(min_length=1)]
    password: Annotated[str, Field(min_length=8, pattern=PASSWORD_PATTERN)]


class ChangePasswordRequest(BaseModel):
    currentPassword: Annotated[str, Field(min_length=1)]
    newPassword: Annotated[str, Field(min_length=8, pattern=PASSWORD_PATTERN)]


class TokenPairResponse(BaseModel):
    accessToken: str
    refreshToken: str
