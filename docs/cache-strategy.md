# Cache Strategy

Forecasts are stored in SQLite. The key hashes canonical request inputs, engine name, UTC timestamp, and a configurable timestamp bucket. Entries older than the TTL are evicted on read. Responses identify cache hits and stale-within-TTL entries so clients can communicate freshness. Solar data has an independent JSON cache and is labelled `fresh`, `stale`, or `unknown`.
