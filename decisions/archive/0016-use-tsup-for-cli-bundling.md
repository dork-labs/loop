---
number: 16
title: Use tsup for CLI bundling with ESM output
status: draft
created: 2026-02-20
spec: mvp-phase-4-cli-tool
superseded-by: null
---

# 16. Use tsup for CLI bundling with ESM output

## Status

Draft (auto-extracted from spec: mvp-phase-4-cli-tool)

## Context

The `looped` CLI needs to be bundled into a single distributable file for npm publishing. The monorepo uses `"type": "module"` (ESM). The entry point requires a `#!/usr/bin/env node` shebang for the `bin` field in package.json.

Candidates evaluated: tsup, unbuild, raw esbuild, tsc only.

## Decision

Use tsup with ESM output format targeting Node 18+. tsup automatically detects and preserves shebangs, produces a single file bundle avoiding module resolution overhead at startup, and requires zero configuration beyond specifying the entry point.

## Consequences

### Positive

- Zero-config for the common case (single entry, ESM output)
- esbuild-backed — fast builds
- Automatic shebang preservation
- Output in `dist/` matches existing turbo.json build outputs
- Consistent with other npm CLI publishing patterns

### Negative

- Adds a dev dependency not used elsewhere in the monorepo
- Single-file bundle means source maps are needed for debugging
- Cannot use tsc-only approach (which other apps use) since CLI needs a shebang-aware bundler
