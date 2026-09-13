# ROO HF Link Monitor

ROO monitors a single HF transmitter/receiver circuit. The Android app selects two coordinates and sends requests to a FastAPI service, which combines path geometry, ITU-R propagation/noise engines, a forecast cache, and configurable solar/ionospheric activity data.

```text
Android app
   │ HTTPS/JSON
   ▼
FastAPI backend
   ├── ITURHFProp / P533  (HF propagation)
   ├── P372               (radio noise model)
   ├── forecast cache
   ├── path geometry
   └── solar & ionospheric activity data
```

## Backend

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn backend.app.main:app --reload
pytest -q
```

The API provides `GET /api/health`, `POST /api/predict`, `GET /api/geometry/path`, and `GET /api/noise`. Prediction requests accept UTC ISO-8601 time, band/frequencies, power, mode, antenna, and `compare_voacap`; VOACAP comparison is explicitly unavailable unless a verified executable is configured. CORS origins and all paths are environment-configurable.

## Official ITU-R engines

P533.dll and P372.dll are official ITU-R Windows native libraries. Obtain them from the applicable official ITU-R distribution/licensing channel, place them outside this repository, and set `P533_DLL_PATH` and `P372_DLL_PATH` in `.env`. DLL binaries are ignored by Git. Linux CI does not load them. The backend returns `engine_unavailable` with empty prediction values when they are absent; it never substitutes invented propagation numbers. See the step-by-step [Windows integration guide](docs/engine-integration-windows.md).

For a Windows host, `ITUR_WRAPPER_URL` selects an HTTP/JSON adapter whose `/health` must report `live` before the Linux backend accepts prediction values. This keeps official DLL loading, vendor data files, and platform-specific Python out of the Linux service.

For UI/test development only, explicitly set `PROP_ENGINE=mock`. Mock responses are marked `degraded` and `simulated` and must not be used for operational or engineering decisions.

## Solar data

Set `SOLAR_DATA_URL` to a permitted JSON source for SSN, F10.7, Kp, and/or Ap. No API keys are embedded. Successful responses are cached locally. Network failure falls back to `stale`; if no cache exists the status is `unknown`.

## Android

Open `android/` as the Gradle project or run `./gradlew :app:assembleDebug` where an Android SDK is installed. The app uses Jetpack Compose, Retrofit/Moshi, Room, WorkManager, and an OSM-based osmdroid map without a map API key. MapLibre is the preferred future provider for richer vector layers and keyless OSM tiles. The scaffold includes UTC time, locator/coordinates, band/frequency, power/mode/antenna, local favorite-route/forecast entities, and a periodic worker hook. Production UI should render hourly predictions, SNR/MUF/BCR charts, great-circle paths, favorites, notifications, and explicit VOACAP comparison status from the stable JSON contract. Configure the backend URL in the app UI; no production URL is hardcoded. Network errors and live/stale/error/demo freshness remain visible.

## Limitations / honest status

- Official P533/P372 DLLs are Windows-only and are not committed.
- The Linux sandbox has no live solar-data guarantee, so health can be `unknown` or `stale`.
- The native wrapper detects and loads DLLs but does not claim production ABI compatibility until tested against the exact official distribution; it returns unavailable rather than fabricating values.
- The mock engine is deterministic simulated output only.
- An Android APK build may be unavailable in environments without an Android SDK/Gradle distribution.
- The Android module is a committed scaffold; runtime MapLibre styling, full chart rendering, and production WorkManager scheduling require an Android build/device pass.
