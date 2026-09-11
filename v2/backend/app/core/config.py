from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: Literal["local", "test", "staging", "production"] = "local"
    database_url: str
    test_database_url: str | None = None
    jwt_secret: SecretStr = Field(min_length=32)
    jwt_algorithm: Literal["HS256"] = "HS256"
    jwt_issuer: str = "careermate-v2"
    jwt_audience: str = "careermate-v2-web"
    access_token_expire_minutes: int = Field(default=60, ge=5, le=1440)
    cors_origins: str = "http://localhost:3000"
    demo_super_admin_password: SecretStr | None = None
    demo_company_admin_password: SecretStr | None = None
    demo_employee_password: SecretStr | None = None
    login_rate_limit_attempts: int = Field(default=5, ge=1, le=100)
    login_rate_limit_ip_attempts: int = Field(default=25, ge=1, le=1_000)
    login_rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    login_rate_limit_max_keys: int = Field(default=10_000, ge=100, le=1_000_000)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="CAREERMATE_",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def require_shared_security_storage_when_deployed(self) -> Self:
        if self.environment in {"staging", "production"} and not self.database_url.startswith(
            ("postgresql://", "postgresql+asyncpg://")
        ):
            raise ValueError(
                "Staging and production require PostgreSQL for shared login rate limiting"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
