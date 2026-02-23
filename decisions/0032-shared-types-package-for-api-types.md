---
number: 32
title: Use shared packages/types for API type definitions
status: proposed
created: 2026-02-23
spec: typescript-sdk
superseded-by: null
---

# 32. Use shared packages/types for API type definitions

## Status

Proposed

## Context

Loop's API types are currently duplicated across three consumers: the dashboard app (`apps/app/src/types/`), the MCP server (`packages/mcp`), and now the SDK. Each consumer re-defines the same interfaces, creating drift risk when the API changes. The API itself defines types via Zod schemas in route files and Drizzle schemas in `apps/api/src/db/schema/`.

## Decision

Create `@dork-labs/loop-types` (`packages/types`) as a standalone package containing Zod schemas and inferred TypeScript types for all API request/response shapes. This becomes the single source of truth. The SDK, MCP server, and dashboard app all import types from this package.

## Consequences

### Positive

- Single source of truth — types cannot drift between consumers
- TypeScript compiler enforces consistency when schemas change
- Enables optional runtime response validation in the SDK
- Zod dependency is already in the ecosystem

### Negative

- Requires extracting inline Zod schemas from API route files
- Adds a Zod dependency to all consumers (though it's already present)
- More upfront monorepo plumbing to set up the package
