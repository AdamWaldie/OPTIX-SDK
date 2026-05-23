"""Live-API smoke test for the OPTIX Python SDK.

Exercises three round-trips against the running API to catch contract
drift between ``server/api-docs.ts`` and the published SDK:

  1. Auth check          — ``GET /stats`` with the supplied API key.
  2. Paginated list      — ``client.paginate("getDocuments")`` walks at
                           least one page and respects a small ``limit``.
  3. Error envelope      — a deliberately bad key must surface as a
                           typed ``OptixAuthError`` with the server's
                           ``{"error": ...}`` envelope intact.

Usage::

    OPTIX_API_KEY=optx_... \\
    OPTIX_BASE_URL=http://localhost:5000/api/v1 \\
        python -m examples.smoke

Exits non-zero on any failure so it can be wired into CI.
"""
from __future__ import annotations

import os
import sys

from optix_intel import OptixApiError, OptixAuthError, OptixClient


def main() -> int:
    api_key = os.environ.get("OPTIX_API_KEY")
    base_url = os.environ.get("OPTIX_BASE_URL", "http://localhost:5000/api/v1")
    if not api_key:
        print("OPTIX_API_KEY is not set — skipping live smoke test.", file=sys.stderr)
        return 2

    with OptixClient(api_key, base_url=base_url, max_retries=1) as client:
        # 1) Auth round-trip.
        print(f"[smoke] (1/3) GET {base_url}/stats")
        stats = client.request("getStats")
        if not isinstance(stats, dict):
            raise SystemExit(f"getStats returned non-dict: {stats!r}")
        print(f"[smoke]   ok stats keys: {', '.join(stats.keys())}")

        # 2) Paginated list — small page so we don't hammer the API.
        print("[smoke] (2/3) paginate getDocuments (enriched feed, limit=3)")
        count = 0
        for _doc in client.paginate(
            "getDocuments",
            query={"enriched": "true"},
            page_size=3,
            limit=3,
        ):
            count += 1
        print(f"[smoke]   ok streamed {count} document(s)")

    # 3) Error envelope — bogus key must round-trip as OptixAuthError.
    print("[smoke] (3/3) error envelope (expect 401 -> OptixAuthError)")
    with OptixClient("optx_definitely_invalid", base_url=base_url, max_retries=0) as bad:
        try:
            bad.request("getStats")
        except OptixAuthError as exc:
            if exc.status not in (401, 403):
                raise SystemExit(f"Expected 401/403 status, got {exc.status}") from None
            print(
                f"[smoke]   ok {type(exc).__name__} status={exc.status} message={str(exc)!r}"
            )
        except OptixApiError as exc:
            raise SystemExit(
                f"Expected OptixAuthError, got {type(exc).__name__}({exc.status})"
            ) from None
        else:
            raise SystemExit("Expected OptixAuthError, got 2xx response")

    print("[smoke] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
