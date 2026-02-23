---
number: 22
title: Use TanStack Query polling over SSE for first-event detection
status: draft
created: 2026-02-22
spec: ftue-onboarding
superseded-by: null
---

# 22. Use TanStack Query polling over SSE for first-event detection

## Status

Draft (auto-extracted from spec: ftue-onboarding)

## Context

The FTUE onboarding needs to detect when the first issue arrives via the API. This requires some form of real-time or near-real-time notification. Options considered: TanStack Query `refetchInterval` polling (every 3 seconds), Server-Sent Events (SSE), or WebSockets. The app already uses TanStack Query for all data fetching, and the dashboard activity query already uses `refetchInterval: 15_000` as a precedent.

## Decision

Use TanStack Query's `refetchInterval` as a function to poll the existing `GET /api/issues` endpoint every 3 seconds. Stop polling once data arrives. No new server infrastructure (SSE endpoint, WebSocket server) is needed.

## Consequences

### Positive

- Zero server-side changes — uses existing API endpoint
- Consistent with existing dashboard polling pattern (`dashboardActivityOptions` already polls at 15s)
- No new infrastructure to deploy, monitor, or maintain
- Built-in retry, error handling, and caching from TanStack Query
- Automatically stops when data arrives (function-based refetchInterval)

### Negative

- 3-second detection latency (vs. near-instant with SSE/WebSocket)
- Slightly more network requests during the waiting period (~20 requests/minute)
- If SSE or WebSocket is added later for other features, this would be redundant
