---
number: 35
title: Use native fetch for Connect CLI HTTP calls
status: draft
created: 2026-02-23
spec: connect-cli
superseded-by: null
---

# 35. Use native fetch for Connect CLI HTTP calls

## Status

Draft (auto-extracted from spec: connect-cli)

## Context

The Connect CLI makes exactly two HTTP calls: `GET /api/projects` (key validation + project listing) and optionally `POST /api/projects` (create project). The existing CLI and MCP server use `ky` as their HTTP client. However, the Connect CLI is distributed via `npx` where cold-start time and install size directly impact developer experience.

## Decision

Use Node 18+ built-in `fetch` instead of adding `ky` or another HTTP library as a runtime dependency. The Connect CLI's HTTP needs are minimal (two endpoints, simple JSON responses, Bearer auth header) and don't benefit from ky's retry logic or hooks. This keeps the published package dependency count at 1 (only `@clack/prompts`).

## Consequences

### Positive

- Smaller published package — faster `npx` cold-start
- One fewer runtime dependency to maintain
- Node 18+ `fetch` is stable and well-tested
- `engines: { "node": ">=18" }` is already the minimum for other reasons (parseArgs)

### Negative

- No built-in retry with exponential backoff (acceptable for a setup wizard — if the API is down, retrying won't help)
- Slightly more boilerplate for error handling compared to ky's typed HTTP errors
- Inconsistent with ky usage in other Loop packages (but this package has no shared code with them)
