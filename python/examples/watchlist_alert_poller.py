"""Poll the documents endpoint and emit alerts for newly-seen entries.

Usage:
    OPTIX_API_KEY=optx_... python -m examples.watchlist_alert_poller
"""
from __future__ import annotations

import asyncio
import os
import sys
from typing import Set

from optix_intel import AsyncOptixClient


async def run() -> int:
    api_key = os.environ.get("OPTIX_API_KEY")
    if not api_key:
        print("Set OPTIX_API_KEY", file=sys.stderr)
        return 1
    interval = float(os.environ.get("OPTIX_POLL_INTERVAL", "60"))
    seen: Set[int] = set()
    async with AsyncOptixClient(api_key) as client:
        while True:
            page = await client.request("getDocuments", query={"limit": 50})
            items = page.get("items") if isinstance(page, dict) else page or []
            for doc in items:
                doc_id = doc.get("id")
                if doc_id is None or doc_id in seen:
                    continue
                seen.add(doc_id)
                print(f"NEW: [{doc_id}] {doc.get('title')}")
            await asyncio.sleep(interval)


def main() -> int:
    try:
        return asyncio.run(run())
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
