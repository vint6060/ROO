from dataclasses import asdict, dataclass
from math import asin, atan2, cos, degrees, radians, sin, sqrt


@dataclass(frozen=True)
class Point:
    lat: float
    lon: float


@dataclass(frozen=True)
class PathGeometry:
    distance_km: float
    initial_bearing_deg: float
    final_bearing_deg: float
    midpoint: Point
    subsolar_relevant: bool

    def as_dict(self) -> dict:
        result = asdict(self)
        result["midpoint"] = asdict(self.midpoint)
        return result


def _bearing(start: Point, end: Point) -> float:
    lat1, lat2 = radians(start.lat), radians(end.lat)
    delta_lon = radians(end.lon - start.lon)
    return (degrees(atan2(sin(delta_lon) * cos(lat2), cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(delta_lon))) + 360) % 360


def calculate_path(start: Point, end: Point) -> PathGeometry:
    lat1, lat2 = radians(start.lat), radians(end.lat)
    delta_lat = lat2 - lat1
    delta_lon = radians(end.lon - start.lon)
    haversine = sin(delta_lat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta_lon / 2) ** 2
    angular = 2 * asin(sqrt(haversine))
    distance = 6371.0088 * angular
    initial = _bearing(start, end)
    final = (_bearing(end, start) + 180) % 360
    bx = cos(lat2) * cos(delta_lon)
    by = cos(lat2) * sin(delta_lon)
    mid_lat = atan2(sin(lat1) + sin(lat2), sqrt((cos(lat1) + bx) ** 2 + by**2))
    mid_lon = radians(start.lon) + atan2(by, cos(lat1) + bx)
    midpoint = Point(degrees(mid_lat), (degrees(mid_lon) + 540) % 360 - 180)
    return PathGeometry(distance, initial, final, midpoint, abs(midpoint.lat) < 66.5)
