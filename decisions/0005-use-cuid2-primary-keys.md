---
number: 5
title: Use CUID2 text primary keys for all entities
status: proposed
created: 2026-02-19
spec: data-layer-core-api
superseded-by: null
---

# 5. Use CUID2 text primary keys for all entities

## Status

Proposed

## Context

Loop entities need primary keys that are URL-safe, non-sequential (prevent enumeration attacks), and globally unique. Options: UUID v4, CUID2, auto-increment integer, nanoid.

## Decision

Use CUID2 text primary keys via `@paralleldrive/cuid2` for all entities. Issues additionally have an auto-incrementing `number` serial column for human-friendly references.

## Consequences

### Positive

- URL-safe (no encoding needed in API paths)
- Non-sequential (prevents ID enumeration)
- Collision-resistant and globally unique
- Shorter than UUID (24 chars vs 36)
- Can be generated client-side or server-side

### Negative

- Text primary keys are slightly less performant than integer PKs for joins and indexes
- Requires an additional library (`@paralleldrive/cuid2`)
- The `number` column adds a second identifier to reason about for issues
