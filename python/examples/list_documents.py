"""List the most recent accepted documents.

Usage:
    OPTIX_API_KEY=optx_... python -m examples.list_documents
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
        page = client.request("getDocuments", query={"limit": 25})
        items = page.get("items") if isinstance(page, dict) else page or []
        for doc in items:
            print(f"[{doc.get('id')}] {doc.get('title')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
