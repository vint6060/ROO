import hashlib
import json
import sqlite3
import time
from pathlib import Path


class ForecastCache:
    def __init__(self, path: Path, ttl_seconds: int, bucket_seconds: int):
        self.path = path
        self.ttl_seconds = ttl_seconds
        self.bucket_seconds = bucket_seconds
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path) as db:
            db.execute("CREATE TABLE IF NOT EXISTS forecasts (key TEXT PRIMARY KEY, created REAL NOT NULL, payload TEXT NOT NULL)")

    def key(self, inputs: dict, engine: str, timestamp: str) -> str:
        bucket = int(time.time() // self.bucket_seconds)
        canonical = json.dumps({"inputs": inputs, "engine": engine, "timestamp": timestamp, "bucket": bucket}, sort_keys=True)
        return hashlib.sha256(canonical.encode()).hexdigest()

    def get(self, key: str) -> tuple[dict | None, bool]:
        with sqlite3.connect(self.path) as db:
            row = db.execute("SELECT created, payload FROM forecasts WHERE key = ?", (key,)).fetchone()
        if not row:
            return None, False
        age = time.time() - row[0]
        if age > self.ttl_seconds:
            with sqlite3.connect(self.path) as db:
                db.execute("DELETE FROM forecasts WHERE key = ?", (key,))
            return None, False
        return json.loads(row[1]), age > self.ttl_seconds / 2

    def put(self, key: str, payload: dict) -> None:
        with sqlite3.connect(self.path) as db:
            db.execute("INSERT OR REPLACE INTO forecasts(key, created, payload) VALUES (?, ?, ?)", (key, time.time(), json.dumps(payload)))
