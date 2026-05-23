import { describe, it, expect, vi } from "vitest";
import { OptixClient, buildResources } from "../src/index";

describe("buildResources", () => {
  it("forwards documents.list to the documents endpoint", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn });
    const r = buildResources(client);
    await r.documents.list();
    expect(fetchFn.mock.calls[0][0]).toBe("https://x/api/v1/documents");
  });

  it("entities.get inlines path parameters", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 7 }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const client = new OptixClient({ apiKey: "k", baseUrl: "https://x/api/v1", fetchFn });
    const r = buildResources(client);
    await r.entities.get({ pathParams: { id: 7 } });
    expect(fetchFn.mock.calls[0][0]).toBe("https://x/api/v1/entities/7");
  });
});
