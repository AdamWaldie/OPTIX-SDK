# Releasing the OPTIX SDKs

> **Scope.** SDK publishing is automated via
> `.github/workflows/sdk-release.yml` (Task #1604). The fast path is to
> bump the manifest version, push a `sdk-v<x.y.z>` tag, and let CI ship
> both packages. The manual flow below is preserved as a fallback when
> the workflow is unavailable.

## Automated release (preferred)

1. Confirm the OpenAPI spec at `server/api-docs.ts` is the version you
   want to ship and regenerate the stubs:

   ```bash
   tsx scripts/sdk-codegen.ts
   bash scripts/sdk-check.sh
   ```

2. Bump the version in **both** manifests so the registries stay in
   lock-step (the SDKs panel reads these and the workflow validates the
   tag against them):
   - `sdks/typescript/package.json` → `"version"`
   - `sdks/python/pyproject.toml` → `[project] version`

   Add matching `CHANGELOG.md` entries under each package.

3. Open a PR. The `Spec drift & SDK tests` check enforces that
   `scripts/sdk-codegen.ts --check` passes and that the per-language
   tests still go green.

4. After merge, push a release tag from `main`:

   ```bash
   git tag sdk-v<x.y.z>
   git push origin sdk-v<x.y.z>
   ```

   Tag conventions:
   - `sdk-v<x.y.z>` — publishes both TypeScript and Python.
   - `sdk-ts-v<x.y.z>` — TypeScript only.
   - `sdk-py-v<x.y.z>` — Python only.

   The `publish-npm` and `publish-pypi` jobs run in the `sdk-release`
   GitHub environment, which gates on the `NPM_TOKEN` and
   `PYPI_API_TOKEN` secrets. npm publishes use `--provenance` so
   consumers get the signed attestation in the package manifest.

5. As an emergency switch you can also kick the workflow off via
   `workflow_dispatch` with the `publish_typescript` / `publish_python`
   toggles — it skips the tag-version assertion in that mode, so make
   sure the manifests already reflect the version you want shipped.

## Manual fallback

## Pre-flight (both languages)

1. Confirm the OpenAPI spec at `server/api-docs.ts` is the version you
   want to ship. Increment `info.version` if the surface changed.
2. Regenerate stubs and verify nothing else changed:

   ```bash
   tsx scripts/sdk-codegen.ts
   git status sdks/
   ```

3. Run the full SDK check:

   ```bash
   bash scripts/sdk-check.sh
   ```

4. Bump the version in the package manifest (see per-language sections
   below) and add a `CHANGELOG.md` entry.

## TypeScript (`sdks/typescript/`)

```bash
cd sdks/typescript
npm install
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
npm test
npm publish --access public
```

The `prepublishOnly` script enforces `build` + `test` before any tarball
leaves the workstation.

## Python (`sdks/python/`)

```bash
cd sdks/python
python -m pip install --upgrade build twine
python -m build           # → dist/optix_intel-*.tar.gz + .whl
twine check dist/*
twine upload dist/*
```

Publish credentials should be stored in `~/.pypirc` or supplied via
`TWINE_USERNAME`/`TWINE_PASSWORD` env vars. Use a project-scoped PyPI API
token, never a personal token.

## Tagging the release

After publishing both packages, tag the monorepo:

```bash
git tag sdk-v<version>
git push origin sdk-v<version>
```

## Yanking a release

- npm: `npm deprecate @optix/sdk@<version> "<reason>"`. Avoid `npm
  unpublish`; it leaves consumers in a broken state.
- PyPI: yank via the project page or `twine`'s `yank` command. PyPI does
  not allow re-uploads of the same version.
