# Engine Abstraction

`PropagationEngine` exposes `health()` and `predict()`. `IturEngine` attempts to load `P533.dll` and `P372.dll` with `ctypes.WinDLL` from configured paths. It never emits values when the libraries are missing, and the current wrapper intentionally remains unavailable until the exact official ABI signatures are verified against the installed distribution. `MockEngine` is only selected by `PROP_ENGINE=mock`, and every response is marked simulated/degraded.
