from datetime import datetime, timezone

from fastapi.testclient import TestClient

from backend.app.main import app


def test_geometry_endpoint():
    response = TestClient(app).get("/api/geometry/path?tx_lat=0&tx_lon=0&rx_lat=0&rx_lon=90")
    assert response.status_code == 200
    assert response.json()["distance_km"] > 10000


def test_unavailable_or_mock_prediction_is_explicit():
    response = TestClient(app).post("/api/predict", json={"tx": {"lat": 0, "lon": 0}, "rx": {"lat": 10, "lon": 20}, "frequencies_mhz": [7.1], "utc_time": datetime.now(timezone.utc).isoformat()})
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"engine_unavailable", "degraded"}
    if body["status"] == "degraded":
        assert body["simulated"] is True
    else:
        assert body["values"] == {}


def test_voacap_comparison_is_explicitly_unavailable_without_executable():
    response = TestClient(app).post("/api/predict", json={"tx": {"lat": 0, "lon": 0}, "rx": {"lat": 10, "lon": 20}, "frequencies_mhz": [7.1], "utc_time": datetime.now(timezone.utc).isoformat(), "compare_voacap": True})
    assert response.status_code == 200
    assert response.json()["comparison"]["status"] == "engine_unavailable"
