from .base import EngineResult, PropagationEngine


class MockEngine(PropagationEngine):
    name = "mock-simulated"

    def health(self) -> dict:
        return {"status": "degraded", "simulated": True, "message": "Explicit mock engine; values are simulated and not engineering predictions."}

    def predict(self, frequencies_mhz: list[float], timestamp: str, distance_km: float, activity: dict) -> EngineResult:
        muf = max(3.0, 28.0 - distance_km / 900.0)
        snr = round(25 - distance_km / 1000, 2)
        values = {"frequencies_mhz": frequencies_mhz, "muf_mhz": round(muf, 2), "luf_mhz": round(max(1.5, muf * 0.18), 2), "snr_db": snr, "bcr_percent": 58.0, "reliability_percent": 62.0, "availability_percent": 58.0, "required_power_w": 100.0, "hourly": [{"utc_hour": hour, "frequency_mhz": frequency, "snr_db": snr, "muf_mhz": round(muf, 2), "bcr_percent": 58.0} for hour in range(24) for frequency in frequencies_mhz]}
        return EngineResult("degraded", self.name, True, values, "Simulated output: do not use for operational or engineering decisions.")
