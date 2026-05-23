// Public entry point for @optix/sdk.
//
// Consumers should import from this module only — internal layout
// (resources/, generated/) is not part of the stable surface.

export { OptixClient } from "./client";
export type { OptixClientOptions, RequestOptions, AuthMode } from "./client";
export {
  OptixApiError,
  OptixAuthError,
  OptixValidationError,
  OptixRateLimitError,
  OptixNetworkError,
} from "./errors";
export { buildResources } from "./resources";
export type { ResourceNamespaces } from "./resources";
export { OPERATIONS } from "./generated/operations";
export type { OperationName } from "./generated/operations";
