# ROO: remaining implementation roadmap

This roadmap reflects commit `0af454a`. It is for a developer downloading the
repository and finishing the Android application on Windows. It describes work
remaining; it does not claim that mock output is a real ITU-R calculation.

## Current state

- The FastAPI backend in `backend/app/` is present and tested. It exposes
  `/api/health`, `/api/predict`, `/api/geometry/path`, and `/api/noise`.
- `MainActivity.kt` is a Compose scaffold with editable coordinates,
  frequencies, UTC time, power/mode/antenna, an osmdroid map with two fixed
  markers, and a Retrofit prediction request.
- `LocalStore.kt` declares Room entities/DAO for favorites and forecast cache,
  but does not wire a database/repository into the UI. `ForecastWorker.kt`
  opens and closes the database and returns success; it does not schedule,
  fetch, cache, or notify.
- MapLibre is only a dependency. The screen uses osmdroid. There is no path
  overlay, tap-to-place flow, favorites UI, SNR/MUF/BCR chart, or notification
  implementation. `res/values` is the only resource directory; launcher icons
  are absent.
- The root has no `gradlew`, `gradlew.bat`, or `gradle/wrapper/`. No Android
  APK has been compiled in the available environment because Android SDK and
  Gradle are unavailable there.
- `P533.dll`/`P372.dll` are Windows-only official ITU-R SG3 libraries. The
  wrapper and native adapters intentionally return `engine_unavailable` until
  the licensed files, data files, architecture, ABI, and known test cases are
  validated. `PROP_ENGINE=mock` is deterministic `degraded`/`simulated` output,
  not a real ITU-R prediction.

## Phase 1: open and build on Windows

1. Install Android Studio, an SDK/build-tools platform for `compileSdk = 35`,
   and its supported JDK. Open the repository root so
   `settings.gradle.kts` can map `:app` to `android/app`.
   **Acceptance:** Android Studio syncs `RooLinkMonitor` with no Gradle errors.

2. Add and commit the Gradle wrapper at the repository root:

   ```powershell
   gradle wrapper --gradle-version 8.9
   .\gradlew.bat --version
   .\gradlew.bat tasks
   ```

   **Acceptance:** `gradlew`, `gradlew.bat`, and `gradle/wrapper/*` exist and
   `:app` tasks are listed.

3. Run the first compile and fix concrete compiler/toolchain errors:

   ```powershell
   .\gradlew.bat :app:assembleDebug --stacktrace
   ```

   Check `MainActivity.kt` in particular: `ComparisonStatus` has properties,
   while the current display uses `comparison?.get("status")`, which should be
   corrected to the typed property access. **Acceptance:**
   `android/app/build/outputs/apk/debug/app-debug.apk` is produced and installs.

4. Confirm the app launches, network permission from
   `android/app/src/main/AndroidManifest.xml` works, and an unreachable or
   malformed backend produces an error state rather than a crash. Add launcher
   icon resources during this pass. **Acceptance:** the debug app launches from
   an emulator/device and the basic form remains usable.

## Phase 2: complete the Android features

1. Choose osmdroid or MapLibre and finish the map in `MainActivity.kt`: map
   lifecycle, tap-to-place TX/RX markers, coordinate synchronization, and a
   great-circle/path overlay from `GET /api/geometry/path`, with attribution and
   tile/style configuration. **Acceptance:** moving either station changes the
   request and the displayed path matches the backend geometry.

2. Wire `LocalStore.kt` through one Room database instance, repository, and
   ViewModel. Persist `FavoriteRoute` and `CachedForecast`, restore them after
   restart, and label cached/stale/unknown responses. **Acceptance:** a saved
   route and a cached response survive force-stop/relaunch and offline data is
   visibly stale, never live.

3. Replace one-shot Retrofit setup with a typed repository for the four backend
   endpoints. Validate coordinates, frequencies, UTC, and the HTTPS base URL;
   preserve `status`, `simulated`, `cache_stale`, `data_source`, `message`, and
   `comparison`. **Acceptance:** invalid input is rejected locally and HTTP or
   JSON failure is recoverable and visible.

4. Render hourly SNR, MUF, and BCR from `values.hourly`, with units, UTC hours,
   empty states, engine state, and freshness. **Acceptance:** fixture data
   renders all three series; `engine_unavailable` and simulated fixtures are
   visibly distinct and never presented as real predictions.

5. Add favorites UI to name, save, list, load, update, and delete routes.
   **Acceptance:** two routes remain independent through save, reload, and load.

6. Implement `ForecastWorker.kt`: read saved routes, call the HTTPS API, save
   successful responses, and schedule a constrained periodic job from an
   explicit app/settings action. Add a notification channel and runtime
   notification permission handling. Notify only for fresh, non-simulated
   responses. **Acceptance:** a worker refresh is cached and notified; stale,
   mock, and `engine_unavailable` results do not trigger a success notification.

## Phase 3: deploy backend and wire the client

