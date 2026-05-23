// Example: authenticate and fetch platform stats.
//
// Usage:
//   OPTIX_API_KEY=optx_… tsx sdks/typescript/examples/auth.ts

import { OptixClient } from "../src/index";

async function main() {
  const apiKey = process.env.OPTIX_API_KEY;
  if (!apiKey) throw new Error("Set OPTIX_API_KEY before running this example.");

  const client = new OptixClient({
    apiKey,
    baseUrl: process.env.OPTIX_BASE_URL ?? "https://api.optix.example.com/api/v1",
  });

  const stats = await client.request("getStats");
  console.log("Platform stats:", stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
