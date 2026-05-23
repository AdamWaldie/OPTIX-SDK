# @optix/sdk

Official TypeScript / JavaScript SDK for the OPTIX Threat Intelligence
REST API. Targets Node ≥18 and modern browsers; ships ESM + CJS dual
build with full TypeScript declarations.

## Install

```bash
npm install @optix/sdk
```

## Quick start

```ts
import { OptixClient, buildResources } from "@optix/sdk";

const client = new OptixClient({
  apiKey: process.env.OPTIX_API_KEY!,
  baseUrl: "https://api.optix.example.com/api/v1",
});

const r = buildResources(client);
const stats = await r.stats.get();

for await (const doc of client.paginate("getDocuments", { pageSize: 100, limit: 1_000 })) {
  console.log(doc);
}
```

## Auth

Bearer auth is the default. To send the key as a query parameter (for
environments that strip `Authorization` headers, e.g. some serverless
gateways), pass `authMode: "query"`:

```ts
const client = new OptixClient({ apiKey: "optx_…", authMode: "query" });
```

## Errors

Every non-2xx response surfaces as a typed subclass of `OptixApiError`:

| Class                  | Status   |
|------------------------|----------|
| `OptixAuthError`       | 401, 403 |
| `OptixValidationError` | 400, 422 |
| `OptixRateLimitError`  | 429      |
| `OptixApiError`        | other ≥400 |
| `OptixNetworkError`    | transport / abort |

The classes preserve the parsed body, status, `API-Version` header and
(for rate limits) `Retry-After` / `X-RateLimit-Reset`.

## Retry & backoff

The client retries 429 and 5xx responses up to `maxRetries` (default 3),
honouring `Retry-After` when present and falling back to exponential
backoff with full jitter (cap 10s).

## Pagination

`client.paginate(operation, opts)` returns an async iterator that walks
the `items` / `results` / `data` arrays the v1 endpoints return. Pass
`limit` to cap the total items yielded and `pageSize` to set the
per-request `?limit=` parameter.

## Examples

See [`examples/`](./examples) — runnable with `tsx`:

- [`auth.ts`](./examples/auth.ts)
- [`fetch-entity.ts`](./examples/fetch-entity.ts)
- [`paginate-documents.ts`](./examples/paginate-documents.ts)
- [`ioc-export-to-file.ts`](./examples/ioc-export-to-file.ts)

## Development

```bash
npm install
npm run typecheck
npm test
npm run build      # → dist/
```

The model + operation stubs in `src/generated/` are produced by
`scripts/sdk-codegen.ts` at the repo root. See `sdks/README.md` for
details.
