from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "STORE"
    environment: str = Field(default="development", alias="APP_ENV")
    mongo_uri: str = Field(default="mongodb://localhost:27017", alias="MONGO_URI")
    mongo_db_name: str = Field(default="store_erp", alias="MONGO_DB_NAME")
    jwt_secret: str = Field(default="change-me", alias="JWT_SECRET")
    jwt_refresh_secret: str = Field(default="change-me-too", alias="JWT_REFRESH_SECRET")
    access_token_expiry_minutes: int = 15
    refresh_token_expiry_days: int = 30
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    cors_origins: str = Field(default="http://localhost:3000,http://localhost:19006", alias="APP_CORS_ORIGINS")

    def parsed_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
