from datetime import datetime

import httpx

from .base import EngineResult, PropagationEngine


class IturWrapperEngine(PropagationEngine):
    """HTTP adapter for a Windows service that owns the official ITU DLLs."""

    name = "itur-windows-wrapper"

    def __init__(self, base_url: str, timeout_seconds: float = 5.0):
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def health(self) -> dict:
        try:
            response = httpx.get(f"{self.base_url}/health", timeout=self.timeout_seconds)
            response.raise_for_status()
            payload = response.json()
            if payload.get("status") != "live":
                return {"status": "engine_unavailable", "wrapper_status": payload.get("status", "unknown"), "message": "ITU wrapper is reachable but did not report live DLL-backed status."}
            return {"status": "live", "wrapper_status": "live", "message": "Windows ITU wrapper reports live DLL-backed status."}
        except (httpx.HTTPError, ValueError):
            return {"status": "engine_unavailable", "message": "Configured ITU wrapper could not be reached or returned invalid health JSON."}

    def predict(self, frequencies_mhz: list[float], timestamp: str, distance_km: float, activity: dict) -> EngineResult:
        health = self.health()
        if health["status"] != "live":
            return EngineResult("engine_unavailable", self.name, False, {}, health["message"])
        try:
            response = httpx.post(f"{self.base_url}/predict", json={"frequencies_mhz": frequencies_mhz, "utc_time": timestamp, "distance_km": distance_km, "activity": activity}, timeout=self.timeout_seconds)
            response.raise_for_status()
            payload = response.json()
            if payload.get("status") != "live" or not isinstance(payload.get("values"), dict):
                return EngineResult("engine_unavailable", self.name, False, {}, "ITU wrapper did not return a live status with values.")
            return EngineResult("live", self.name, False, payload["values"], payload.get("message"))
        except (httpx.HTTPError, ValueError):
            return EngineResult("engine_unavailable", self.name, False, {}, "ITU wrapper prediction request failed; no propagation numbers were accepted.")
