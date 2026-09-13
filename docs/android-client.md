# Android Client Contract

The Compose client is structured around a route editor (TX/RX coordinates or Maidenhead locators, UTC date/time, band/arbitrary frequencies, power, mode, and antenna), an OSM-based map, and a prediction result surface. The stable Retrofit contract is `POST /api/predict`, `GET /api/geometry/path`, `GET /api/noise`, and `GET /api/health`.

Room entities reserve local storage for favorite routes and serialized forecasts. WorkManager is the periodic update boundary; notifications must only announce windows backed by fresh, non-simulated responses. Offline mode reads previously cached Room forecasts and labels them stale. VOACAP comparison is a backend capability with explicit `engine_unavailable` status, never a client-generated estimate.

The Gradle module includes MapLibre as the preferred map SDK for richer vector layers and direction/path rendering without a Google Maps API key. The initial fallback surface also includes osmdroid because its OSM tile path is keyless and can keep the scaffold usable while MapLibre style/tile hosting is selected.
