from backend.app.geometry import Point, calculate_path


def test_equator_quarter_world_distance_and_bearings():
    result = calculate_path(Point(0, 0), Point(0, 90))
    assert 10000 < result.distance_km < 10020
    assert result.initial_bearing_deg == 90
    assert result.final_bearing_deg == 90
    assert result.midpoint.lat == 0
    assert result.midpoint.lon == 45
