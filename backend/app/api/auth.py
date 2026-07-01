from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.core.response import success_payload
from app.dependencies.auth import get_current_user
from app.schemas.auth import ChangePasswordRequest, ForgotPasswordRequest, LoginRequest, RefreshTokenRequest, RegisterRequest, ResetPasswordRequest
from app.services.ai_service import AIService


router = APIRouter(prefix="/auth", tags=["auth"])
service = AIService()


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(_: RegisterRequest):
    return await service.placeholder({"accessToken": None, "refreshToken": None}, message="Registration scaffold")


@router.post("/login")
async def login(_: LoginRequest):
    return await service.placeholder({"accessToken": None, "refreshToken": None}, message="Login scaffold")


@router.post("/logout")
async def logout(_: dict = Depends(get_current_user)):
    return success_payload({}, message="Logout scaffold")


@router.post("/refresh-token")
async def refresh_token(_: RefreshTokenRequest):
    return await service.placeholder({"accessToken": None, "refreshToken": None}, message="Refresh token scaffold")


@router.post("/forgot-password")
async def forgot_password(_: ForgotPasswordRequest):
    return success_payload({"token": "123456"}, message="Use the returned token to reset the password")


@router.post("/reset-password")
async def reset_password(_: ResetPasswordRequest):
    return success_payload({}, message="Password reset scaffold")


@router.post("/change-password")
async def change_password(_: ChangePasswordRequest, __: dict = Depends(get_current_user)):
    return await service.placeholder({}, message="Change password scaffold")
