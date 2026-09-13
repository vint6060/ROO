# Data Flow

The Android client sends a JSON request containing TX/RX coordinates, frequencies, and UTC time to `POST /api/predict`. FastAPI validates the request, computes path geometry, reads the configured solar/ionospheric source, and asks the selected propagation engine for values. The response carries engine status, simulated/degraded flags, source freshness, geometry, and cache metadata.

The geometry endpoint is independent of native libraries, so it remains useful when the official Windows engines are absent. The Android client must display `engine_unavailable`, `degraded`, and stale/unknown data-source states rather than presenting them as live predictions.
