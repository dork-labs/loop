---
number: 1
title: Use Hono over Express for the Loop API
status: proposed
created: 2026-02-18
spec: repo-cleanup-loop-setup
superseded-by: null
---

# 0001. Use Hono over Express for the Loop API

## Status

Proposed

## Context

Loop needs an HTTP API framework for its REST endpoints (issue CRUD, signal ingestion, dispatch, prompt templates). The DorkOS codebase used Express, but the Loop MVP spec explicitly chose Hono. The API will be deployed to Vercel as serverless functions.

## Decision

Use Hono as the API framework for Loop. Hono is TypeScript-native, uses Web Standard Request/Response objects, and deploys to Vercel with zero configuration. It bundles at ~14KB vs Express's ~57KB and automatically gets Fluid Compute features (in-function concurrency, bytecode caching).

## Consequences

### Positive

- Zero-config Vercel deployment — just `export default app`
- Native TypeScript with excellent type inference
- Web Standards portability — code runs on Vercel, Cloudflare, Deno, Bun, or Node without changes
- Smaller bundle size (~14KB vs ~57KB)
- Aligns with the Loop MVP specification

### Negative

- Smaller middleware ecosystem than Express
- Team may need to learn Hono's API (though it's very similar to Express)
- No WebSocket support on Vercel (SSE works but with timeout limits)
