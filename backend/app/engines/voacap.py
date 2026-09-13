from pathlib import Path


class VoacapEngine:
    name = "voacap"

    def __init__(self, executable: str | None):
        self.executable = Path(executable) if executable else None

    def health(self) -> dict:
        available = self.executable is not None and self.executable.is_file()
        return {"status": "available" if available else "engine_unavailable", "executable_configured": self.executable is not None, "message": "VOACAP comparison is unavailable; no comparison values were generated." if not available else "VOACAP executable detected; CLI mapping requires deployment verification."}

    def compare(self, **_: object) -> dict:
        health = self.health()
        return {"status": health["status"], "engine": self.name, "simulated": False, "values": {}, "message": health["message"]}
