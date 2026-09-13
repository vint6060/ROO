import time

from backend.app.cache import ForecastCache


def test_cache_ttl_and_eviction(tmp_path):
    cache = ForecastCache(tmp_path / "cache.sqlite3", ttl_seconds=1, bucket_seconds=900)
    key = cache.key({"x": 1}, "mock", "2026-01-01T00:00:00Z")
    cache.put(key, {"value": 2})
    assert cache.get(key)[0] == {"value": 2}
    time.sleep(1.1)
    assert cache.get(key) == (None, False)
