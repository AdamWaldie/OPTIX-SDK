// Example: stream every accepted document via the paginator.
//
// Usage:
//   OPTIX_API_KEY=optx_… tsx sdks/typescript/examples/paginate-documents.ts

import { OptixClient } from "../src/index";

async function main() {
  const client = new OptixClient({
    apiKey: process.env.OPTIX_API_KEY ?? (() => { throw new Error("Set OPTIX_API_KEY"); })(),
  });

  let count = 0;
  for await (const doc of client.paginate<{ id: number; title: string }>("getDocuments", { pageSize: 200, limit: 1000 })) {
    count += 1;
    if (count <= 5) console.log(`[${doc.id}] ${doc.title}`);
  }
  console.log(`Streamed ${count} documents.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
