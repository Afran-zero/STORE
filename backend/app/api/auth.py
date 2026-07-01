from __future__ import annotations

from fastapi import APIRouter, Depends, status
from jose import JWTError

from app.config import get_settings
from app.core.exceptions import AppException, UnauthorizedError
from app.core.response import success_payload
from app.core.security import create_access_token, create_refresh_token, decode_refresh_token
from app.dependencies.auth import get_current_user
from app.schemas.auth import ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, RefreshTokenRequest, RegisterRequest, ResetPasswordRequest


router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_payload() -> dict[str, str | None]:
    settings = get_settings()
    return {
        "sub": "admin-1",
        "businessId": settings.hardcoded_business_id,
        "role": "OWNER",
        "assignedStore": None,
        "name": settings.hardcoded_admin_name,
        "username": settings.admin_username,
    }


def _token_bundle() -> dict[str, object]:
    payload = _auth_payload()
    access_token = create_access_token(payload)
    refresh_token = create_refresh_token({"sub": payload["sub"], "type": "refresh"})
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "user": {
            "userId": payload["sub"],
            "businessId": payload["businessId"],
            "role": payload["role"],
            "assignedStore": payload["assignedStore"],
            "name": payload["name"],
            "username": payload["username"],
        },
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(_: RegisterRequest):
    raise AppException(
        code="REGISTER_DISABLED",
        message="Registration is disabled in hardcoded auth mode",
        status_code=status.HTTP_403_FORBIDDEN,
    )


@router.post("/login")
async def login(payload: LoginRequest):
    settings = get_settings()
    if payload.username != settings.admin_username or payload.password != settings.admin_password:
        raise UnauthorizedError(code="UNAUTHORIZED", message="Invalid username or password")
    return success_payload(_token_bundle(), message="Login successful")


@router.post("/logout")
async def logout(_: dict = Depends(get_current_user)):
    return success_payload({}, message="Logged out")


@router.post("/refresh-token")
async def refresh_token(payload: RefreshTokenRequest):
    try:
        refresh_payload = decode_refresh_token(payload.refreshToken)
        if refresh_payload.get("type") != "refresh" or refresh_payload.get("sub") != "admin-1":
            raise UnauthorizedError(code="UNAUTHORIZED", message="Invalid refresh token")
    except JWTError as exc:
        raise UnauthorizedError(code="UNAUTHORIZED", message="Invalid refresh token") from exc
    return success_payload(_token_bundle(), message="Token refreshed")


@router.post("/forgot-password")
async def forgot_password(_: ForgotPasswordRequest):
    raise AppException(
        code="EMAIL_DISABLED",
        message="Password reset by email is disabled",
        status_code=status.HTTP_400_BAD_REQUEST,
    )


@router.post("/reset-password")
async def reset_password(_: ResetPasswordRequest):
    raise AppException(
        code="RESET_PASSWORD_DISABLED",
        message="Password reset is disabled in hardcoded auth mode",
        status_code=status.HTTP_400_BAD_REQUEST,
    )


@router.post("/change-password")
async def change_password(_: ChangePasswordRequest, __: dict = Depends(get_current_user)):
    raise AppException(
        code="CHANGE_PASSWORD_DISABLED",
        message="Change password is disabled in hardcoded auth mode",
        status_code=status.HTTP_400_BAD_REQUEST,
    )
