---
slug: mcp-server
number: 11
created: 2026-02-22
status: ideation
---

# MCP Server — Native AI Agent Interface for Loop

**Slug:** mcp-server
**Author:** Claude Code
**Date:** 2026-02-22
**Branch:** preflight/mcp-server
**Related:** specs/agent-integration-strategy.md (Feature 2)

---

## 1) Intent & Assumptions

- **Task brief:** Build an MCP (Model Context Protocol) server for Loop that lets AI agents in Claude Code, Cursor, Windsurf, and any MCP-capable environment interact with Loop natively. The server exposes 9 tools designed around the agent dispatch loop — not a 1:1 REST endpoint mapping. The signature tool `loop_get_next_task` returns the highest-priority unblocked issue with fully-hydrated dispatch instructions.

- **Assumptions:**
  - Loop's REST API is fully functional and the MCP server wraps it as a thin facade
  - `@modelcontextprotocol/sdk` v1.26.0 is the stable TypeScript SDK (v2 is pre-alpha, not ready)
  - The server will live in the monorepo as `packages/mcp/` (publishable npm package, not a deployed app)
  - Dual-transport: stdio for local dev/npx usage, Streamable HTTP mounted on the existing API
  - Bearer token auth (same `LOOP_API_KEY` as REST API) — OAuth 2.1 is future work
  - The existing `apps/api/` Hono server can mount the HTTP transport at `/mcp`
  - SSE transport is deprecated per MCP spec — Streamable HTTP only

- **Out of scope:**
  - OAuth 2.1 auth flow (Phase 2, post-launch)
  - Remote hosted MCP at mcp.looped.me (requires OAuth first)
  - Cursor/Claude deeplink buttons (Feature 8: Marketing Site)
  - Webhook receiver tools (signals come via existing webhook endpoints)
  - Wrapping every REST endpoint (agent-intent tools only, not 1:1 mapping)
  - MCP SDK v2 migration (wait for stable release)

## 2) Pre-reading Log

- `research/20260222_mcp_servers_developer_tools.md`: Comprehensive research covering GitHub, Linear, Sentry MCP patterns. Key insight: "outcomes over operations" design principle — tools should represent what agents want to accomplish, not API endpoints.
- `research/20260222_mcp_server_implementation.md`: New research covering SDK API, transport comparison, tool design, auth, registry publishing. Recommends dual-transport single package, `packages/mcp/` placement, outputSchema for structured responses.
- `apps/api/src/routes/dispatch.ts`: The dispatch endpoint — `GET /dispatch/next` atomically claims highest-priority unblocked issue using `FOR UPDATE SKIP LOCKED`, scores by priority/goal/age/type, and returns issue + hydrated prompt. This is the backend for `loop_get_next_task`.
- `apps/api/src/routes/issues.ts`: Full issue CRUD with filtering by status, type, projectId, pagination. Maps to `loop_list_issues`, `loop_get_issue`, `loop_create_issue`, `loop_update_issue`.
- `apps/api/src/routes/signals.ts`: Signal ingestion — creates signal + linked triage issue atomically. Maps to `loop_ingest_signal`.
- `apps/api/src/routes/comments.ts`: Threaded comments on issues. Maps to `loop_create_comment`.
- `apps/api/src/routes/dashboard.ts`: System health metrics endpoint. Maps to `loop_get_dashboard`.
- `apps/api/src/routes/projects.ts`: Project CRUD with goal association. Useful context for dispatch.
- `apps/api/src/lib/prompt-engine.ts`: Template selection by specificity, Handlebars hydration with full context (parent chain, labels, goals). The dispatch response includes the rendered prompt.
- `apps/api/src/lib/priority-scoring.ts`: Scoring algorithm — priority weight + goal alignment + age + issue type bonuses.
- `apps/api/src/middleware/auth.ts`: Bearer token validation using `timingSafeEqual`. Same auth pattern for MCP HTTP transport.
- `apps/api/src/app.ts`: Hono app setup with CORS, error handling, route mounting. The HTTP transport would be mounted here.
- `apps/api/src/env.ts`: Zod-validated environment variables. MCP will need `LOOP_API_KEY` and `LOOP_API_URL`.
- `apps/cli/src/lib/api-client.ts`: CLI's ky HTTP client pattern — good reference for MCP's internal API client.
- `apps/cli/package.json`: Published as `@dork-labs/looped` with bin field. Pattern for MCP's npm publishing.
- `package.json`: Monorepo workspaces configured as `apps/*` and `packages/*`. No packages exist yet.
- `turbo.json`: Build pipeline config. Needs MCP build task added.
- `.mcp.json`: Existing MCP config in repo root (for development tools like Context7, shadcn, playwright).

