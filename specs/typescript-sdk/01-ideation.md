---
slug: typescript-sdk
number: 13
created: 2026-02-23
status: ideation
---

# TypeScript SDK

**Slug:** typescript-sdk
**Author:** Claude Code
**Date:** 2026-02-23
**Related:** [Agent Integration Strategy](../agent-integration-strategy.md) (Feature 4)

---

## 1) Intent & Assumptions

- **Task brief:** Build a thin, idiomatic TypeScript SDK wrapping Loop's REST API. Follow the Stripe/OpenAI pattern — class-based client with resource namespacing (`loop.issues.list()`, `loop.dispatch.next()`). Published as `@dork-labs/loop-sdk`. Full TypeScript types, retry with exponential backoff, async generator pagination, idempotency key support, structured errors.

- **Assumptions:**
  - The API surface is stable enough for a hand-written SDK (no rapid endpoint churn)
  - Node.js is the primary target (browser bundle is future work)
  - `ky` is an acceptable dependency (already used in `packages/mcp` and `apps/app`)
  - Types will live in a shared `packages/types` package extracted from API Zod schemas
  - The SDK will be consumed by the Loop CLI (Feature 6), MCP server (refactor), and external developers/agents

- **Out of scope:**
  - Agent-specific toolkit (`@loop/agent-toolkit`)
  - CLI tool (Feature 6 — built on top of this SDK)
  - MCP server (Feature 2 — already shipped, will refactor to use SDK later)
  - Auto-generation via Stainless/Fern (evaluated and rejected — API is too small to justify)
  - Python/Go SDKs
  - Browser bundle
  - OAuth/session authentication

---

## 2) Pre-reading Log

- `apps/api/src/app.ts`: Main Hono app — registers all route modules, CORS middleware, auth middleware on `/api/*`, error handler for HTTPException/ZodError/unknown. Also serves OpenAPI spec at `/api/openapi.json` and MCP transport at `/mcp`.
- `apps/api/src/routes/issues.ts`: Full issues CRUD — list (filterable by status, type, projectId, labelId, priority, parentId), create (with optional labelIds, 1-level hierarchy enforcement, hypothesis JSONB), get (with parent/children/labels/relations), update, soft-delete. Pagination via limit/offset.
- `apps/api/src/routes/dispatch.ts`: Loop's unique dispatch endpoint — `GET /api/dispatch/next` atomically claims highest-priority unblocked issue with `FOR UPDATE SKIP LOCKED`. Also `GET /api/dispatch/queue` for previewing the work queue.
- `apps/api/src/routes/projects.ts`: Projects CRUD with optional goal, issue counts by status on get.
- `apps/api/src/routes/goals.ts`: Goals CRUD — measurable success indicators with metric/targetValue/currentValue/unit.
- `apps/api/src/routes/labels.ts`: Labels CRUD with unique name constraint.
- `apps/api/src/routes/signals.ts`: Signal ingestion — atomically creates signal + linked triage issue.
- `apps/api/src/routes/templates.ts`: Prompt templates with versioning, promotion, and preview hydration for dispatch.
- `apps/api/src/routes/prompt-reviews.ts`: Agent/human quality feedback with EWMA scoring.
- `apps/api/src/routes/comments.ts`: Threaded comments on issues.
- `apps/api/src/routes/relations.ts`: Issue relations (blocks, blocked_by, related, duplicate).
- `apps/api/src/routes/dashboard.ts`: System health metrics, activity timeline, prompt health.
- `apps/api/src/db/schema/issues.ts`: Issue types (signal/hypothesis/plan/task/monitor), statuses (triage/backlog/todo/in_progress/done/canceled), JSONB fields for hypothesis data, commits, PRs.
- `apps/api/src/db/schema/projects.ts`: Project statuses (backlog/planned/active/paused/completed/canceled), health (on_track/at_risk/off_track), goals with metric tracking.
- `apps/api/src/db/schema/prompts.ts`: Template conditions JSONB, version statuses (draft/active/retired), EWMA review scores.
- `apps/api/src/db/schema/signals.ts`: Signal severity (low/medium/high/critical), JSONB payload, GIN index.
- `apps/api/src/db/schema/_helpers.ts`: Shared column helpers — CUID2 IDs, timestamps, soft delete.
- `apps/api/src/middleware/auth.ts`: Bearer token validation via timing-safe comparison.
- `apps/app/src/lib/api-client.ts`: Existing ky-based consumer — per-resource API objects with simple method patterns.
- `apps/app/src/types/`: Client-side type mirrors for issues, projects, prompts, dashboard, signals.
- `packages/mcp/src/client.ts`: Existing ky wrapper with retry config (limit: 2, statusCodes: [429, 500, 503]).
- `packages/mcp/package.json`: Package structure reference — tsup build, @dork-labs scope.
- `research/20260222_sdk_cli_api_interaction_layers.md`: Prior research on SDK patterns from Stripe, OpenAI, Neon, Linear.

---

## 3) Codebase Map

**Primary Components/Modules:**

