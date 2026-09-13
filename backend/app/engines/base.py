from dataclasses import dataclass


@dataclass(frozen=True)
class EngineResult:
    status: str
    engine: str
    simulated: bool
    values: dict
    message: str | None = None


class PropagationEngine:
    name = "base"

    def predict(self, frequencies_mhz: list[float], timestamp: str, distance_km: float, activity: dict) -> EngineResult:
        raise NotImplementedError

    def health(self) -> dict:
        raise NotImplementedError
