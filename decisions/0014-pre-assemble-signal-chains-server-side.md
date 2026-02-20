---
number: 14
title: Pre-assemble signal chains server-side for Loop Activity view
status: proposed
created: 2026-02-20
spec: mvp-phase-3-react-dashboard
superseded-by: null
---

# 14. Pre-assemble signal chains server-side for Loop Activity view

## Status

Proposed

## Context

The Loop Activity view displays "signal chains" — linked groups of issues showing the progression from signal to hypothesis to tasks to outcome. Two approaches were considered: (A) the API returns pre-assembled chains by walking parent/child and relation links, or (B) the API returns recent issues and the frontend groups them by `parentId`.

## Decision

Pre-assemble chains server-side in the `GET /api/dashboard/activity` endpoint. The API queries root issues (parentId IS NULL), then fetches children and relations for each root, assembling complete chain objects. This runs 1 + N queries (N = chain count, default 20).

## Consequences

### Positive

- Simpler frontend code — receives ready-to-render chain objects
- Chain assembly logic is centralized and testable in the API
- Reduces number of separate API calls from the frontend
- Frontend doesn't need to understand the parent/child hierarchy traversal logic

### Negative

- 1 + N query pattern (21 queries for 20 chains) — acceptable for MVP but may need CTE optimization later
- API endpoint is more complex than a simple list query
- Chain depth is limited to 1 level (matches the existing schema constraint)
