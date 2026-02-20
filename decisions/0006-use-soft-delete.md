---
number: 6
title: Use soft delete with deletedAt column for auditability
status: proposed
created: 2026-02-19
spec: data-layer-core-api
superseded-by: null
---

# 6. Use soft delete with deletedAt column for auditability

## Status

Proposed

## Context

Loop's litepaper emphasizes full auditability — every decision the system makes should be traceable. DELETE operations need to preserve data for audit trails while removing items from normal queries.

## Decision

Use soft delete with a `deleted_at` timestamptz column on all major entities (issues, projects, goals, labels, templates). All list queries filter out `deleted_at IS NOT NULL`. Join tables (IssueLabel) and relations use hard delete.

## Consequences

### Positive

- Full audit trail — deleted items can be recovered or inspected
- Referential integrity preserved (no orphaned foreign keys)
- Aligns with Loop's auditability principle
- Simple implementation via shared column helper

### Negative

- All queries must remember to filter `deleted_at IS NULL` (mitigated: centralized in query helpers)
- Database grows without bound unless periodic hard-delete cleanup is added
- Unique constraints need to account for soft-deleted rows (e.g., label names)
