"""Typed error hierarchy for the OPTIX Python SDK."""
from __future__ import annotations

from typing import Any, Optional


class OptixApiError(Exception):
    """Base class for every non-2xx HTTP response."""

    def __init__(
        self,
        message: str,
        *,
        status: int,
        body: Any = None,
        api_version: Optional[str] = None,
        retry_after_seconds: Optional[float] = None,
        rate_limit_reset: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.body = body
        self.api_version = api_version
        self.retry_after_seconds = retry_after_seconds
        self.rate_limit_reset = rate_limit_reset


class OptixAuthError(OptixApiError):
    """401 / 403 — invalid, disabled, expired key, or insufficient permissions."""


class OptixValidationError(OptixApiError):
    """400 / 422 — request payload failed validation."""


class OptixRateLimitError(OptixApiError):
    """429 — rate limit exceeded. ``retry_after_seconds`` is populated when known."""


class OptixNetworkError(Exception):
    """Transport-level failure (DNS, TCP, TLS, abort, timeout)."""

    def __init__(self, message: str, cause: Optional[BaseException] = None) -> None:
        super().__init__(message)
        self.cause = cause


def classify_http_error(
    status: int,
    message: str,
    *,
    body: Any = None,
    api_version: Optional[str] = None,
    retry_after_seconds: Optional[float] = None,
    rate_limit_reset: Optional[str] = None,
) -> OptixApiError:
    kwargs = dict(
        status=status,
        body=body,
        api_version=api_version,
        retry_after_seconds=retry_after_seconds,
        rate_limit_reset=rate_limit_reset,
    )
    if status in (401, 403):
        return OptixAuthError(message, **kwargs)
    if status in (400, 422):
        return OptixValidationError(message, **kwargs)
    if status == 429:
        return OptixRateLimitError(message, **kwargs)
    return OptixApiError(message, **kwargs)
