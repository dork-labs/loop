---
number: 21
title: Use localStorage for onboarding state instead of server-side tracking
status: draft
created: 2026-02-22
spec: ftue-onboarding
superseded-by: null
---

# 21. Use localStorage for onboarding state instead of server-side tracking

## Status

Draft (auto-extracted from spec: ftue-onboarding)

## Context

The FTUE onboarding flow needs to track whether the user has been welcomed and whether they've completed setup. This state determines which UI to show on the issues page (welcome modal, setup checklist, or normal table). The state could live server-side (new API endpoint + database column) or client-side (localStorage).

## Decision

Store onboarding state in browser localStorage with key `loop:onboarding` and shape `{ welcomed: boolean, completedAt: string | null }`. The "has issues" check is derived from live API data, not stored state. No new API endpoints or database changes are needed.

## Consequences

### Positive

- Zero backend changes required — frontend-only feature
- No database schema migration needed
- No new API endpoints to maintain or secure
- Instant reads (synchronous localStorage) with no network latency
- Users can reset onboarding by clearing localStorage (intentional escape hatch)

### Negative

- Onboarding state doesn't persist across browsers/devices
- No server-side analytics on onboarding completion rates
- If user clears browser data, they see the welcome modal again (minor annoyance if they already have issues — but celebration fires immediately)
