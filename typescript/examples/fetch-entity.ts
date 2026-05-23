// Example: fetch a single entity by ID.
//
// Usage:
//   OPTIX_API_KEY=optx_… tsx sdks/typescript/examples/fetch-entity.ts 42

import { OptixClient, buildResources, OptixApiError } from "../src/index";

async function main() {
  const id = Number(process.argv[2] ?? 1);
  const client = new OptixClient({ apiKey: requireEnv("OPTIX_API_KEY") });
  const r = buildResources(client);
  try {
    const entity = await r.entities.get({ pathParams: { id } });
    console.log(JSON.stringify(entity, null, 2));
  } catch (err) {
    if (err instanceof OptixApiError) {
      console.error(`API error ${err.status}: ${err.message}`);
      process.exit(2);
    }
    throw err;
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

main();
