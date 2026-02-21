---
number: 19
title: Use conditional driver swap for local PostgreSQL development
status: draft
created: 2026-02-21
spec: dev-setup-dx
superseded-by: null
---

# 0019. Use conditional driver swap for local PostgreSQL development

## Status

Draft (auto-extracted from spec: dev-setup-dx)

## Context

The Loop API uses `@neondatabase/serverless` which speaks Neon's HTTP-over-WebSocket protocol, not standard libpq. This driver cannot connect to a plain Docker PostgreSQL container, blocking local development without a Neon account. Three approaches were considered: (1) conditional driver swap using NODE_ENV gate, (2) Neon HTTP proxy via Docker (`timowilhelm/local-neon-http-proxy`), and (3) cloud-only development using Neon branching.

## Decision

Use a `NODE_ENV === 'production'` gate in `apps/api/src/db/index.ts` with top-level `await` and dynamic `import()` to switch between `drizzle-orm/neon-http` (production) and `drizzle-orm/node-postgres` (local development). The `pg` package is added as a devDependency only. Both drivers expose the same Drizzle ORM query API, making the swap transparent to application code.

## Consequences

### Positive

- Local development works offline with a standard Docker PostgreSQL
- Zero configuration needed — `cp .env.example .env` works immediately
- Simple implementation (~15 lines of conditional logic)
- `pg` is devDependency only — not shipped to production
- Tests unaffected — PGlite path is completely independent

### Negative

- Local development does not exercise the exact Neon code path
- Two driver types in the codebase (union type `NeonHttpDatabase | NodePgDatabase`)
- If Drizzle ORM adapters diverge in behavior, local dev may not catch production-only issues
