---
number: 13
title: Use ky over Axios as the frontend HTTP client
status: draft
created: 2026-02-20
spec: mvp-phase-3-react-dashboard
superseded-by: null
---

# 13. Use ky over Axios as the frontend HTTP client

## Status

Draft (auto-extracted from spec: mvp-phase-3-react-dashboard)

## Context

The dashboard needs an HTTP client to communicate with the Loop API. Three options were considered: raw `fetch`, `ky` (4KB), and Axios (14KB). All API calls follow a consistent pattern: prefixed URL, Bearer token auth header, JSON responses.

## Decision

Use `ky` as a thin typed wrapper over the native `fetch` API. It provides `prefixUrl` for base URL configuration, hooks for auth header injection, `searchParams` for URL encoding, and `.json<T>()` for typed responses — all in 4KB gzipped (vs Axios at 14KB).

## Consequences

### Positive

- 4KB gzipped (3.5x smaller than Axios)
- Built on native `fetch` (Web Standards, no XHR polyfill)
- `prefixUrl` and hooks cleanly handle auth and base URL
- `.json<T>()` provides typed response parsing

### Negative

- Less familiar to developers who know Axios
- Smaller ecosystem of interceptor plugins compared to Axios
- No built-in request cancellation helpers (use native `AbortController`)
