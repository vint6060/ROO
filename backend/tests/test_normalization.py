from backend.app.schemas import Coordinate


def test_coordinate_normalization_rejects_invalid_latitude():
    try:
        Coordinate(lat=91, lon=0)
    except ValueError:
        return
    raise AssertionError("invalid latitude accepted")
