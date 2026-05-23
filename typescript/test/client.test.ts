// OptixClient transport-layer tests.
//
// We avoid msw here intentionally — these tests stub `fetch` directly so
// they run with no network and no extra dev-server. The msw dependency is
// still declared in package.json for consumers who want to write
// integration tests of their own apps.

import { describe, it, expect, vi } from "vitest";
import {
  OptixClient,
  OptixApiError,
  OptixAuthError,
  OptixRateLimitError,
  OptixValidationError,
} from "../src/index";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("OptixClient", () => {
  it("sends bearer auth by default", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = new OptixClient({ apiKey: "optx_test", baseUrl: "https://example/api/v1", fetchFn });
    await client.request("getStats");
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://example/api/v1/stats");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer optx_test");
  });

  it("supports api_key query mode", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = new OptixClient({ apiKey: "optx_test", authMode: "query", baseUrl: "https://x/api/v1", fetchFn });
    await client.request("getStats");
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("api_key=optx_test");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("inlines path parameters", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { id: 42 }));
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn });
    await client.request("getDocumentsById", { pathParams: { id: 42 } });
    expect(fetchFn.mock.calls[0][0]).toBe("https://x/api/v1/documents/42");
  });

  it("classifies 401 as OptixAuthError", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(401, { error: "Invalid API key" }));
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn, maxRetries: 0 });
    await expect(client.request("getStats")).rejects.toBeInstanceOf(OptixAuthError);
  });

  it("classifies 400 as OptixValidationError", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(400, { error: "bad", message: "nope" }));
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn, maxRetries: 0 });
    await expect(client.request("getStats")).rejects.toBeInstanceOf(OptixValidationError);
  });

  it("retries 429 honouring Retry-After then surfaces the error", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate" }, { "Retry-After": "0" }))
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate" }, { "Retry-After": "0" }));
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn, maxRetries: 1 });
    const err = (await client.request("getStats").catch((e) => e)) as OptixApiError;
    expect(err).toBeInstanceOf(OptixRateLimitError);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("retries 500 then succeeds", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: "boom" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn, maxRetries: 2 });
    const out = await client.request<{ ok: boolean }>("getStats");
    expect(out.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("preserves API-Version header on errors", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(403, { error: "nope" }, { "API-Version": "1" }));
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn, maxRetries: 0 });
    const err = (await client.request("getStats").catch((e) => e)) as OptixApiError;
    expect(err.apiVersion).toBe("1");
  });

  it("paginates a list endpoint until a short page", async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: Array.from({ length: 5 }, (_, i) => ({ id: i })) }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [{ id: 5 }] }));
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn });
    const out: any[] = [];
    for await (const item of client.paginate("getDocuments", { pageSize: 5 })) {
      out.push(item);
    }
    expect(out.map((d) => d.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("paginate respects hard limit", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200, { items: Array.from({ length: 100 }, (_, i) => ({ id: i })) }));
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn });
    const out: any[] = [];
    for await (const item of client.paginate("getDocuments", { limit: 3, pageSize: 100 })) out.push(item);
    expect(out).toHaveLength(3);
  });
});
