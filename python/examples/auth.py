"""Authenticate and fetch platform stats.

Usage:
    OPTIX_API_KEY=optx_... python -m examples.auth
"""
from __future__ import annotations

import os
import sys

from optix_intel import OptixClient


def main() -> int:
    api_key = os.environ.get("OPTIX_API_KEY")
    if not api_key:
        print("Set OPTIX_API_KEY before running this example.", file=sys.stderr)
        return 1
    base_url = os.environ.get("OPTIX_BASE_URL", "https://api.optix.example.com/api/v1")
    with OptixClient(api_key, base_url=base_url) as client:
        stats = client.request("getStats")
        print(stats)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
