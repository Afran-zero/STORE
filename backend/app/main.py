from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.core.exceptions import AppException
from app.core.response import error_payload, success_payload
from app.api import api_router
from app.database.client import mongo_manager
from app.database.redis_client import ping as redis_ping, redis_manager

logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    mongo_manager.client()
    try:
        if await redis_ping():
            logger.info("Redis connection healthy at %s", settings.redis_url)
        else:
            logger.warning("Redis not reachable; AI cache + rate limit disabled.")
    except Exception as exc:  # pragma: no cover — best effort
        logger.warning("Redis startup check raised: %s", exc)
    export_openapi_schema()
    yield
    await mongo_manager.close()
    await redis_manager.aclose()


app = FastAPI(title=settings.app_name, version="0.1.0", openapi_url="/openapi.json", docs_url="/docs", redoc_url="/redoc", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.exception_handler(AppException)
async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
    headers: dict[str, str] = {}
    retry_after = (exc.details or {}).get("retry_after") if exc.details else None
    if exc.status_code == 429 and retry_after:
        headers["Retry-After"] = str(int(retry_after))
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(exc.code, exc.message, details=exc.details),
        headers=headers or None,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content=error_payload("VALIDATION_ERROR", "Request validation failed", details={"errors": exc.errors()}))


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content=error_payload("INTERNAL_SERVER_ERROR", "An unexpected error occurred"))


def export_openapi_schema() -> None:
    docs_path = Path(__file__).resolve().parents[2] / "docs" / "openapi.json"
    docs_path.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")


@app.get("/api/v1/health", tags=["system"])
async def health_check() -> dict[str, object]:
    redis_ok = await redis_ping()
    return success_payload(
        {"status": "ok", "redis": "ok" if redis_ok else "unavailable"},
        message="STORE backend is running",
    )
