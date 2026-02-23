---
number: 27
title: Use @hono/mcp for Streamable HTTP transport
status: proposed
created: 2026-02-22
spec: mcp-server
superseded-by: null
---

# 27. Use @hono/mcp for Streamable HTTP transport

## Status

Proposed

## Context

The MCP HTTP transport can be implemented manually using the SDK's `NodeStreamableHTTPServerTransport` with `fetch-to-node` bridging, or via the official `@hono/mcp` middleware which provides `StreamableHTTPTransport` with native Hono integration.

## Decision

Use `@hono/mcp` for the HTTP transport handler. It provides a `StreamableHTTPTransport` class that integrates directly with Hono's request/response model, avoiding the `fetch-to-node` conversion layer.

## Consequences

### Positive

- Cleaner integration with existing Hono server — no request/response bridging
- Less boilerplate code for transport setup
- Maintained by the Hono ecosystem team
- Supports OAuth auth router for future Phase 2 work

### Negative

- Additional dependency on `@hono/mcp` package
- Less control over transport internals than manual implementation
- Package maturity — relatively new middleware
