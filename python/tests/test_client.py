"""Sync OptixClient tests using httpx.MockTransport."""
from __future__ import annotations

import json
from typing import Any, Callable, List

import httpx
import pytest

from optix_intel import (
    OptixApiError,
    OptixAuthError,
    OptixClient,
    OptixRateLimitError,
    OptixValidationError,
)


def make_client(handler: Callable[[httpx.Request], httpx.Response], **kwargs: Any) -> OptixClient:
    transport = httpx.MockTransport(handler)
    return OptixClient(
        api_key="optx_test",
        base_url="https://example.test/api/v1",
        transport=transport,
        max_retries=kwargs.pop("max_retries", 0),
        **kwargs,
    )


def test_bearer_auth_default() -> None:
    seen: List[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json={"ok": True})

    with make_client(handler) as client:
        client.request("getStats")

    assert seen[0].headers.get("Authorization") == "Bearer optx_test"
    assert "api_key=" not in str(seen[0].url)


def test_query_auth_mode() -> None:
    seen: List[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json={"ok": True})

    with make_client(handler, auth_mode="query") as client:
        client.request("getStats")
    assert "api_key=optx_test" in str(seen[0].url)
    assert "Authorization" not in seen[0].headers


def test_path_params_inlined() -> None:
    seen: List[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json={"id": 7})

    with make_client(handler) as client:
        client.request("getDocumentsById", path_params={"id": 7})
    assert seen[0].url.path == "/api/v1/documents/7"


@pytest.mark.parametrize(
    "status,exc",
    [(401, OptixAuthError), (403, OptixAuthError), (400, OptixValidationError), (429, OptixRateLimitError)],
)
def test_error_classification(status: int, exc: type[OptixApiError]) -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(status, json={"error": "x"}, headers={"Retry-After": "0"})

    with make_client(handler) as client:
        with pytest.raises(exc):
            client.request("getStats")


def test_retries_429_then_succeeds() -> None:
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, json={"error": "rate"}, headers={"Retry-After": "0"})
        return httpx.Response(200, json={"ok": True})

    with make_client(handler, max_retries=2) as client:
        assert client.request("getStats") == {"ok": True}
    assert calls["n"] == 2


def test_retries_500_then_succeeds() -> None:
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(500, json={"error": "boom"})
        return httpx.Response(200, json={"ok": True})

    with make_client(handler, max_retries=2) as client:
        assert client.request("getStats") == {"ok": True}
    assert calls["n"] == 2


def test_api_version_header_preserved_on_error() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"error": "nope"}, headers={"API-Version": "1"})

    with make_client(handler) as client:
        with pytest.raises(OptixAuthError) as info:
            client.request("getStats")
        assert info.value.api_version == "1"


def test_paginate_walks_pages() -> None:
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(200, json={"items": [{"id": i} for i in range(5)]})
        return httpx.Response(200, json={"items": [{"id": 5}]})

    with make_client(handler) as client:
        items = list(client.paginate("getDocuments", page_size=5))
    assert [i["id"] for i in items] == [0, 1, 2, 3, 4, 5]


def test_paginate_respects_limit() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"items": [{"id": i} for i in range(100)]})

    with make_client(handler) as client:
        items = list(client.paginate("getDocuments", page_size=100, limit=3))
    assert len(items) == 3
