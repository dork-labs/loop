---
number: 25
title: Use dual-transport single package for MCP server
status: proposed
created: 2026-02-22
spec: mcp-server
superseded-by: null
---

# 25. Use dual-transport single package for MCP server

## Status

Proposed

## Context

Loop needs an MCP server to let AI agents interact natively. The server could be structured as separate packages for each transport (stdio and HTTP), as an HTTP-only deployment, or as a single package with multiple entry points.

## Decision

Use a single package at `packages/mcp/` with two entry points: `src/stdio.ts` for local/npx usage and `src/http.ts` as a Hono route handler mountable on the existing API. Both share one `createLoopMcpServer(config)` factory and the same tool implementations.

## Consequences

### Positive

- One codebase, two distribution methods — no code duplication
- Consistent behavior across both transports
- Single source of truth for tool implementations and types
- stdio works immediately for local dev; HTTP shares existing deployment infrastructure

### Negative

- Slightly more complex build setup (tsup with multiple entry points)
- Hono becomes an optional peer dependency
