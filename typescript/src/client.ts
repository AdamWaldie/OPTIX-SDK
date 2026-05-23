// OptixClient — hand-written transport layer.
//
// Responsibilities:
//   • Construct `Authorization: Bearer <key>` (default) or attach
//     `?api_key=<key>` when `authMode: "query"` is configured.
//   • Retry 429 / 5xx with exponential backoff, honouring `Retry-After`
//     and `X-RateLimit-Reset`.
//   • Convert non-2xx responses into the typed error classes from
//     `errors.ts`.
//   • Provide a low-level `request()` helper plus a paginator
//     (`paginate()` async generator).

import {
  OptixApiError,
  OptixNetworkError,
  classifyHttpError,
} from "./errors";
import { OPERATIONS, type OperationName } from "./generated/operations";

export type AuthMode = "header" | "query";

export interface OptixClientOptions {
  apiKey: string;
  baseUrl?: string;
  authMode?: AuthMode;
  timeoutMs?: number;
  maxRetries?: number;
  fetchFn?: typeof fetch;
  userAgent?: string;
}

export interface RequestOptions {
  pathParams?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  /** Override per-request retry count. */
  maxRetries?: number;
}

const DEFAULT_BASE_URL = "https://api.optix.example.com/api/v1";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new OptixNetworkError("Aborted while waiting to retry"));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function fillPath(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{([^}]+)\}/g, (_, key) => {
    const v = params[key];
    if (v === undefined || v === null) {
      throw new Error(`Missing path parameter "${key}" for ${template}`);
    }
    return encodeURIComponent(String(v));
  });
}

function buildQuery(query: Record<string, unknown> | undefined): string {
  if (!query) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) for (const item of v) sp.append(k, String(item));
    else sp.append(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const n = Number(header);
  if (Number.isFinite(n)) return Math.max(0, n);
  const t = Date.parse(header);
  if (Number.isFinite(t)) return Math.max(0, Math.round((t - Date.now()) / 1000));
  return null;
}

