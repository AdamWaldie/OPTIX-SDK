// Typed error hierarchy for the OPTIX SDK.
//
// All HTTP failures surface as a subclass of OptixApiError so callers can
// branch with `instanceof`. The parsed server payload (when JSON), HTTP
// status code, and the `API-Version` response header are always preserved.

export interface OptixApiErrorOptions {
  status: number;
  message: string;
  body?: unknown;
  apiVersion?: string | null;
  retryAfterSeconds?: number | null;
  rateLimitReset?: string | null;
}

export class OptixApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly apiVersion: string | null;
  readonly retryAfterSeconds: number | null;
  readonly rateLimitReset: string | null;

  constructor(opts: OptixApiErrorOptions) {
    super(opts.message);
    this.name = "OptixApiError";
    this.status = opts.status;
    this.body = opts.body;
    this.apiVersion = opts.apiVersion ?? null;
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
    this.rateLimitReset = opts.rateLimitReset ?? null;
  }
}

export class OptixAuthError extends OptixApiError {
  constructor(opts: OptixApiErrorOptions) {
    super(opts);
    this.name = "OptixAuthError";
  }
}

export class OptixValidationError extends OptixApiError {
  constructor(opts: OptixApiErrorOptions) {
    super(opts);
    this.name = "OptixValidationError";
  }
}

export class OptixRateLimitError extends OptixApiError {
  constructor(opts: OptixApiErrorOptions) {
    super(opts);
    this.name = "OptixRateLimitError";
  }
}

export class OptixNetworkError extends Error {
  readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "OptixNetworkError";
    this.cause = cause;
  }
}

export function classifyHttpError(opts: OptixApiErrorOptions): OptixApiError {
  if (opts.status === 401) return new OptixAuthError(opts);
  if (opts.status === 403) return new OptixAuthError(opts);
  if (opts.status === 422 || opts.status === 400) return new OptixValidationError(opts);
  if (opts.status === 429) return new OptixRateLimitError(opts);
  return new OptixApiError(opts);
}
