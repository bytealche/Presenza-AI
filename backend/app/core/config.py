from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator
from pydantic import ConfigDict
from typing import List, Union
import os


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────
    APP_NAME: str = "Presenza AI"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # ── Security ─────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ─────────────────────────────────────────
    ALLOWED_ORIGINS: Union[List[str], str] = ["http://localhost:3000"]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # ── Database ─────────────────────────────────────
    DATABASE_URL: str
    TEST_DATABASE_URL: str = ""

    # ── Supabase ─────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    # ── Email (SMTP) ──────────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = ""

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
