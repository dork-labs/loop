---
number: 4
title: Use Drizzle ORM for database access
status: proposed
created: 2026-02-19
spec: data-layer-core-api
superseded-by: null
---

# 4. Use Drizzle ORM for database access

## Status

Proposed

## Context

Loop needs a type-safe way to interact with PostgreSQL. Options considered: Drizzle ORM, Prisma, Kysely, raw SQL. The API uses TypeScript and deploys to Vercel Functions.

## Decision

Use Drizzle ORM with schema defined in TypeScript files organized by domain group (`issues.ts`, `projects.ts`, `signals.ts`, `prompts.ts`). Use `drizzle-kit generate` for versioned SQL migrations applied programmatically at build time.

## Consequences

### Positive

- Type-safe schema definitions and queries with zero runtime overhead
- SQL-like API that maps directly to Postgres operations (no ORM magic)
- First-class support for `pgEnum`, JSONB with `.$type<T>()`, and all Postgres features
- Lightweight — no query engine runtime, just SQL generation
- Excellent Neon integration via `drizzle-orm/neon-http` and `drizzle-orm/neon-serverless`

### Negative

- Newer ecosystem compared to Prisma (smaller community, fewer tutorials)
- Schema splitting across packages has known TypeScript issues (mitigated: schema stays within `apps/api`)
- Migration tooling is less mature than Prisma Migrate
