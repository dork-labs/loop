---
number: 18
title: Use @asteasolutions/zod-to-openapi for API documentation generation
status: draft
created: 2026-02-20
spec: docs-update-post-mvp
superseded-by: null
---

# 18. Use @asteasolutions/zod-to-openapi for API documentation generation

## Status

Draft (auto-extracted from spec: docs-update-post-mvp)

## Context

Loop's API has ~40 endpoints with Zod validation via `@hono/zod-validator`. The documentation site uses Fumadocs with `fumadocs-openapi` already installed, which can auto-generate interactive API reference pages from an OpenAPI spec — but no spec exists yet. Three approaches were considered: hand-writing OpenAPI YAML, retrofitting routes with `@hono/zod-openapi`, or using a standalone Zod-to-OpenAPI registry (the DorkOS pattern).

## Decision

Use `@asteasolutions/zod-to-openapi` with a centralized registry pattern. Define standalone Zod schemas with `.openapi()` extensions, register each endpoint via `registry.registerPath()`, and generate an OpenAPI 3.1.0 spec via `OpenApiGeneratorV31`. The spec is exported to `docs/api/openapi.json` by a build script, then `fumadocs-openapi` auto-generates the MDX reference pages. This replicates the proven pattern from the DorkOS codebase.

## Consequences

### Positive

- Type-safe: Zod schemas are the single source of truth for both validation and OpenAPI types
- No route retrofitting needed — the registry is a parallel declaration, not a replacement of existing routes
- Auto-generated API docs with interactive playground (via fumadocs-openapi)
- Proven pattern already working in DorkOS
- Testable: spec structure can be validated in unit tests

### Negative

- Endpoint declarations are duplicated (once in routes, once in registry) — they can drift
- Adding new endpoints requires updating both the route file and the registry
- ~40 endpoints to register upfront (one-time effort)
