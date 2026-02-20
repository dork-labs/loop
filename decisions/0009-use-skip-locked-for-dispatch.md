---
number: 9
title: Use FOR UPDATE SKIP LOCKED for atomic dispatch claiming
status: proposed
created: 2026-02-20
spec: prompt-dispatch-engine
superseded-by: null
---

# 9. Use FOR UPDATE SKIP LOCKED for atomic dispatch claiming

## Status

Proposed

## Context

The dispatch endpoint (`GET /api/dispatch/next`) must atomically claim the highest-priority issue, preventing two agents from being assigned the same work. This is a classic queue problem. Options considered: PostgreSQL advisory locks (leak risk in connection-pooled/serverless environments), optimistic locking with version column (retry storms under contention), `SELECT ... FOR UPDATE SKIP LOCKED` (industry standard for queue-like tables).

## Decision

Use `SELECT ... FOR UPDATE SKIP LOCKED` inside a `db.transaction()` call. The query selects the highest-scoring unblocked todo issue and atomically updates its status to `in_progress`. Locked rows (being claimed by another concurrent request) are silently skipped. Implemented via raw SQL (`db.execute(sql\`...\`)`) since Drizzle's query builder does not natively support `FOR UPDATE SKIP LOCKED`.

## Consequences

### Positive

- Zero deadlocks — skipping is non-blocking
- Atomic claim — impossible to double-dispatch
- No retry storms — workers move to next available issue
- Industry standard — same pattern used by Solid Queue (37signals), PG Boss, Graphile Worker
- Works with Neon serverless PostgreSQL

### Negative

- Requires raw SQL since Drizzle doesn't support this natively — slightly less type-safe
- PGlite (test DB) runs in a single process, so concurrent lock contention can't be fully tested — locking correctness is trusted to PostgreSQL's implementation
- Requires understanding of PostgreSQL locking semantics for maintenance
