"""Runtime configuration loaded from environment / .env."""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()  # loads .env from CWD if present


@dataclass(frozen=True)
class Settings:
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment: str
    azure_openai_api_version: str
    azure_speech_key: str
    azure_speech_region: str
    allowed_origin: str

    @property
    def is_openai_configured(self) -> bool:
        return bool(self.azure_openai_endpoint and self.azure_openai_api_key)

    @property
    def is_speech_configured(self) -> bool:
        return bool(self.azure_speech_key and self.azure_speech_region)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        azure_openai_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/"),
        azure_openai_api_key=os.getenv("AZURE_OPENAI_API_KEY", ""),
        azure_openai_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o-mini"),
        azure_openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-10-21"),
        azure_speech_key=os.getenv("AZURE_SPEECH_KEY", ""),
        azure_speech_region=os.getenv("AZURE_SPEECH_REGION", ""),
        allowed_origin=os.getenv("ALLOWED_ORIGIN", "http://localhost:3000"),
    )