## 3) Codebase Map

**Primary Components/Modules:**

- `packages/mcp/` (NEW) — The MCP server package. Single `createLoopMcpServer(config)` function with dual entry points.
- `packages/mcp/src/tools/` (NEW) — 9 tool implementations, each wrapping REST API calls.
- `packages/mcp/src/stdio.ts` (NEW) — stdio entry point with `#!/usr/bin/env node` shebang for npx usage.
- `packages/mcp/src/http.ts` (NEW) — Hono route handler export for mounting in `apps/api/`.
- `apps/api/src/app.ts` — Mount point for HTTP transport at `/mcp`.

**Shared Dependencies:**

- `@modelcontextprotocol/sdk` v1.26.0 — Official MCP TypeScript SDK
- `@hono/mcp` — Hono middleware for MCP Streamable HTTP transport
- `ky` — HTTP client for REST API calls (same pattern as CLI)
- `zod` — Schema validation for tool inputs/outputs

**Data Flow:**

```
Agent (Claude Code / Cursor / etc.)
  ↓ MCP protocol (stdio or Streamable HTTP)
  ↓ @modelcontextprotocol/sdk processes request
  ↓ Tool handler invoked (e.g., loop_get_next_task)
  ↓ Internal HTTP call to Loop REST API (ky client)
  ↓ REST API processes request (auth, business logic, DB)
  ↓ Response transformed for agent consumption
  ↓ MCP protocol response (structuredContent + text fallback)
  ↓ Agent receives result
```

**Feature Flags/Config:**

- `LOOP_API_KEY` — Bearer token for REST API auth (required)
- `LOOP_API_URL` — API base URL (default: `http://localhost:5667`)
- No feature flags needed — MCP server is a separate package

**Potential Blast Radius:**

- **New files:** `packages/mcp/` directory (12-15 files)
- **Modified files:**
  - `package.json` — Add `packages/*` to workspaces (already listed but no packages exist)
  - `apps/api/src/app.ts` — Mount HTTP transport at `/mcp`
  - `turbo.json` — Add MCP build task
- **No existing code changes:** MCP wraps the API; doesn't modify it

## 4) Root Cause Analysis

N/A — This is a new feature, not a bug fix.

## 5) Research

**Research Sources:** Prior research doc (`research/20260222_mcp_servers_developer_tools.md`) + new deep research (`research/20260222_mcp_server_implementation.md`) covering SDK API, transport patterns, tool design, auth, and registry publishing.

### Potential Solutions

**1. Dual-Transport Single Package (Recommended)**

- Description: One `createLoopMcpServer(config)` factory function. Two entry points: `src/stdio.ts` (bin for npx) and `src/http.ts` (Hono route handler). Published as `@dork-labs/loop-mcp` on npm.
- Pros:
  - One codebase, two distribution methods
  - stdio works immediately for local dev (`npx @dork-labs/loop-mcp`)
  - HTTP transport mounts on existing API (`apps/api/` at `/mcp`)
  - Consistent behavior across both transports
- Cons:
  - Slightly more complex build setup
- Complexity: Medium
- Maintenance: Low (single source of truth)

**2. Separate stdio and HTTP Packages**

- Description: `@dork-labs/loop-mcp` for stdio, separate HTTP handler in `apps/api/`.
- Pros: Simpler per-package
- Cons: Code duplication, version drift risk, harder to maintain
- Complexity: Medium
- Maintenance: High

**3. HTTP-Only (Streamable HTTP)**

- Description: Only deploy as HTTP endpoint at `/mcp`, no npm package.
- Pros: Simplest initial build
- Cons: No offline/local usage, can't use without running API, agents prefer stdio for reliability
- Complexity: Low
- Maintenance: Low

### Tool Design

The 9 tools follow the "outcomes over operations" principle. Each tool is designed around what an agent needs to accomplish:

