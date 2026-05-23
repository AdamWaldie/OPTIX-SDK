"""AsyncOptixClient tests using httpx.MockTransport.

We deliberately avoid the `pytest-asyncio` dependency by driving the
async client through ``asyncio.run`` inside synchronous test
functions. This keeps the test surface usable with just `pytest` +
`httpx` and matches the runtime constraints of the SDK consumers.
"""
from __future__ import annotations

import asyncio
from typing import Any, Callable, List

import httpx
import pytest

from optix_intel import AsyncOptixClient, OptixAuthError


def make_async_client(handler: Callable[[httpx.Request], httpx.Response], **kwargs: Any) -> AsyncOptixClient:
    transport = httpx.MockTransport(handler)
    return AsyncOptixClient(
        api_key="optx_test",
        base_url="https://example.test/api/v1",
        transport=transport,
        max_retries=kwargs.pop("max_retries", 0),
        **kwargs,
    )


def test_async_basic_request() -> None:
    seen: List[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json={"ok": True})

    async def run() -> Any:
        async with make_async_client(handler) as client:
            return await client.request("getStats")

    out = asyncio.run(run())
    assert out == {"ok": True}
    assert seen[0].headers.get("Authorization") == "Bearer optx_test"


def test_async_classifies_auth_error() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "no"})

    async def run() -> None:
        async with make_async_client(handler) as client:
            await client.request("getStats")

    with pytest.raises(OptixAuthError):
        asyncio.run(run())


def test_async_paginate() -> None:
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(200, json={"items": [{"id": i} for i in range(5)]})
        return httpx.Response(200, json={"items": [{"id": 5}]})

    async def run() -> List[Any]:
        out: List[Any] = []
        async with make_async_client(handler) as client:
            async for item in client.paginate("getDocuments", page_size=5):
                out.append(item)
        return out

    items = asyncio.run(run())
    assert [i["id"] for i in items] == [0, 1, 2, 3, 4, 5]
