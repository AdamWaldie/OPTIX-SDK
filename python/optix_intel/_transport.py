"""Transport helpers shared between the sync and async OPTIX clients."""
from __future__ import annotations

import random
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple
from urllib.parse import quote

from ._generated.operations import OPERATIONS, OperationDef


_PAGE_KEYS = ("items", "results", "data", "documents", "entities", "sources", "feeds", "indicators")


def resolve_operation(name: str) -> OperationDef:
    try:
        return OPERATIONS[name]
    except KeyError as exc:
        raise ValueError(f"Unknown operation '{name}'") from exc


def fill_path(template: str, params: Optional[Mapping[str, Any]]) -> str:
    if "{" not in template:
        return template
    out = template
    for key, value in (params or {}).items():
        token = "{" + key + "}"
        if token in out:
            out = out.replace(token, quote(str(value), safe=""))
    if "{" in out:
        missing = [
            seg for seg in out.split("{")[1:] if "}" in seg
        ]
        raise ValueError(f"Missing path parameter(s) for {template}: {missing}")
    return out


def build_query(query: Optional[Mapping[str, Any]]) -> List[Tuple[str, str]]:
    if not query:
        return []
    out: List[Tuple[str, str]] = []
    for key, value in query.items():
        if value is None:
            continue
        if isinstance(value, (list, tuple, set)):
            for item in value:
                out.append((key, str(item)))
        elif isinstance(value, bool):
            out.append((key, "true" if value else "false"))
        else:
            out.append((key, str(value)))
    return out


def parse_retry_after(header: Optional[str]) -> Optional[float]:
    if not header:
        return None
    try:
        return max(0.0, float(header))
    except ValueError:
        pass
    try:
        dt = parsedate_to_datetime(header)
    except (TypeError, ValueError):
        return None
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0.0, (dt - datetime.now(timezone.utc)).total_seconds())


def backoff_seconds(attempt: int) -> float:
    """Exponential backoff with full jitter, capped at 10s."""
    base = min(10.0, 0.25 * (2 ** attempt))
    return random.random() * base


def extract_error_message(body: Any) -> Optional[str]:
    if isinstance(body, str):
        return body or None
    if isinstance(body, dict):
        msg = body.get("message")
        if isinstance(msg, str) and msg:
            return msg
        err = body.get("error")
        if isinstance(err, str) and err:
            return err
    return None


def extract_items(body: Any) -> List[Any]:
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        for key in _PAGE_KEYS:
            value = body.get(key)
            if isinstance(value, list):
                return value
    return []


def build_headers(
    *,
    api_key: str,
    auth_mode: str,
    user_agent: str,
    has_body: bool,
    extra: Optional[Mapping[str, str]] = None,
) -> Dict[str, str]:
    headers: Dict[str, str] = {
        "Accept": "application/json",
        "User-Agent": user_agent,
    }
    if auth_mode == "header":
        headers["Authorization"] = f"Bearer {api_key}"
    if has_body:
        headers["Content-Type"] = "application/json"
    if extra:
        for k, v in extra.items():
            headers[k] = v
    return headers


def merge_query(
    operation_query: Optional[Mapping[str, Any]],
    api_key: str,
    auth_mode: str,
) -> Iterable[Tuple[str, str]]:
    items = list(build_query(operation_query))
    if auth_mode == "query":
        items.append(("api_key", api_key))
    return items
