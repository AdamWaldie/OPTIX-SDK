"""Synchronous OPTIX client built on httpx."""
from __future__ import annotations

import json as _json
import time
from typing import Any, Iterator, Mapping, Optional

import httpx

from . import _transport as _t
from .errors import OptixApiError, OptixNetworkError, classify_http_error

_DEFAULT_BASE_URL = "https://api.optix.example.com/api/v1"
_DEFAULT_TIMEOUT = 30.0
_DEFAULT_MAX_RETRIES = 3
_USER_AGENT = "optix-sdk-python/0.1.0"


class OptixClient:
    """Blocking client. Use :class:`AsyncOptixClient` for asyncio code."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = _DEFAULT_BASE_URL,
        auth_mode: str = "header",
        timeout: float = _DEFAULT_TIMEOUT,
        max_retries: int = _DEFAULT_MAX_RETRIES,
        transport: Optional[httpx.BaseTransport] = None,
        user_agent: str = _USER_AGENT,
    ) -> None:
        if not api_key:
            raise ValueError("OptixClient requires an api_key")
        if auth_mode not in ("header", "query"):
            raise ValueError("auth_mode must be 'header' or 'query'")
        self._api_key = api_key
        self._auth_mode = auth_mode
        self._base_url = base_url.rstrip("/")
        self._max_retries = max_retries
        self._user_agent = user_agent
        self._http = httpx.Client(
            base_url=self._base_url,
            timeout=timeout,
            transport=transport,
        )

    def __enter__(self) -> "OptixClient":
        return self

    def __exit__(self, *exc_info: Any) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def request(
        self,
        operation: str,
        *,
        path_params: Optional[Mapping[str, Any]] = None,
        query: Optional[Mapping[str, Any]] = None,
        body: Any = None,
        max_retries: Optional[int] = None,
    ) -> Any:
        op = _t.resolve_operation(operation)
        path = _t.fill_path(op["path"], path_params)
        params = list(_t.merge_query(query, self._api_key, self._auth_mode))
        headers = _t.build_headers(
            api_key=self._api_key,
            auth_mode=self._auth_mode,
            user_agent=self._user_agent,
            has_body=op["has_body"] and body is not None,
        )
        retries = self._max_retries if max_retries is None else max_retries
        attempt = 0
        while True:
            try:
                resp = self._http.request(
                    op["method"],
                    path,
                    params=params,
                    headers=headers,
                    content=_json.dumps(body) if op["has_body"] and body is not None else None,
                )
            except httpx.HTTPError as exc:
                if attempt >= retries:
                    raise OptixNetworkError(f"Network error: {exc}", cause=exc) from exc
                time.sleep(_t.backoff_seconds(attempt))
                attempt += 1
                continue

            api_version = resp.headers.get("API-Version")
            if 200 <= resp.status_code < 300:
                if resp.status_code == 204 or not resp.content:
                    return None
                ctype = resp.headers.get("Content-Type", "")
                if "application/json" in ctype:
                    return resp.json()
                return resp.text

            parsed: Any = resp.text
            if resp.content:
                try:
                    parsed = resp.json()
                except ValueError:
                    pass
            message = _t.extract_error_message(parsed) or f"HTTP {resp.status_code}"
            retry_after = _t.parse_retry_after(resp.headers.get("Retry-After"))
            rate_limit_reset = resp.headers.get("X-RateLimit-Reset")

            retriable = resp.status_code == 429 or 500 <= resp.status_code < 600
            if retriable and attempt < retries:
                wait = retry_after if retry_after is not None else _t.backoff_seconds(attempt)
                time.sleep(wait)
                attempt += 1
                continue

            raise classify_http_error(
                resp.status_code,
                message,
                body=parsed,
                api_version=api_version,
                retry_after_seconds=retry_after,
                rate_limit_reset=rate_limit_reset,
            )

    def paginate(
        self,
        operation: str,
        *,
        path_params: Optional[Mapping[str, Any]] = None,
        query: Optional[Mapping[str, Any]] = None,
        page_size: int = 100,
        limit: Optional[int] = None,
    ) -> Iterator[Any]:
        offset = int((query or {}).get("offset", 0) or 0)
        yielded = 0
        while limit is None or yielded < limit:
            page_limit = page_size if limit is None else min(page_size, limit - yielded)
            merged_query = dict(query or {})
            merged_query.update({"limit": page_limit, "offset": offset})
            page = self.request(operation, path_params=path_params, query=merged_query)
            items = _t.extract_items(page)
            if not items:
                return
            for item in items:
                if limit is not None and yielded >= limit:
                    return
                yield item
                yielded += 1
            if len(items) < page_size:
                return
            offset += len(items)
