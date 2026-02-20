---
number: 7
title: Use PGLite for test database instead of Docker
status: proposed
created: 2026-02-19
spec: data-layer-core-api
superseded-by: null
---

# 7. Use PGLite for test database instead of Docker

## Status

Proposed

## Context

Tests need a real PostgreSQL database to validate schema constraints, enums, JSONB operations, and indexes. Options: Docker Compose with Postgres, PGLite (WASM Postgres in-process), mocks/stubs, real Neon database.

## Decision

Use PGLite (`@electric-sql/pglite`) for all unit and integration tests. Each test file gets a fresh in-memory database with schema applied via Drizzle. Schema is wiped between tests using `DROP SCHEMA public CASCADE`.

## Consequences

### Positive

- Zero external dependencies (no Docker, no network, no database server)
- Fast — in-memory WASM Postgres with no I/O overhead
- Full SQL fidelity — real Postgres constraints, enums, indexes, JSONB
- Each test file is completely isolated
- Works in CI without Docker-in-Docker

### Negative

- PGLite doesn't support all Postgres extensions (not needed for Loop's schema)
- Slight behavioral differences from production Neon (mitigated: same SQL dialect)
- WASM startup has ~200ms overhead per test file
