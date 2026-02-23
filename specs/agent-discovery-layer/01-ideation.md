---
slug: agent-discovery-layer
number: 12
created: 2026-02-22
status: ideation
---

# Agent Discovery Layer

**Slug:** agent-discovery-layer
**Author:** Claude Code
**Date:** 2026-02-22
**Branch:** preflight/agent-discovery-layer
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** Build five discovery artifacts that let any AI agent autonomously discover Loop and understand how to use it: llms.txt endpoint, Agent Skill (SKILL.md), AGENTS.md snippet, Cursor rules file, and OpenHands microagent.

- **Assumptions:**
  - The marketing site (apps/web/, Next.js 16 + Fumadocs) will serve the llms.txt endpoint at www.looped.me/llms.txt
  - The SKILL.md will live in `packages/loop-skill/` as a publishable npm package (`@dork-labs/loop`)
  - AGENTS.md, loop.mdc, and OpenHands microagent are template files shipped in `packages/loop-skill/templates/` for the setup CLI (Feature 5) to copy into user repos
  - Loop's own repo will also receive these files as dogfooding
  - The dispatch endpoint is being built as part of the MCP Server (Feature 2) — discovery artifacts will reference it but don't depend on it existing yet
  - All artifacts reference the same auth pattern: `Authorization: Bearer <LOOP_API_KEY>`
  - The `loop_` key prefix from Feature 1 (API Key DX) is assumed
  - The SKILL.md is both user-invocable (`/loop-dispatch`) and auto-invocable by Claude

- **Out of scope:**
  - MCP server implementation (Feature 2)
  - Setup CLI that auto-writes files (Feature 5)
  - TypeScript SDK (Feature 4)
  - Dashboard changes
  - Marketing site redesign (Feature 8)
  - Documentation site updates (Feature 7)

---

## 2) Pre-reading Log

- `CLAUDE.md`: Complete project context — monorepo structure, API endpoints, tech stack, env vars. The API endpoint reference is the authoritative source for all discovery artifact content.
- `apps/web/src/app/api/search/route.ts`: Existing Next.js API route pattern — shows how to create route handlers in the web app.
- `apps/web/src/app/(marketing)/page.tsx`: Marketing homepage — shows the Next.js App Router structure used for pages.
- `apps/web/public/`: Static file directory — currently only images. Could host llms.txt as a static file.
- `apps/web/next.config.ts`: Next.js configuration — needed to understand if rewrites are configured.
- `apps/api/src/app.ts`: Main Hono app — shows route mounting pattern, CORS config, auth middleware.
- `apps/api/src/routes/openapi.ts`: Existing machine-readable endpoint pattern (OpenAPI spec).
- `.claude/skills/`: 12 existing skills following agentskills.io format — proven pattern to follow.
- `.mcp.json`: Current MCP server configuration (context7, playwright, shadcn).
- `research/20260222_ai_agent_tool_discovery_onboarding.md`: Comprehensive research on SKILL.md, AGENTS.md, llms.txt, Cursor rules, OpenHands patterns. The primary research source for this feature.
- `research/20260222_loop_developer_onboarding.md`: Vibe coder personas, llms.txt patterns, one-command setup patterns.
- `specs/mcp-server/`: MCP server spec — defines the tool surface that the SKILL.md will reference.
- `specs/api-key-dx/`: API Key DX spec — defines the `loop_` prefix format used in auth examples.

---

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/web/` — Next.js 16 marketing site where llms.txt will be served
- `apps/web/src/app/api/` — API route directory for the llms.txt route handler
- `apps/web/public/` — Static file serving (alternative llms.txt location)
- `apps/api/src/app.ts` — Hono API (reference for endpoint documentation in artifacts)
- `apps/api/src/routes/openapi.ts` — Existing OpenAPI endpoint (similar machine-readable pattern)
- `.claude/skills/` — 12 existing skills (pattern reference for SKILL.md format)
- `docs/` — Fumadocs MDX content (linked from llms.txt)

**Shared Dependencies:**

- Auth pattern: `Authorization: Bearer <LOOP_API_KEY>` (used across all 5 artifacts)
- API base URL: `https://app.looped.me` (production) / `http://localhost:5667` (dev)
- Core API endpoints referenced by all artifacts: issues CRUD, signals ingest, dispatch next
- `loop_` key prefix (from Feature 1: API Key DX)

**Data Flow:**

```
Agent discovers Loop via:
  llms.txt (web browsing) → fetches doc pages → understands API surface
  SKILL.md (installed via openskills) → has workflow instructions in context
  AGENTS.md (in user's repo) → has auth + common ops in context
  loop.mdc (Cursor rules) → auto-attaches when working with Loop files
  OpenHands microagent (keyword trigger) → injects Loop knowledge on mention

All paths converge on:
  Agent → HTTP calls to Loop API → Issues/Signals/Dispatch endpoints
```

**Feature Flags/Config:** None identified.

**Potential Blast Radius:**

- Direct: 1 existing file (apps/web/ route addition), 8+ new files
- Indirect: Future features (5, 7, 8, 9) depend on these artifacts existing
- Tests: No existing tests affected; new route handler should have a test

---

## 4) Root Cause Analysis

N/A — this is a new feature, not a bug fix.

---

## 5) Research

### Potential Solutions

