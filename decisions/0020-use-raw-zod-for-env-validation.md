---
number: 20
title: Use raw Zod safeParse for environment variable validation
status: draft
created: 2026-02-21
spec: dev-setup-dx
superseded-by: null
---

# 0020. Use raw Zod safeParse for environment variable validation

## Status

Draft (auto-extracted from spec: dev-setup-dx)

## Context

Environment variables across all three apps (API, Dashboard, Web) are accessed via raw `process.env` / `import.meta.env` with no validation. Missing or misspelled variables produce cryptic runtime errors. Libraries evaluated: t3-env (~497k weekly downloads, client/server boundary enforcement), envalid (~447k, good defaults), znv (<5k, Zod wrapper), and raw Zod (already installed in all apps).

## Decision

Use Zod's `safeParse` directly to validate environment variables at startup. Each app gets one `env.ts` file (~25 lines) that validates `process.env` (or `import.meta.env` for Vite) and exports a typed `env` object. No new dependencies — Zod v4 is already in `apps/api` and `apps/web`, Zod v3 in `apps/app`. On validation failure, formatted error messages are printed and the process exits.

## Consequences

### Positive

- Zero new dependencies — Zod is already paid for in all apps
- ~25 lines per app — simple to understand and maintain
- Type-safe env access throughout the codebase
- Clear, formatted error messages on missing/invalid variables
- Works identically with both Zod v3 and v4

### Negative

- No client/server boundary enforcement (t3-env's main feature) — mitigated because API and Dashboard are separate apps
- Manual pattern — each app maintains its own schema independently
- No runtime coercion of complex types beyond what Zod provides
