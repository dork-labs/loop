---
number: 31
title: Use hand-written SDK over auto-generation
status: draft
created: 2026-02-23
spec: typescript-sdk
superseded-by: null
---

# 31. Use hand-written SDK over auto-generation

## Status

Draft (auto-extracted from spec: typescript-sdk)

## Context

Loop needs a TypeScript SDK wrapping its REST API. Three approaches were evaluated: hand-written, auto-generated from OpenAPI spec (via hey-api/Stainless/Fern), and a hybrid using shared Zod types. The API surface is small (~10 resource namespaces, ~35 methods) and includes `dispatch.next()` — a non-standard endpoint that returns an atomically-claimed issue with hydrated prompt instructions.

## Decision

Hand-write the SDK client classes and methods. Use a shared Zod types package (`packages/types`) for type definitions, but write the HTTP layer, resource classes, error handling, retry logic, and pagination manually rather than generating them.

## Consequences

### Positive

- Full control over `dispatch.next()` ergonomics — Loop's core differentiator
- No generation toolchain to set up, maintain, or run in CI
- Consistent with existing `packages/mcp` patterns
- Ships faster than setting up a generator pipeline for a small API

### Negative

- Must manually update SDK when API endpoints change
- Risk of type drift between API and SDK (mitigated by shared types package)
- Future API growth may eventually justify switching to generation