export class OptixClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly authMode: AuthMode;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  private readonly userAgent: string;

  constructor(opts: OptixClientOptions) {
    if (!opts.apiKey) throw new Error("OptixClient requires an apiKey");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.authMode = opts.authMode ?? "header";
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchFn = opts.fetchFn ?? globalThis.fetch?.bind(globalThis);
    this.userAgent = opts.userAgent ?? "optix-sdk-js/0.1.0";
    if (!this.fetchFn) {
      throw new Error("No fetch implementation available. Pass `fetchFn` or run on Node ≥18.");
    }
  }

  /** Build the absolute URL for a given operation, inlining path/query. */
  buildUrl(operation: OperationName, opts: RequestOptions = {}): string {
    const def = OPERATIONS[operation];
    const path = fillPath(def.path, opts.pathParams);
    const query = { ...(opts.query ?? {}) };
    if (this.authMode === "query") query.api_key = this.apiKey;
    return `${this.baseUrl}${path}${buildQuery(query)}`;
  }

  /** Execute a typed operation by name, with retry + error classification. */
  async request<T = unknown>(operation: OperationName, opts: RequestOptions = {}): Promise<T> {
    const def = OPERATIONS[operation];
    const url = this.buildUrl(operation, opts);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": this.userAgent,
    };
    if (this.authMode === "header") headers.Authorization = `Bearer ${this.apiKey}`;
    if (def.hasBody && opts.body !== undefined) headers["Content-Type"] = "application/json";

    const maxRetries = opts.maxRetries ?? this.maxRetries;
    let attempt = 0;
    let lastErr: unknown = null;

    while (attempt <= maxRetries) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), this.timeoutMs);
      const userAbort = opts.signal;
      const onUserAbort = () => ac.abort();
      if (userAbort) {
        if (userAbort.aborted) ac.abort();
        else userAbort.addEventListener("abort", onUserAbort, { once: true });
      }

      let response: Response;
      try {
        response = await this.fetchFn(url, {
          method: def.method,
          headers,
          body: def.hasBody && opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: ac.signal,
        });
      } catch (err: any) {
        clearTimeout(timer);
        if (userAbort) userAbort.removeEventListener("abort", onUserAbort);
        // Network / abort errors → retry up to maxRetries on transient failures.
        lastErr = err;
        if (userAbort?.aborted) {
          throw new OptixNetworkError("Request aborted by caller", err);
        }
        if (attempt >= maxRetries) {
          throw new OptixNetworkError(`Network error: ${err?.message ?? String(err)}`, err);
        }
        await sleep(backoffMs(attempt), userAbort);
        attempt += 1;
        continue;
      }
      clearTimeout(timer);
      if (userAbort) userAbort.removeEventListener("abort", onUserAbort);

      const apiVersion = response.headers.get("API-Version");

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        const ct = response.headers.get("Content-Type") ?? "";
        if (ct.includes("application/json")) return (await response.json()) as T;
        return (await response.text()) as unknown as T;
      }

      // Non-2xx: read body, classify, decide retry.
      const bodyText = await response.text().catch(() => "");
      let parsed: unknown = bodyText;
      if (bodyText) {
        try { parsed = JSON.parse(bodyText); } catch { /* keep raw */ }
      }
      const message = extractErrorMessage(parsed) ?? `HTTP ${response.status} ${response.statusText}`;
      const retryAfterSeconds = parseRetryAfter(response.headers.get("Retry-After"));
      const rateLimitReset = response.headers.get("X-RateLimit-Reset");

      const isRetriable = response.status === 429 || (response.status >= 500 && response.status <= 599);
      if (isRetriable && attempt < maxRetries) {
        const waitMs = (retryAfterSeconds !== null ? retryAfterSeconds * 1000 : backoffMs(attempt));
        await sleep(waitMs, userAbort);
        attempt += 1;
        lastErr = parsed;
        continue;
      }

      throw classifyHttpError({
        status: response.status,
        message,
        body: parsed,
        apiVersion,
        retryAfterSeconds,
        rateLimitReset,
      });
    }
    // Unreachable: the loop either returns or throws.
    throw new OptixApiError({
      status: 0,
      message: `Exhausted retries: ${String(lastErr)}`,
    });
  }

  /**
   * Async iterator over a paginated list endpoint. Walks the response
   * looking for an array under `items`/`results`/`data` (or, if the body
   * itself is an array, that array) and stops when fewer than `limit`
   * items come back.
   */
  async *paginate<T = unknown>(
    operation: OperationName,
    opts: RequestOptions & { limit?: number; pageSize?: number } = {},
  ): AsyncGenerator<T, void, void> {
    const pageSize = opts.pageSize ?? 100;
    let offset = (opts.query?.offset as number | undefined) ?? 0;
    const hardLimit = opts.limit ?? Infinity;
    let yielded = 0;
    while (yielded < hardLimit) {
      const page = await this.request<unknown>(operation, {
        ...opts,
        query: { ...(opts.query ?? {}), limit: Math.min(pageSize, hardLimit - yielded), offset },
      });
      const items = extractItems<T>(page);
      if (!items.length) return;
      for (const item of items) {
        if (yielded >= hardLimit) return;
        yield item;
        yielded += 1;
      }
      if (items.length < pageSize) return;
      offset += items.length;
    }
  }
}

function backoffMs(attempt: number): number {
  // Exponential backoff with full jitter, capped at 10s.
  const base = Math.min(10_000, 250 * Math.pow(2, attempt));
  return Math.floor(Math.random() * base);
}

function extractErrorMessage(body: unknown): string | null {
  if (typeof body === "string") return body || null;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") return b.message;
    if (typeof b.error === "string") return b.error;
  }
  return null;
}

function extractItems<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const key of ["items", "results", "data", "documents", "entities", "sources", "feeds", "indicators"]) {
      const v = b[key];
      if (Array.isArray(v)) return v as T[];
    }
  }
  return [];
}