| File | Role |
|------|------|
| `apps/api/src/routes/*.ts` (13 modules) | Define the full API surface — request/response Zod schemas, route handlers |
| `apps/api/src/db/schema/*.ts` (5 files) | Database schema with enums, JSONB types, column helpers |
| `apps/api/src/middleware/auth.ts` | Bearer token auth pattern |
| `apps/app/src/lib/api-client.ts` | Existing ky-based API consumer (reference pattern) |
| `apps/app/src/types/*.ts` | Client-side type definitions (will be replaced by shared types) |
| `packages/mcp/src/client.ts` | Existing ky wrapper with retry (will be refactored to use SDK) |

**Shared Dependencies:**

- `ky` v1.14+ — HTTP client used in MCP server and dashboard app
- `zod` — Validation schemas in API routes (source of truth for types)
- `tsup` — Build tool used by MCP package
- Turborepo workspace config for `packages/*`

**Data Flow:**

```
SDK Consumer (agent/CLI/app)
  → LoopClient.resource.method(params)
    → ky request with Bearer auth + retry
      → Loop API /api/* endpoints
        → Zod validation → Drizzle → PostgreSQL
      ← JSON response { data: T } or { data: T[], total: number }
    ← Typed response or LoopError
```

**Feature Flags/Config:**

- API key format: `loop_` prefix (ADR#23)
- Default pagination: limit 50, offset 0, max 200
- Retry: 2 retries on 429/500/503
- Base URL: `http://localhost:5667` (dev), `https://api.looped.me` (prod)

**Potential Blast Radius:**

- **New packages:** `packages/sdk` (the SDK), `packages/types` (shared Zod types)
- **Refactor later:** `packages/mcp/src/client.ts` → import from SDK's HTTP layer
- **Refactor later:** `apps/app/src/types/` → import from `packages/types`
- **Refactor later:** `apps/app/src/lib/api-client.ts` → potentially use SDK
- **Config:** `tsconfig.json` (add project references), `turbo.json` (add build tasks)

---

## 4) Root Cause Analysis

N/A — this is a new feature, not a bug fix.

---

## 5) Research

### Potential Solutions

**1. Hand-Written SDK (RECOMMENDED)**

Write all resource classes, types, HTTP logic, retry, and pagination manually. Follow Stripe/OpenAI class-based pattern.

- **Pros:** Full ergonomic control; `dispatch.next()` purpose-built; consistent with existing packages; no generation toolchain; ships fast (2-3 days)
- **Cons:** Must manually update when API changes; risk of type drift without integration tests
- **Complexity:** Low-Medium
- **Maintenance:** Medium

**2. Generated from OpenAPI Spec**

Use `hey-api/openapi-ts` or Fern to generate types and client from `/api/openapi.json`.

- **Pros:** Types auto-propagate on generation; `hey-api` can also generate TanStack Query hooks
- **Cons:** `dispatch.next()` won't be modeled correctly; requires CI generation pipeline; OpenAPI spec completeness unverified
- **Complexity:** Medium (setup + CI + custom wrappers)
- **Maintenance:** Low for types, Medium for custom behaviors

**3. Hybrid — Hand-Written Client, Shared Zod Types**

Write client by hand; extract types from shared `packages/types` Zod schemas.

- **Pros:** Zod is single source of truth; compiler enforces consistency; enables runtime validation
- **Cons:** Requires creating `packages/types` and extracting inline schemas from API; more upfront plumbing
- **Complexity:** Medium
- **Maintenance:** Low

### Security Considerations

- Scrub `Authorization` header from all error objects and logged output
- Never add key-in-URL fallback (API already uses Bearer tokens correctly)
- Use `crypto.randomUUID()` for auto-generated idempotency keys
- Warn if `baseURL` uses `http://` in non-localhost contexts
- Document that browser use exposes the API key client-side

### Performance Considerations

- `ky` is ~4.7KB gzipped — acceptable for server-side SDK
- Default 2 retries with 500ms initial delay = worst-case ~3s added latency
- Do not expose `listAll()` on signals (unbounded data) — prefer `iter()` async generator
- 30s default timeout (matching OpenAI SDK default), per-request override

### Recommendation

**Hand-written SDK with shared Zod types package.** This is a hybrid of approaches 1 and 3:
- Hand-write the client class structure, resource methods, retry logic, and pagination
- Extract types into `packages/types` from API Zod schemas (user's preference for shared types)
- Ship `dispatch.next()` as a first-class method — Loop's core differentiator
- The API surface is small (~10 namespaces) — generation tooling adds more overhead than it saves

---

## 6) Clarifications & Decisions

1. **Package name:** `@dork-labs/loop-sdk` — The `@loop` npm org is owned by someone else. `@dork-labs/` is consistent with existing packages (`@dork-labs/loop-mcp`, `@dork-labs/looped`).

2. **HTTP layer:** `ky` — Already used in `packages/mcp` and `apps/app`. ~4.7KB gzipped. Built-in retry, hooks, timeout. One small dependency is acceptable.

3. **Pagination:** Include both `.list()` (returns a page) and `.iter()` (async generator that auto-fetches pages). Stripe pattern. Great DX for agents consuming large result sets.

4. **Type sharing:** Create shared `packages/types` package with Zod schemas extracted from the API. Single source of truth, compiler-enforced consistency. More upfront work but prevents type drift across SDK, MCP, and dashboard app.

- **Open questions:** None
