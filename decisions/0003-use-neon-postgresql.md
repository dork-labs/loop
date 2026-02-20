---
number: 3
title: Use Neon PostgreSQL as the database provider
status: proposed
created: 2026-02-19
spec: data-layer-core-api
superseded-by: null
---

# 3. Use Neon PostgreSQL as the database provider

## Status

Proposed

## Context

Loop needs a PostgreSQL database that works well with Vercel Functions (serverless). The API deploys as Vercel Functions, which have short-lived execution contexts that make traditional connection pooling problematic. We evaluated Neon, Supabase, and self-hosted Docker.

## Decision

Use Neon PostgreSQL with the `@neondatabase/serverless` driver. Use the HTTP driver for simple CRUD operations and the WebSocket/Pool driver for multi-table transactions (signal ingestion).

## Consequences

### Positive

- Serverless-first architecture with purpose-built driver for Vercel Functions
- Powers Vercel Postgres natively (Neon under the hood)
- Database branching for preview/staging environments
- Free tier sufficient for MVP development (191.9 compute-hours/month)
- Compute scales to zero when idle — cost-effective for MVP

### Negative

- Vendor dependency on Neon (mitigated: standard Postgres, can migrate to any Postgres host)
- HTTP driver cannot do interactive transactions (need Pool/WS driver for those)
- Relatively new service compared to self-hosted Postgres
