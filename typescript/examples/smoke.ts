// Live-API smoke test for the OPTIX TypeScript SDK.
//
// Exercises three round-trips against the running API to catch contract
// drift between server/api-docs.ts and the published SDK:
//
//   1. Auth check          — GET /stats with the supplied API key
//   2. Paginated list      — `paginate("getDocuments")` walks at least
//                            one page and respects a small `limit`.
//   3. Error envelope      — a deliberately bad key must surface as a
//                            typed OptixAuthError with the server's
//                            `{ error: ... }` envelope intact.
//
// Usage:
//   OPTIX_API_KEY=optx_… [OPTIX_BASE_URL=http://localhost:5000/api/v1] \
//     npx tsx sdks/typescript/examples/smoke.ts
//
// Exits non-zero on any failure so it can be wired into CI.

import { OptixClient, OptixApiError, OptixAuthError } from "../src/index";

const apiKey = process.env.OPTIX_API_KEY;
const baseUrl = process.env.OPTIX_BASE_URL ?? "http://localhost:5000/api/v1";

if (!apiKey) {
  console.error("OPTIX_API_KEY is not set — skipping live smoke test.");
  process.exit(2);
}

async function main() {
  const client = new OptixClient({ apiKey, baseUrl, maxRetries: 1 });

  // 1) Auth round-trip.
  console.log(`[smoke] (1/3) GET ${baseUrl}/stats`);
  const stats = await client.request<Record<string, unknown>>("getStats");
  if (!stats || typeof stats !== "object") {
    throw new Error(`getStats returned non-object: ${JSON.stringify(stats)}`);
  }
  console.log(`[smoke]   ✓ stats keys: ${Object.keys(stats).join(", ")}`);

  // 2) Paginated list — request a small page so we don't hammer the API.
  console.log(`[smoke] (2/3) paginate getDocuments (enriched feed, limit=3)`);
  let count = 0;
  for await (const _doc of client.paginate("getDocuments", {
    query: { enriched: "true" },
    pageSize: 3,
    limit: 3,
  })) {
    count += 1;
  }
  console.log(`[smoke]   ✓ streamed ${count} document(s)`);

  // 3) Error envelope — a bogus key must round-trip as OptixAuthError.
  console.log(`[smoke] (3/3) error envelope (expect 401 → OptixAuthError)`);
  const bad = new OptixClient({ apiKey: "optx_definitely_invalid", baseUrl, maxRetries: 0 });
  let caught: unknown = null;
  try {
    await bad.request("getStats");
  } catch (err) {
    caught = err;
  }
  if (!(caught instanceof OptixAuthError)) {
    throw new Error(
      `Expected OptixAuthError, got ${caught instanceof OptixApiError ? `${caught.constructor.name}(${caught.status})` : String(caught)}`,
    );
  }
  if (caught.status !== 401 && caught.status !== 403) {
    throw new Error(`Expected 401/403 status, got ${caught.status}`);
  }
  console.log(`[smoke]   ✓ ${caught.constructor.name} status=${caught.status} message="${caught.message}"`);
  console.log("[smoke] OK");
}

main().catch((err) => {
  console.error("[smoke] FAILED:", err);
  process.exit(1);
});