1. On a host, install the backend and run its existing tests:

   ```bash
   python -m venv .venv
   pip install -r requirements.txt
   pytest -q
   uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
   ```

   Copy `.env.example` to a host-only `.env`; configure solar data, CORS,
   cache paths, and engine variables there. **Acceptance:** `/api/health` is
   reachable and reports truthful engine/data-source status.

2. Put FastAPI behind HTTPS with a valid certificate and restrict `CORS_ORIGINS`.
   Verify HTTPS JSON responses from `/api/health`, `/api/predict`,
   `/api/geometry/path`, and `/api/noise`. **Acceptance:** production clients
   use HTTPS, not the development HTTP port.

3. Configure the Android base URL through app settings/build configuration,
   using the deployed HTTPS origin with Retrofit's required trailing slash.
   **Acceptance:** a device request reaches the deployment and displays actual
   freshness and engine status. Do not commit secrets or production URLs.

## Phase 4: Windows ITU-R and VOACAP

1. Obtain licensed official ITU-R SG3 P533/P372 binaries and all auxiliary data
   files through the official channel. Keep them outside Git and follow
   `docs/engine-integration-windows.md`.

2. On Windows, inspect both DLL architectures/exports with `dumpbin` or
   `objdump`; match Python architecture to them. Implement the exact vendor ABI
   mapping in the Windows wrapper and test known official cases. DLL load alone
   is not validation. **Acceptance:** known P533/P372 cases match expected
   results and malformed/incomplete inputs are rejected.

3. Expose authenticated HTTPS/JSON `GET /health`, `POST /predict`, and
   `GET /noise` from the Windows wrapper. Configure `ITUR_WRAPPER_URL` and
   `PROP_ENGINE=itu` on the FastAPI host. The adapter must accept numbers only
   when wrapper health and prediction both report `status: live`.
   **Acceptance:** `/api/health` reports a live wrapper and a known case returns
   `status: live`, `simulated: false`, and non-empty vendor-backed values.

4. Configure a permitted VOACAP executable with `VOACAP_PATH` and complete the
   CLI mapping in `backend/app/engines/voacap.py`. Detection alone is not
   enough. **Acceptance:** `compare_voacap` returns validated non-empty values
   for a fixture; missing/failed VOACAP remains `engine_unavailable`.

5. Never describe `PROP_ENGINE=mock` or `engine_unavailable` as ITU-R output.
   Mock is for UI/device development only and must remain visibly simulated.

## Phase 5: end-to-end and device testing

1. Extend `backend/tests/` for live-wrapper success/failure, missing DLLs,
   cache freshness, solar states, VOACAP states, and the exact JSON contract.
   **Acceptance:** `pytest -q` passes and asserts unavailable/simulated results
   cannot be falsely live.

2. Add Android unit/instrumentation tests for parsing, JSON mapping, Room,
   favorites, stale/offline behavior, worker constraints, and notification
   gating, using fake HTTP and fixtures. **Acceptance:** both success and
   unavailable backend states run on an emulator/device without licensed DLLs.

3. Manually test emulator and physical device cases: live, mock, unavailable,
   stale cache, restart, rotation/backgrounding, denied notification permission,
   and slow network. **Acceptance:** no release-blocking crash occurs and every
   state remains truthfully labeled.

## Phase 6: CI

1. Add `.github/workflows/` CI for Python tests/static checks and the pinned
   Android SDK/toolchain. Run:

   ```bash
   ./gradlew :app:testDebugUnitTest :app:assembleDebug
   ```

   **Acceptance:** a clean checkout builds without local Android Studio/Gradle,
   and failed logs/APKs are retained as appropriate.

2. Keep CI free of DLLs, auxiliary vendor data, credentials, and production
   URLs. A mock-only contract job is acceptable only with explicit simulated
   labels. **Acceptance:** CI proves build/contract integrity without claiming
   native ITU coverage.

## MVP definition of done

- A clean Windows checkout opens and builds with the committed wrapper.
- Android edits two stations, shows map/path, calls the deployed HTTPS API,
  renders SNR/MUF/BCR, and distinguishes live, stale, unavailable, and
  simulated states.
- Room favorites/cache survive restart; WorkManager refreshes and notification
  gating are tested.
- Backend HTTPS/JSON deployment and environment configuration are documented.
- A licensed, ABI-validated Windows P533/P372 integration produces known live
  results, or the release explicitly remains limited to unavailable/development
  mock mode. VOACAP is equally truthful.
- Backend, Android, device, and clean-checkout CI checks pass.

## Explicit non-goals

- Committing DLLs, VOACAP binaries, auxiliary data, license keys, secrets, or
  machine-specific `.env` files.
- Treating mock output, DLL load success without ABI validation, or unavailable
  output as real ITU-R predictions.
- Calling an unvalidated port or Wine setup production-equivalent.
- Adding a Google Maps API-key dependency, accounts/cloud sync, or an unrelated
  web UI to the Android MVP.

## Existing references

- [Android client contract](android-client.md)
- [Data flow](data-flow.md)
- [Cache strategy](cache-strategy.md)
- [Engine abstraction](engine-abstraction.md)
- [Windows ITU-R integration](engine-integration-windows.md)
