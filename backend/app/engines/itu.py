import ctypes
from pathlib import Path

from .base import EngineResult, PropagationEngine


class IturEngine(PropagationEngine):
    name = "itu-p533-p372"

    def __init__(self, p533_path: str | None, p372_path: str | None):
        self.p533_path = Path(p533_path) if p533_path else None
        self.p372_path = Path(p372_path) if p372_path else None
        self.p533 = self._load(self.p533_path)
        self.p372 = self._load(self.p372_path)

    @staticmethod
    def _load(path: Path | None):
        if not path or not path.is_file():
            return None
        try:
            return ctypes.WinDLL(str(path))
        except (OSError, AttributeError):
            return None

    def health(self) -> dict:
        available = self.p533 is not None and self.p372 is not None
        return {"status": "live" if available else "engine_unavailable", "p533_loaded": self.p533 is not None, "p372_loaded": self.p372 is not None, "platform": "Windows native DLLs required"}

    def predict(self, frequencies_mhz: list[float], timestamp: str, distance_km: float, activity: dict) -> EngineResult:
        health = self.health()
        if health["status"] != "available":
            return EngineResult("engine_unavailable", self.name, False, {}, "Official P533.dll and P372.dll are not both loaded; no propagation numbers were generated.")
        return EngineResult("engine_unavailable", self.name, False, {}, "Native ABI mapping must be verified against the installed official ITU-R distribution before production use.")
