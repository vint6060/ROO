from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .cache import ForecastCache
from .config import get_settings
from .engines.itu import IturEngine
from .engines.mock import MockEngine
from .engines.voacap import VoacapEngine
from .geometry import Point, calculate_path
from .schemas import Coordinate, GeometryResponse, PredictRequest, PredictResponse
from .solar import SolarData

settings = get_settings()
engine = MockEngine() if settings.prop_engine.lower() == "mock" else IturEngine(settings.p533_dll_path, settings.p372_dll_path)
cache = ForecastCache(settings.forecast_cache_path, settings.forecast_cache_ttl_seconds, settings.forecast_cache_bucket_seconds)
solar = SolarData(settings.solar_data_url, settings.solar_cache_path)
voacap = VoacapEngine(settings.voacap_path)
app = FastAPI(title="ROO HF Link Monitor", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origin_list, allow_methods=["*"], allow_headers=["*"], allow_credentials=False)


def geometry(tx: Coordinate, rx: Coordinate):
    return calculate_path(Point(tx.lat, tx.lon), Point(rx.lat, rx.lon))


@app.get("/api/health")
def health():
    return {"status": "ok", "engine": engine.health(), "data_source": solar.read()}


@app.get("/api/geometry/path", response_model=GeometryResponse)
def path_geometry(tx_lat: float = Query(..., ge=-90, le=90), tx_lon: float = Query(..., ge=-180, le=180), rx_lat: float = Query(..., ge=-90, le=90), rx_lon: float = Query(..., ge=-180, le=180)):
    result = calculate_path(Point(tx_lat, tx_lon), Point(rx_lat, rx_lon)).as_dict()
    return result


@app.get("/api/noise")
def noise(frequency_mhz: float = Query(..., gt=0)):
    if isinstance(engine, MockEngine):
        return {"status": "degraded", "engine": engine.name, "simulated": True, "frequency_mhz": frequency_mhz, "noise_db": round(-105 + frequency_mhz, 2), "message": "Simulated P372-style output; not an engineering estimate."}
    return {"status": "engine_unavailable", "engine": "itu-p372", "frequency_mhz": frequency_mhz, "noise_db": None, "message": "P372.dll is unavailable; no noise estimate was generated."}


@app.post("/api/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    path = geometry(request.tx, request.rx)
    inputs = request.model_dump(mode="json")
    key = cache.key(inputs, engine.name, request.utc_time.isoformat())
    cached, stale = cache.get(key)
    if cached:
        cached["cache_hit"], cached["cache_stale"] = True, stale
        return cached
    activity = solar.read()
    result = engine.predict(request.frequencies_mhz, request.utc_time.isoformat(), path.distance_km, activity)
    comparison = voacap.compare(request=request.model_dump(mode="json"), geometry=path.as_dict()) if request.compare_voacap else None
    payload = PredictResponse(status=result.status, engine=result.engine, simulated=result.simulated, cache_hit=False, cache_stale=False, data_source=activity, geometry=GeometryResponse(**path.as_dict()), values=result.values, message=result.message, comparison=comparison).model_dump()
    cache.put(key, payload)
    return payload
