"""Official Python SDK for the OPTIX Threat Intelligence REST API.

Public surface::

    from optix_intel import OptixClient, AsyncOptixClient
    from optix_intel import (
        OptixApiError,
        OptixAuthError,
        OptixValidationError,
        OptixRateLimitError,
        OptixNetworkError,
    )

The SDK targets the versioned ``/api/v1/*`` surface only. See the
top-level ``sdks/README.md`` for codegen and release guidance.
"""

from .client import OptixClient
from .async_client import AsyncOptixClient
from .errors import (
    OptixApiError,
    OptixAuthError,
    OptixNetworkError,
    OptixRateLimitError,
    OptixValidationError,
)
from ._generated.operations import OPERATIONS

__all__ = [
    "OptixClient",
    "AsyncOptixClient",
    "OptixApiError",
    "OptixAuthError",
    "OptixNetworkError",
    "OptixRateLimitError",
    "OptixValidationError",
    "OPERATIONS",
]

__version__ = "0.1.0"
