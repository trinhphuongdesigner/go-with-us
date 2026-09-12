from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class PeopleSearchSettings(BaseSettings):
    madison_api_key: SecretStr | None = None
    madison_base_url: str = "https://ai-center.madlab.tech"
    madison_model: str = "madison-ai-center"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="CAREERMATE_",
        extra="ignore",
    )


@lru_cache
def get_people_search_settings() -> PeopleSearchSettings:
    return PeopleSearchSettings()
