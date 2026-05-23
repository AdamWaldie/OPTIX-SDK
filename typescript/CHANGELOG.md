# @optix/sdk changelog

## 0.1.0 — Unreleased

- Initial release. Typed `OptixClient` with bearer + `?api_key=` auth,
  retry/backoff, paginator, and typed error classes
  (`OptixApiError`, `OptixAuthError`, `OptixValidationError`,
  `OptixRateLimitError`, `OptixNetworkError`).
- Operation map generated from `/api/v1/docs` (OpenAPI 3.0) covering
  every category surfaced by `getApiDocumentation()`.
- ESM + CJS dual build via `tsup`; vitest test suite.
- Convenience namespaces (`buildResources(client)`) for the top
  resource categories (stats, sources, documents, entities, search,
  IOC export, reports, API keys, TAXII, audit log, organizations).
