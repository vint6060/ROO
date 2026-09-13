import json
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx


class SolarData:
    def __init__(self, url: str | None, cache_path: Path):
        self.url, self.cache_path = url, cache_path

    def read(self) -> dict:
        if self.url:
            try:
                response = httpx.get(self.url, timeout=5.0)
                response.raise_for_status()
                payload = response.json()
                self.cache_path.parent.mkdir(parents=True, exist_ok=True)
                self.cache_path.write_text(json.dumps({"fetched_at": datetime.now(timezone.utc).isoformat(), "data": payload}))
                return {"status": "fresh", "data": payload, "fetched_at": datetime.now(timezone.utc).isoformat()}
            except (httpx.HTTPError, ValueError, OSError):
                pass
        if self.cache_path.is_file():
            try:
                cached = json.loads(self.cache_path.read_text())
                return {"status": "stale", "data": cached.get("data"), "fetched_at": cached.get("fetched_at")}
            except (ValueError, OSError):
                pass
        return {"status": "unknown", "data": None, "fetched_at": None, "message": "No configured or cached solar/ionospheric data source."}
