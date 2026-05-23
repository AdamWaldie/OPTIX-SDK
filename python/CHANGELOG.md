# optix-intel changelog

## 0.1.0 — Unreleased

- Initial release. Sync `OptixClient` and async `AsyncOptixClient` on
  top of `httpx` with bearer + `?api_key=` auth, exponential-backoff
  retry honouring `Retry-After` / `X-RateLimit-Reset`, and a paginator.
- Typed exception hierarchy (`OptixApiError`, `OptixAuthError`,
  `OptixValidationError`, `OptixRateLimitError`, `OptixNetworkError`).
- Operation map covers every documented `/api/v1/*` endpoint, generated
  from the OpenAPI 3.0 spec at `/api/v1/docs`.
- pytest suite (sync + async) using `httpx.MockTransport`; `py.typed`
  marker so consumers get full type-hinting via mypy.
