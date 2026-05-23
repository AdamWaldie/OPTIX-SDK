"""Stream the IOC blocklist export to stdout.

Usage:
    OPTIX_API_KEY=optx_... python -m examples.stream_ioc_export > blocklist.txt
"""
from __future__ import annotations

import os
import sys

from optix_intel import OptixClient


def main() -> int:
    api_key = os.environ.get("OPTIX_API_KEY")
    if not api_key:
        print("Set OPTIX_API_KEY", file=sys.stderr)
        return 1
    with OptixClient(api_key) as client:
        body = client.request(
            "getIocExportBlocklist",
            query={"format": "txt", "minEffectiveConfidence": 0.5},
        )
    sys.stdout.write(body if isinstance(body, str) else str(body))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
