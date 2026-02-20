---
number: 12
title: Use TanStack Router over React Router for the dashboard
status: draft
created: 2026-02-20
spec: mvp-phase-3-react-dashboard
superseded-by: null
---

# 12. Use TanStack Router over React Router for the dashboard

## Status

Draft (auto-extracted from spec: mvp-phase-3-react-dashboard)

## Context

The Loop dashboard needs a routing solution for 5 views with filter state management. The Issue List view requires typed URL search params (status, type, project, label, priority, page) that persist across navigation and are shareable as bookmarks. Two options were evaluated: TanStack Router v1 and React Router v7.

## Decision

Use TanStack Router v1 with the Vite file-based routing plugin. TanStack Router provides native Zod validation for search params via `@tanstack/zod-adapter`, making filter state management a one-liner. It also integrates natively with TanStack Query's `queryOptions()` for route-level prefetching. React Router v7's advanced type safety and search param management only work in "framework mode" (Remix-style SSR), not in the plain SPA library mode needed for Loop.

## Consequences

### Positive

- Fully typed search params with Zod validation out of the box
- File-based routing via Vite plugin reduces boilerplate
- Native `queryOptions` integration with TanStack Query for route-level data loading
- Pathless layout routes for shared dashboard chrome without URL impact

### Negative

- Smaller ecosystem compared to React Router
- Team members may be less familiar with TanStack Router API
- Requires `@tanstack/react-router-vite-plugin` dev dependency for code generation
