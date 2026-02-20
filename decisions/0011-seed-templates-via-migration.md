---
number: 11
title: Seed default prompt templates via custom Drizzle migration
status: proposed
created: 2026-02-20
spec: prompt-dispatch-engine
superseded-by: null
---

# 11. Seed default prompt templates via custom Drizzle migration

## Status

Proposed

## Context

Loop ships with 5 default prompt templates (one per issue type). These must exist in any deployment without manual setup. Options considered: application startup seeding (race conditions in serverless — multiple Vercel Functions cold-starting simultaneously), separate `db:seed` script (extra command to remember, not part of migration flow), custom Drizzle migration with `ON CONFLICT DO NOTHING` (runs as part of normal `db:migrate`, idempotent, version-controlled).

## Decision

Use a custom Drizzle migration (`npx drizzle-kit generate --custom`) with `INSERT ... ON CONFLICT DO NOTHING` SQL. Templates use stable hard-coded IDs (e.g., `tpl_default_signal_triage`) rather than CUID2-generated IDs. The migration runs as part of the standard `npm run db:migrate` flow.

## Consequences

### Positive

- Runs as part of existing migration flow — zero extra tooling or commands
- Idempotent — safe to run multiple times, `ON CONFLICT DO NOTHING` skips existing rows
- Version-controlled alongside schema — tracked in git
- Works in CI/CD pipelines automatically
- No race conditions — migrations run once, not per-instance

### Negative

- Hard-coded IDs required for system defaults (acceptable for system-managed data, not for user data)
- Template content updates require a new migration (not a simple DB edit)
- SQL escaping of Handlebars template content (single quotes, backslashes) adds complexity to the migration file
