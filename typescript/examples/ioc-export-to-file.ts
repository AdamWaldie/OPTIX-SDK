// Example: download an IOC blocklist to a local file.
//
// Usage:
//   OPTIX_API_KEY=optx_… tsx sdks/typescript/examples/ioc-export-to-file.ts ./blocklist.txt

import * as fs from "fs";
import { OptixClient } from "../src/index";

async function main() {
  const out = process.argv[2] ?? "./blocklist.txt";
  const client = new OptixClient({
    apiKey: process.env.OPTIX_API_KEY ?? (() => { throw new Error("Set OPTIX_API_KEY"); })(),
  });

  // The blocklist endpoint returns text/plain; the client surfaces it as a string.
  const body = await client.request<string>("getIocExportBlocklist", {
    query: { format: "txt", minEffectiveConfidence: 0.5 },
  });
  fs.writeFileSync(out, typeof body === "string" ? body : JSON.stringify(body));
  console.log(`Wrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
