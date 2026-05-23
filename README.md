# OPTIX Official SDKs

This directory contains the official client libraries for the OPTIX Threat
Intelligence platform's versioned REST API (`/api/v1/*`).

| Language   | Package        | Path               | Status |
|------------|----------------|--------------------|--------|
| TypeScript | `@optix/sdk`   | `sdks/typescript/` | Beta   |
| Python     | `optix_intel`  | `sdks/python/`     | Beta   |

Both packages target the public surface returned by `getApiDocumentation()`
in `server/api-docs.ts`. They are completely decoupled from the rest of the
monorepo — no imports from `server/`, `shared/`, or `client/`. The
`sdks/` workspace is a *convenience for monorepo CI*, not a coupling.

## Regenerating from the OpenAPI spec

The model + operation stubs in each SDK are generated from the OpenAPI 3.0
document produced by `server/api-docs.ts`'s `generateOpenApiSpec()`. To
regenerate after a spec change:

```bash
tsx scripts/sdk-codegen.ts
```

Generated files live under `sdks/<lang>/src/generated/` (TS) and
`sdks/python/optix_intel/_generated/` (Python). They are checked into the
repo so SDK consumers cloning the package don't need our codegen tooling.

## CI: spec-vs-codegen drift check

```bash
bash scripts/sdk-check.sh
```

This script:

1. Re-runs the codegen with `--check` and fails if the generated files would
   change (i.e. someone updated `server/api-docs.ts` without regenerating).
2. Type-checks and tests the TypeScript SDK (when its dependencies are
   installed in `sdks/typescript/`).
3. Runs the Python SDK pytest suite (when Python and its deps are
   available).

The expectation is that wherever `server/api-docs.ts` is touched in CI, the
job invokes `bash scripts/sdk-check.sh` so spec drift fails the build.

## Releasing

See [`RELEASING.md`](./RELEASING.md) for the manual publish flow. Actual
publish tokens and release automation are tracked as a follow-up task.

## Architectural rules

- SDKs depend ONLY on the public `/api/v1/*` surface.
- Generated code lives in `<lang>/src/generated/` (or `_generated/` for
  Python). Hand-written code lives outside that folder.
- Do not modify the on-the-wire API to satisfy the SDK. If the OpenAPI
  spec is wrong, fix `server/api-docs.ts` and regenerate.
- Per-language manifests (`package.json`, `pyproject.toml`) own their own
  dependencies. The repo root `package.json` is intentionally untouched.
