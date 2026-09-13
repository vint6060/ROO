from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    prop_engine: str = "itu"
    p533_dll_path: str | None = None
    p372_dll_path: str | None = None
    voacap_path: str | None = None
    solar_data_url: str | None = None
    solar_cache_path: Path = Path("backend/.cache/solar.json")
    forecast_cache_path: Path = Path("backend/.cache/forecast.sqlite3")
    forecast_cache_ttl_seconds: int = 900
    forecast_cache_bucket_seconds: int = 900
    cors_origins: str = "http://localhost:8080"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