| Tool | Purpose | Key Design Decision |
|------|---------|---------------------|
| `loop_get_next_task` | Core dispatch — returns issue + prompt | Atomic claim, includes hydrated instructions |
| `loop_complete_task` | Report completion with outcome | Sets status to done, adds outcome comment |
| `loop_create_issue` | Create new issue | Flat args: title, type, priority, projectId |
| `loop_update_issue` | Update status/priority/fields | Partial update, flat args |
| `loop_list_issues` | Filtered listing | Pagination with has_more, default limit 20 |
| `loop_get_issue` | Full detail with context | Includes parent chain, labels, comments |
| `loop_ingest_signal` | Push signal to triage | Creates signal + linked triage issue |
| `loop_create_comment` | Agent progress report | Threaded comment support |
| `loop_get_dashboard` | System health | Issue counts, goal progress, dispatch stats |

**Tool Description Budget:** Each description should be 2-4 sentences. Total across all tools: <1,000 tokens.

**Tool Naming:** All prefixed with `loop_` to prevent collisions when agents connect multiple MCP servers.

### Error Handling

- Business logic errors → `return { content: [...], isError: true }` with actionable message
- Example: `"Issue 'abc-999' not found. Use loop_list_issues to find valid IDs."`
- Never throw from tool handlers — that creates protocol-level errors agents can't recover from
- Include `next_steps` hints in every response

### Authentication

- **Phase 1 (this feature):** Bearer token via `LOOP_API_KEY` env var (stdio) or `Authorization` header (HTTP)
- **Phase 2 (future):** OAuth 2.1 with PKCE for remote hosted MCP

### MCP Registry Publishing

- Add `"mcpName": "io.github.dork-labs/loop"` to `packages/mcp/package.json`
- Create `server.json` with stdio (npm) and HTTP transport entries
- Use `mcp-publisher publish` CLI for Registry submission
- GitHub Actions workflow to automate on version bump

### Recommendation

**Recommended Approach:** Dual-transport single package in `packages/mcp/`.

**Implementation Priority:**
1. `loop_get_next_task` + `loop_complete_task` first — these two form a complete autonomous dispatch cycle
2. `loop_create_issue` + `loop_list_issues` + `loop_get_issue` — basic issue operations
3. `loop_update_issue` + `loop_create_comment` — issue management
4. `loop_ingest_signal` + `loop_get_dashboard` — advanced features

### Security Considerations

- Bearer token validated per-request on HTTP transport
- CORS restricted to known origins on HTTP transport
- Tool annotations: mark read-only tools with `readOnlyHint: true` (list, get, dashboard)
- Prompt injection defense: sanitize tool inputs, don't execute arbitrary code from tool responses
- Rate limiting at REST API layer, not MCP layer

### Performance Considerations

- stdio transport is fastest (no network overhead for local agents)
- HTTP transport adds one network hop (agent → MCP HTTP → REST API → DB)
- Tool responses should be token-efficient — return only fields agents need
- Pagination defaults to 20 items to control response size

## 6) Clarification

1. **Package placement:** Should the MCP server live at `packages/mcp/` (research recommendation — it's a publishable library) or `apps/mcp/` (matches existing app pattern)? Recommendation: `packages/mcp/` since it's an npm package, not a deployed service.

2. **HTTP transport mounting:** Should the Streamable HTTP transport be mounted on the existing `apps/api/` Hono server at `/mcp`, or deployed as a separate service? Recommendation: mount on existing API — shares auth middleware, CORS config, and deployment infrastructure.

3. **`loop_complete_task` design:** Should this tool only update the issue status, or also create a comment with outcome notes AND check for blocked downstream issues to surface next? Recommendation: do all three — set status to done, add outcome comment, and return any newly-unblocked issues in the response.

4. **Structured output (`outputSchema`):** Should we use the new MCP 2025-06-18 `outputSchema` + `structuredContent` for typed responses, or stick with text-only content blocks for maximum compatibility? Recommendation: use `outputSchema` with text fallback for backward compatibility.

5. **`@hono/mcp` vs manual transport:** Should we use the `@hono/mcp` npm package for Hono integration, or implement the Streamable HTTP transport manually using the SDK? Recommendation: use `@hono/mcp` if it supports Streamable HTTP — it simplifies mounting significantly.
