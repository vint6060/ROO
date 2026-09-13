# ITU-R P533/P372 on Windows

This guide connects official ITU-R SG3 distributions to ROO without putting vendor binaries or data files in Git.

## 1. Prerequisites

- An official ITU-R SG3 distribution containing ITURHFProp/P533 and P372. Follow the distribution's license and redistribution terms.
- A Windows host for the native libraries.
- Every auxiliary data file supplied by the distribution. Keep those files beside the corresponding DLLs, or in the exact layout required by the official package. Do not rename or relocate them casually: native code may resolve them relative to its DLL or process working directory.
- A Python installation with the same architecture as the DLLs. P533 distributions are historically 32-bit, so use 32-bit Python when the inspected DLL is 32-bit.

## 2. Inspect DLL architecture

From a Visual Studio Developer Command Prompt:

```powershell
dumpbin /headers P533.dll | Select-String machine
dumpbin /exports P533.dll
```

With MinGW/binutils or Wine tooling:

```bash
objdump -p P533.dll | grep -i 'file format\|architecture'
winedump spec P533.dll
```

Repeat for `P372.dll`. Match Python architecture to both DLLs. A 32-bit DLL cannot be loaded by 64-bit Python and vice versa.

## 3. Direct ctypes loading

Keep the files outside the repository and configure absolute Windows paths through environment variables:

```powershell
$env:PROP_ENGINE = "itu"
$env:P533_DLL_PATH = "C:\ITU\P533\P533.dll"
$env:P372_DLL_PATH = "C:\ITU\P372\P372.dll"
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

ROO uses `ctypes.WinDLL` and never hardcodes these paths. The loader first checks that each file exists. It reports `engine_unavailable` when a file is missing, the process is not Windows, the architecture is incompatible, or loading raises an OS error. Loading alone is not proof that function signatures are correct; verify the exact official ABI before enabling production calculations.

## 4. Variant A: Windows wrapper service (recommended)

Run a small Windows-only service beside the official DLLs. It should:

1. Load both DLLs at process startup using `ctypes.WinDLL`.
2. Resolve and validate the exact exported functions and official data-file layout.
3. Expose `GET /health`, `POST /predict`, and `GET /noise` over authenticated HTTPS/JSON on a private network.
4. Return `{"status":"live"}` from `/health` only after both DLLs and required data files are usable.
5. Return `status: live` plus vendor-calculated `values` for valid requests; never return mock values under a live status.

Point the Linux FastAPI service at it:

```dotenv
PROP_ENGINE=itu
ITUR_WRAPPER_URL=https://itu-windows-host.example/internal
```

When `ITUR_WRAPPER_URL` is set, ROO uses the HTTP adapter. It accepts numbers only when wrapper health is `live` and the prediction response is also `live`; network failure, malformed JSON, or any other status becomes `engine_unavailable`.

The wrapper contract is intentionally small:

```json
{"frequencies_mhz":[7.1],"utc_time":"2026-09-13T12:00:00Z","distance_km":1200,"activity":{}}
```

The response must contain `status: live` and a `values` object. The exact P533/P372 ABI mapping belongs in the Windows service and must be tested against the official release.

## 5. Variant B: Wine + Windows Python

Wine can run a matching Windows Python and the wrapper service on Linux. This is a compatibility option, not the default: DLL search paths, auxiliary data files, calling conventions, GUI/runtime dependencies, timing, and licensing behavior can differ under Wine. Keep the same health gate and require a real end-to-end validation against known ITU test cases before using `live` results.

## 6. Variant C: ported open implementation

An independently maintained open implementation of P.533/P.372 can be used as another engine adapter if its model scope, licensing, inputs, and validation are acceptable. It must have its own engine name and health status, and must not be presented as the official ITU DLL result. If unavailable or not validated, return `engine_unavailable` rather than substituting mock values.

## 7. Environment configuration

```dotenv
P533_DLL_PATH=C:\ITU\P533\P533.dll
P372_DLL_PATH=C:\ITU\P372\P372.dll
ITUR_WRAPPER_URL=https://itu-windows-host.example/internal
PROP_ENGINE=itu
```

Use either direct DLL loading on Windows or the wrapper URL. Do not commit `.env`, DLLs, auxiliary data files, license keys, or absolute machine-specific paths.

## 8. Verify the connection

Check the backend health endpoint:

```powershell
Invoke-RestMethod http://localhost:8000/api/health | ConvertTo-Json -Depth 6
```

For a working integration, the engine section reports `status: live`, and the Windows wrapper health also reports `live`. Then call `/api/predict` and verify the response status is `live`, `simulated` is `false`, and values are present. A missing DLL, missing data file, architecture mismatch, wrapper timeout, invalid response, or failed ABI check must instead produce `engine_unavailable` with empty propagation values. The `PROP_ENGINE=mock` path remains explicitly `degraded`/`simulated` and is never evidence of a real connection.

## 9. Distribution and safety warning

Never commit P533.dll, P372.dll, auxiliary data files, installers, or other vendor binaries to this repository. They may be large, license-restricted, or redistribution-prohibited. Obtain them through the official ITU-R channel and store them on the deployment host. Do not replace a failed live calculation with mock data while retaining a `live` label; mock data must remain explicitly labelled simulated.
