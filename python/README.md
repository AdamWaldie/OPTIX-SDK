# optix-intel — Python SDK for OPTIX

Official Python client for the OPTIX Threat Intelligence REST API
(`/api/v1/*`). Provides both blocking (`OptixClient`) and asyncio
(`AsyncOptixClient`) implementations on top of `httpx`, with retry,
typed errors and pagination.

## Install

```bash
pip install optix-intel
```

## Quick start

```python
from optix_intel import OptixClient

with OptixClient(api_key="optx_...") as client:
    stats = client.request("getStats")
    for doc in client.paginate("getDocuments", page_size=100, limit=1_000):
        print(doc["id"], doc.get("title"))
```

Async equivalent:

```python
import asyncio
from optix_intel import AsyncOptixClient

async def main() -> None:
    async with AsyncOptixClient(api_key="optx_...") as client:
        stats = await client.request("getStats")
        async for doc in client.paginate("getDocuments", page_size=100):
            print(doc["id"])

asyncio.run(main())
```

## Auth

```python
OptixClient("optx_...", auth_mode="header")  # default — Authorization: Bearer …
OptixClient("optx_...", auth_mode="query")   # ?api_key=…
```

## Errors

| Class                  | HTTP status |
|------------------------|-------------|
| `OptixAuthError`       | 401, 403    |
| `OptixValidationError` | 400, 422    |
| `OptixRateLimitError`  | 429         |
| `OptixApiError`        | other ≥ 400 |
| `OptixNetworkError`    | transport / timeout |

All errors carry `.status`, `.body`, `.api_version`,
`.retry_after_seconds`, and `.rate_limit_reset` where applicable.

## Retry & backoff

429 and 5xx responses are retried up to `max_retries` (default 3).
`Retry-After` is honoured exactly when present; otherwise the SDK
applies exponential backoff with full jitter (cap 10 s).

## Pagination

`client.paginate(operation, page_size=100, limit=None)` yields items
from the first list-shaped key it finds in the response (`items`,
`results`, `data`, …). Pass `limit` to cap total items.

## Examples

See [`examples/`](./examples) for runnable scripts:

- `auth.py` — basic stats fetch
- `list_documents.py` — list recent documents
- `stream_ioc_export.py` — pipe the blocklist export to stdout
- `watchlist_alert_poller.py` — async polling loop emitting alerts

## Development

```bash
cd sdks/python
pip install -e ".[dev]"
pytest
mypy optix_intel
```

The `_generated/` package is produced by `scripts/sdk-codegen.ts` at
the repo root. See `sdks/README.md`.
