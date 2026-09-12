from functools import lru_cache
from typing import Literal, Self

from pydantic import Field, HttpUrl, SecretStr, model_validator
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
    demo_login_enabled: bool = False
    login_rate_limit_attempts: int = Field(default=5, ge=1, le=100)
    login_rate_limit_ip_attempts: int = Field(default=25, ge=1, le=1_000)
    login_rate_limit_window_seconds: int = Field(default=60, ge=1, le=3600)
    login_rate_limit_max_keys: int = Field(default=10_000, ge=100, le=1_000_000)
    malware_scanner: Literal["unavailable", "clamav"] = "unavailable"
    clamav_host: str = "127.0.0.1"
    clamav_port: int = Field(default=3310, ge=1, le=65_535)
    clamav_timeout_seconds: float = Field(default=10.0, ge=0.1, le=60.0)
    ocr_engine: Literal["unavailable", "tesseract"] = "unavailable"
    tesseract_executable: str = "tesseract"
    ocr_timeout_seconds: float = Field(default=20.0, ge=1.0, le=60.0)
    profile_import_ai_endpoint: HttpUrl | None = None
    profile_import_ai_model: str | None = Field(default=None, min_length=1, max_length=100)
    profile_import_ai_api_key: SecretStr | None = Field(default=None, min_length=1)
    profile_import_ai_timeout_seconds: float = Field(default=15.0, ge=0.1, le=60.0)
    profile_import_ai_max_attempts: int = Field(default=2, ge=1, le=3)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="CAREERMATE_",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def profile_import_ai_configured(self) -> bool:
        return (
            self.profile_import_ai_endpoint is not None
            and self.profile_import_ai_model is not None
            and self.profile_import_ai_api_key is not None
        )

    @model_validator(mode="after")
    def require_shared_security_storage_when_deployed(self) -> Self:
        if self.demo_login_enabled and self.environment != "local":
            raise ValueError("Passwordless demo login is only allowed in the local environment")
        if self.environment in {"staging", "production"} and not self.database_url.startswith(
            ("postgresql://", "postgresql+asyncpg://")
        ):
            raise ValueError(
                "Staging and production require PostgreSQL for shared login rate limiting"
            )
        if self.profile_import_ai_model is not None:
            stripped_model = self.profile_import_ai_model.strip()
            if not stripped_model:
                raise ValueError("Profile import AI model must not be blank")
            self.profile_import_ai_model = stripped_model
        if (
            self.profile_import_ai_api_key is not None
            and not self.profile_import_ai_api_key.get_secret_value().strip()
        ):
            raise ValueError("Profile import AI API key must not be blank")
        ai_values = (
            self.profile_import_ai_endpoint,
            self.profile_import_ai_model,
            self.profile_import_ai_api_key,
        )
        if any(value is not None for value in ai_values) and not all(
            value is not None for value in ai_values
        ):
            raise ValueError(
                "Profile import AI endpoint, model, and API key must be configured together"
            )
        if (
            self.environment in {"staging", "production"}
            and self.profile_import_ai_endpoint is not None
            and self.profile_import_ai_endpoint.scheme != "https"
        ):
            raise ValueError("Staging and production AI endpoints require HTTPS")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