**1. Full Five-Artifact Stack (Recommended)**

- Description: Implement all five discovery artifacts (llms.txt, SKILL.md, AGENTS.md, loop.mdc, OpenHands microagent) as described in the task brief, each following its respective standard.
- Pros:
  - Maximum agent coverage — any agent platform can discover Loop
  - Follows the industry "gold standard" pattern (Stripe, Langfuse, DevCycle all ship multiple artifacts)
  - Each artifact serves a distinct discovery moment (web browsing, installed skill, repo context, file-based rules, keyword triggers)
  - Progressive disclosure — agents get appropriate depth for their context
- Cons:
  - Five artifacts to maintain (mitigated by shared content nucleus)
  - Some content duplication across artifacts
- Complexity: Medium
- Maintenance: Medium (shared core content reduces drift)

**2. SKILL.md + llms.txt Only (Minimal)**

- Description: Ship only the two highest-impact artifacts — SKILL.md for installed agent workflows and llms.txt for web discovery.
- Pros:
  - Lower maintenance burden (2 artifacts vs 5)
  - Covers the two most important discovery paths
- Cons:
  - Misses agents that read AGENTS.md natively (Codex, Windsurf, Devin, Jules, Factory)
  - No Cursor-specific integration
  - No OpenHands support
- Complexity: Low
- Maintenance: Low

**3. Single SKILL.md with Templates**

- Description: Ship only SKILL.md and bundle AGENTS.md/loop.mdc/OpenHands templates inside it as reference files.
- Pros:
  - Single source of truth
  - Templates available but not standalone
- Cons:
  - Templates aren't auto-discovered by agent platforms
  - Requires setup CLI to extract and place templates
  - Worse developer experience until Feature 5 ships
- Complexity: Low
- Maintenance: Low

### Security Considerations

- llms.txt is public and should not expose internal API details beyond what's already in public docs
- AGENTS.md and other artifacts contain auth patterns — they should reference env vars (`$LOOP_API_KEY`), never actual keys
- Cursor rules and OpenHands microagents are committed to user repos — ensure no sensitive defaults

### Performance Considerations

- llms.txt should be cacheable (static or long Cache-Control)
- SKILL.md total token budget: ~100 tokens metadata + <5,000 tokens instructions
- AGENTS.md should be <500 tokens to minimize context window impact
- All artifacts should be optimized for token efficiency — decision tables over prose

### Recommendation

**Recommended Approach:** Full Five-Artifact Stack

**Rationale:** Loop's entire value proposition is agent integration. Shipping only partial discovery coverage undermines the product's core message. The maintenance cost is manageable because all five artifacts share a common content nucleus (auth pattern, base URL, 5 core operations). The research shows that products shipping the full stack (Stripe, Langfuse, DevCycle) see significantly better agent adoption — DevCycle achieved 3x SDK install rates with comprehensive agent-first onboarding.

**Key Design Decisions from Research:**

1. **Shared content nucleus:** All five artifacts share: env var name (`LOOP_API_KEY`), base URL, and five curl examples. Write the core once, shape it five ways.

2. **SKILL.md description is highest-leverage:** The ~200 token description field is loaded at agent startup for every session. It should enumerate all use cases with specific verb phrases agents pattern-match on.

3. **AGENTS.md as a hosted snippet:** Host the canonical snippet at `looped.me/agents-md-snippet.md` so teams can curl-refresh it. Living document > copy-paste artifact.

4. **OpenHands trigger keywords:** Use `loop`, `looped`, `looped.me`, `loop api` as triggers. Avoid `issue` and `signal` (collision with generic concepts).

5. **Cursor rule mode:** Use "Agent Requested" (`alwaysApply: false`, no globs, good description) so the AI decides when to load it based on context relevance.

6. **llms.txt structure:** Follow Stripe/Cloudflare pattern — organize by concept area (Quickstart, Issues, Signals, Dispatch, Templates, Dashboard) with links to `.md` versions of doc pages.

7. **Langfuse as primary reference:** Their SKILL.md (CLI access + docs retrieval pattern) is the closest analog to Loop's SKILL.md (dispatch workflow + API access).

**Caveats:**
- llms.txt links to `.md` doc pages require those pages to exist or be creatable — Fumadocs MDX pages may need a `.md` export route
- OpenHands is migrating from `.openhands/microagents/` to `.agents/skills/` format — ship the legacy format for now, note the migration path
- The dispatch endpoint (`GET /api/dispatch/next`) doesn't exist yet (Feature 2) — SKILL.md should reference it as "coming soon" or use existing endpoints

---

## 6) Clarifications & Decisions

- **Decisions made:**
  1. **llms.txt host:** Marketing site (www.looped.me/llms.txt) — follows Stripe/Cloudflare convention of serving at the product's primary domain
  2. **SKILL.md package location:** `packages/loop-skill/` in the monorepo — publishable to npm as `@dork-labs/loop`, installable via `npx openskills install @dork-labs/loop`
  3. **Template artifact scope:** Template files in `packages/loop-skill/templates/` — shipped alongside SKILL.md for the setup CLI to copy into user repos; Loop's own repo also receives them as dogfooding
  4. **SKILL.md invocation mode:** Both user and Claude invocable — users can run `/loop-dispatch` explicitly AND Claude auto-invokes when it detects Loop-related work

- **Open questions:** None
