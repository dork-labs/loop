---
number: 2
title: Deploy as two Vercel projects from one monorepo
status: proposed
created: 2026-02-18
spec: repo-cleanup-loop-setup
superseded-by: null
---

# 0002. Deploy as two Vercel projects from one monorepo

## Status

Proposed

## Context

Loop has two deployable frontends: a Next.js marketing site (`apps/web`) and a React + Vite dashboard app (`apps/app`). These need to be served at different domains (`www.looped.me` and `app.looped.me`). The Hono API (`apps/api`) may share a Vercel project with the app or be deployed separately.

## Decision

Create two separate Vercel projects from the same GitHub monorepo, each with a different Root Directory setting. The marketing site (`apps/web`) deploys to `www.looped.me` and the dashboard app (`apps/app`) deploys to `app.looped.me`. Vercel's native "skip unaffected projects" feature handles smart rebuild skipping.

## Consequences

### Positive

- Clean domain separation between marketing and product
- Independent deployment cycles — marketing changes don't redeploy the app
- Vercel natively supports this pattern with no special configuration
- Each project can have its own environment variables and settings

### Negative

- Two Vercel projects to manage instead of one
- Preview deployments need `relatedProjects` config to wire together
- Slightly more complex initial setup
