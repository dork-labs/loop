---
number: 33
title: Use ky as the SDK HTTP layer
status: draft
created: 2026-02-23
spec: typescript-sdk
superseded-by: null
---

# 33. Use ky as the SDK HTTP layer

## Status

Draft (auto-extracted from spec: typescript-sdk)

## Context

The SDK needs an HTTP client with retry logic, timeout handling, and request/response hooks. Options considered: native `fetch` with hand-written retry (~80 lines), `ky` (~4.7KB gzipped, built on fetch), or `axios` (heavier, different paradigm). The MCP server (`packages/mcp/src/client.ts`) and dashboard app (`apps/app/src/lib/api-client.ts`) already use `ky`.

## Decision

Use `ky` as the SDK's HTTP layer. It provides built-in retry with configurable status codes, timeout, request/response hooks for auth and error transformation, and JSON parsing — all in a single minimal dependency.

## Consequences

### Positive

- Consistent with existing packages (MCP server, dashboard app)
- Built-in retry, timeout, and hooks reduce boilerplate
- Tiny footprint (~4.7KB gzipped) acceptable for server-side SDK
- Can be swapped for native fetch later behind the same interface if needed

### Negative

- One runtime dependency (the spec targets "zero or minimal")
- Couples SDK to ky's API; a major ky version bump requires SDK updates
