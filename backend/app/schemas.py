from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class PredictRequest(BaseModel):
    tx: Coordinate
    rx: Coordinate
    frequencies_mhz: list[float] = Field(min_length=1)
    band: str | None = None
    utc_time: datetime
    power_w: float | None = Field(default=None, gt=0)
    mode: str | None = None
    antenna: str | None = None
    compare_voacap: bool = False


class GeometryResponse(BaseModel):
    distance_km: float
    initial_bearing_deg: float
    final_bearing_deg: float
    midpoint: Coordinate
    subsolar_relevant: bool


class PredictResponse(BaseModel):
    status: Literal["live", "available", "degraded", "engine_unavailable"]
    engine: str
    simulated: bool
    cache_hit: bool
    cache_stale: bool
    data_source: dict
    geometry: GeometryResponse
    values: dict
    message: str | None = None
    comparison: dict | None = None
