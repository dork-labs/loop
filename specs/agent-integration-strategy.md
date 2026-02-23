# Agent Integration Strategy

**Created:** 2026-02-22
**Goal:** Make Loop the easiest autonomous work management system for AI agents to discover, connect to, and operate within.

---

## Instructions for AI Agents

This document is a task list. Each task runs the `/ideate` command with a pre-written prompt.

**To execute the next task:**

1. Look at the **Tasks** section below
2. Find the first unchecked box (`- [ ]`) that has no unchecked blockers
3. Run `/ideate` followed by the full prompt text from the matching **Prompts** section
4. After `/ideate` completes successfully, check the box by changing `- [ ]` to `- [x]`

**Dependency rules:** A task's blockers are listed in parentheses. A task is ready when all its blockers are checked. Tasks with no blockers listed are ready immediately.

**After checking a box**, look for the next unchecked task and repeat. Stop when all tasks are checked or when the next task has unchecked blockers.

---

## Tasks

### Phase 1: Foundation (no blockers — run in any order)

- [x] 1. API Key DX
- [x] 2. MCP Server
- [x] 3. Agent Discovery Layer
- [x] 4. TypeScript SDK

### Phase 2: Integration

- [x] 5. Connect CLI (blocked by: 1, 2, 3)
- [x] 6. Loop CLI (blocked by: 4)

### Phase 3: Polish

- [x] 7. Documentation Update (blocked by: 1, 2, 3, 4, 5, 6)
- [x] 8. Marketing Site Update (blocked by: 1, 2, 3, 4, 5, 6)
- [x] 9. FTUE Update (blocked by: 2, 3, 5)

---

## Dependency Map

```
Phase 1 (parallel, no blockers):
  [1] API Key DX
  [2] MCP Server
  [3] Agent Discovery Layer
  [4] TypeScript SDK

Phase 2 (depends on Phase 1):
  [5] Connect CLI        <- needs 1, 2, 3
  [6] Loop CLI           <- needs 4

Phase 3 (depends on Phase 1 & 2):
  [7] Documentation      <- needs 1-6
  [8] Marketing Site     <- needs 1-6
  [9] FTUE Update        <- needs 2, 3, 5
```

---

## Research Foundation

These research documents inform the prompts below. They do NOT need to be read before running — the prompts reference them directly.

| Document                                                      | Focus                                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------- |
| `research/20260222_api_key_generation_onboarding_patterns.md` | How Stripe, Supabase, Auth.js, Strapi handle key generation |
| `research/20260222_mcp_servers_developer_tools.md`            | MCP adoption, design patterns, tool inventories             |
| `research/20260222_ai_agent_tool_discovery_onboarding.md`     | SKILL.md, AGENTS.md, llms.txt, Cursor rules, OpenHands      |
| `research/20260222_sdk_cli_api_interaction_layers.md`         | SDK/CLI/MCP priority, agent SDK patterns                    |
| `research/20260222_loop_developer_onboarding.md`              | Vibe coder personas, `npx init` patterns                    |

---

## Prompts

Each prompt below is the exact text to pass to `/ideate`. Copy everything inside the code fence.

---

### 1. API Key DX

```
Improve the API key generation and developer experience for Loop. The full scope of this work is documented in specs/agent-integration-strategy.md — this feature is "Feature 1: API Key DX".

Currently, users must manually create and set LOOP_API_KEY in their .env files with no guidance on format or generation. We need to:

1. Add a `loop_` prefix to all generated API keys (e.g., `loop_a1b2c3d4e5f6...`) for identifiability and GitHub secret scanning
2. Auto-generate LOOP_API_KEY during `npm run setup` using crypto.randomBytes(32) and write it to both apps/api/.env and apps/app/.env
3. Improve Zod validation startup errors — when LOOP_API_KEY is missing, print the exact generation command instead of a generic error
4. Update .env.example files with inline comments showing generation commands
5. Ensure the FTUE setup checklist displays the prefixed key format correctly

Out of scope: multi-key management, key rotation UI, OAuth/session auth, hosted key management (Unkey-style). See research/20260222_api_key_generation_onboarding_patterns.md for patterns from Auth.js, Stripe, Strapi, Supabase.
```

---

### 2. MCP Server

```
Build an MCP (Model Context Protocol) server for Loop that lets AI agents in Claude Code, Cursor, Windsurf, and any MCP-capable environment interact with Loop natively. The full scope is documented in specs/agent-integration-strategy.md — this feature is "Feature 2: MCP Server".

The server should expose 8-10 tools designed around the agent dispatch loop (NOT a 1:1 REST endpoint mapping):

- loop_get_next_task — Loop's signature tool. Returns highest-priority unblocked issue with dispatch instructions.
- loop_complete_task — Report completion with outcome notes, Loop handles next steps.
- loop_create_issue — Create a new issue.
- loop_update_issue — Update status/priority/fields.
- loop_list_issues — Filtered listing with pagination.
- loop_get_issue — Full issue detail with parent chain, related issues, and prompt context.
- loop_ingest_signal — Push a signal into the triage queue.
- loop_create_comment — Agent reports progress on an issue.
- loop_get_dashboard — System health overview.

Technical requirements:
- Streamable HTTP transport (SSE is deprecated)
- API key auth via Authorization: Bearer header
- npm package (@dork-labs/loop-mcp) for stdio transport
- Token-efficient tool descriptions (<1,000 tokens total)
- Structured error responses with actionable suggestions
- .mcp.json template for team-wide config sharing
- Publish to the official MCP Registry

Out of scope: OAuth auth flow, remote hosted MCP at mcp.looped.me, Cursor deeplink buttons, webhook receiver tools, wrapping every REST endpoint. See research/20260222_mcp_servers_developer_tools.md for patterns from GitHub, Linear, Sentry, and the jlowin.dev "outcomes over operations" design principle.
```

---

### 3. Agent Discovery Layer

```
Build the agent discovery layer for Loop — the files and endpoints that let any AI agent discover Loop and understand how to use it. The full scope is documented in specs/agent-integration-strategy.md — this feature is "Feature 3: Agent Discovery Layer".

This feature ships five artifacts:

1. llms.txt endpoint at looped.me/llms.txt — concise markdown describing Loop's purpose, API surface, and auth pattern. Links to .md versions of key doc pages. Follows the llmstxt.org spec with an "Optional" section for advanced topics.

2. Agent Skill (SKILL.md) for the Loop dispatch workflow — distributable via `npx openskills install @dork-labs/loop`. Progressive disclosure (metadata ~100 tokens, instructions <5,000 tokens, references on demand). Covers: poll for next task, work the issue, report completion, create issues for discovered bugs. Must be compatible with Claude Code, Codex, Cursor, Amp, Goose per the agentskills.io spec.

3. AGENTS.md snippet — a block teams paste into their repo root. Read natively by Codex, Windsurf, Devin, Jules, GitHub Copilot, Factory. Covers what Loop is, API URL, auth format, common operations.

4. Cursor rules file (loop.mdc) with MDC frontmatter for auto-activation. Publish to cursor.directory.

5. OpenHands microagent (.openhands/microagents/knowledge/loop.md) with trigger keywords: "loop", "issue", "dispatch", "signal".

Out of scope: MCP server (Feature 2), connect CLI that auto-writes these files (Feature 4), TypeScript SDK (Feature 4), dashboard changes, marketing site updates. See research/20260222_ai_agent_tool_discovery_onboarding.md for patterns from Stripe, DevCycle, Langfuse, and the agentskills.io specification.
```

---

### 4. TypeScript SDK

```
Build a thin, idiomatic TypeScript SDK wrapping Loop's REST API. The full scope is documented in specs/agent-integration-strategy.md — this feature is "Feature 4: TypeScript SDK".

Follow the Stripe/OpenAI pattern: class-based client with resource namespacing.

Example usage:
  const loop = new LoopClient({ apiKey: process.env.LOOP_API_KEY });
  await loop.issues.list({ status: 'triage' });
  await loop.dispatch.next(); // Loop's unique endpoint

Resources to expose:
- loop.issues — list, get, create, update, delete
- loop.projects — list, get, create, update, delete
- loop.goals — list, get, create, update, delete
- loop.labels — list, create, delete
- loop.signals — ingest
- loop.comments — list, create
- loop.templates — list, get, create, update, delete, versions, reviews
- loop.dispatch — next() (Loop's unique dispatch endpoint)
- loop.dashboard — stats, activity, prompts

Technical requirements:
- Published as @loop/sdk or @dork-labs/loop-sdk
- Full TypeScript types for all request/response shapes
- Built-in retry with exponential backoff
- Pagination helpers
- Zero or minimal runtime dependencies
- Idempotency key support on mutating operations
- Structured error objects with code, message, field
- Works in Node.js (browser bundle is future work)

Out of scope: agent-specific toolkit (@loop/agent-toolkit), CLI (Feature 6, built on this), MCP server (Feature 2), auto-generation via Stainless/Fern (evaluate during ideation but don't commit upfront), Python/Go SDKs. See research/20260222_sdk_cli_api_interaction_layers.md for patterns from Stripe, OpenAI, Neon, and Linear.
```

---

### 5. Connect CLI

```
Build `npx @dork-labs/loop-connect` — a one-command experience that connects any existing project to Loop. The full scope is documented in specs/agent-integration-strategy.md — this feature is "Feature 5: Connect CLI".

This is the Convex `npx convex dev` pattern applied to Loop. The CLI should:

1. Prompt for the Loop API key (with URL pointing to the dashboard for key generation)
2. Validate the key against the Loop API and show the org/project name as a trust signal
3. Prompt for which project to connect to (list projects from API, or "Create new")
4. Write LOOP_API_KEY and LOOP_API_URL to .env.local (or .env)
5. Detect environment and write appropriate agent config:
   - If CLAUDE.md exists: append Loop context block
   - If .cursor/ exists: write .cursor/rules/loop.mdc
   - If .openhands/ exists: write microagent knowledge file
   - If .mcp.json exists or Claude Code detected: add MCP server config
6. Print success message with dashboard URL and "try it" command

Technical requirements:
- Interactive prompts via @clack/prompts or enquirer
- Published as @dork-labs/loop-connect with bin field for npx usage
- Idempotent (safe to run multiple times)
- --yes flag for non-interactive mode (CI/scripting)
- Validate the API key actually works before writing config

Out of scope: account creation, building the MCP server itself (Feature 2), building the agent skill files (Feature 3), SDK/CLI tool installation, Vercel Marketplace integration, in-browser setup wizard. See research/20260222_loop_developer_onboarding.md for patterns from Convex, Clerk+Vercel, Twilio, and Stream.
```

---

### 6. Loop CLI

```
Build the `loop` CLI — a terminal-native interface to Loop with `loop next` as the killer command. The full scope is documented in specs/agent-integration-strategy.md — this feature is "Feature 6: Loop CLI".

`loop next` is what differentiates this from every other PM CLI. No other tool returns fully-prepared agent dispatch instructions from the terminal.

Core commands:
- loop next [--json] — returns highest-priority actionable issue with full instructions
- loop issues list [--status=X] [--type=X] [--project=X] [--json]
- loop issues create --title "..." --type bug [--project X]
- loop issues view <id> [--web]
- loop issues start <id> — transition to in_progress, print instructions
- loop issues done <id> [--outcome "..."] — mark complete with notes
- loop projects list [--json]
- loop signals ingest --source <src> --payload '...'
- loop auth login / logout / status
- loop dashboard — terminal-rendered system health

Design principles:
- Three output tiers: human default (colored/formatted), --plain (script-friendly), --json (machine-readable with optional --jq filter)
- Follow `gh` CLI command grammar: loop <resource> <action> [flags]
- Auth via LOOP_API_KEY env var or ~/.loop/config.toml
- Built on the TypeScript SDK (Feature 4)
- Shell completions for bash, zsh, fish

Out of scope: interactive TUI with panels/vim navigation, MCP server (Feature 2), wrapping every API endpoint, running a local Loop server, plugin/extension system. See research/20260222_sdk_cli_api_interaction_layers.md for patterns from gh CLI, schpet/linear-cli, czottmann/linearis, and ankitpokhrel/jira-cli.
```

---

### 7. Documentation Update

```
Update Loop's Fumadocs documentation site to cover all new agent integration surfaces. The full scope is documented in specs/agent-integration-strategy.md — this feature is "Feature 7: Documentation Update".

The docs site lives at apps/web/ and serves at looped.me/docs. We need to add:

1. A rewritten Getting Started guide with the new quickstart flow: connect CLI then first issue then dispatch loop
2. MCP Server docs — installation for Claude Code, Cursor, Windsurf; tool reference with descriptions and parameter schemas; .mcp.json team config; troubleshooting
3. Agent Skill docs — how to install via openskills, what the skill does, customization options
4. SDK reference — full API reference for @loop/sdk with code examples for every resource (issues, projects, goals, signals, dispatch, dashboard)
5. CLI reference — command reference for the loop CLI with examples for every command
6. Per-agent integration guides for Claude Code, Cursor, OpenHands/OpenClaw, and a generic "any agent" guide
7. API key management docs — generation, the loop_ prefix, rotation, security best practices
8. Architecture overview — how MCP, SDK, CLI, and REST API relate (diagram)

Out of scope: building any integration surfaces (Features 1-6), marketing site content (Feature 8), FTUE changes (Feature 9), blog posts. The docs should reference and link to the existing research documents in research/ for additional context.
```

---

### 8. Marketing Site Update

```
Update the Loop marketing site at looped.me to showcase agent integration capabilities. The full scope is documented in specs/agent-integration-strategy.md — this feature is "Feature 8: Marketing Site Update".

The marketing site is a Next.js 16 + Fumadocs app at apps/web/. We need:

1. A new "Integrations" or "Connect" page — visual grid of supported agents (Claude Code, Cursor, Windsurf, OpenHands, Codex) with one-click setup paths and deeplink buttons
2. Homepage updates — add agent integration as a key value prop; show the `loop next` terminal experience; "Works with Claude Code, Cursor, and any MCP-capable agent" with logo grid
3. "Add to Claude Code" and "Add to Cursor" deeplink buttons — claude:// and cursor:// protocol links that trigger one-click MCP installation
4. /llms.txt route — serve the llms.txt file from the marketing site domain (this file is created in Feature 3)
5. Interactive tabbed code snippets showing common operations in curl, TypeScript SDK, and CLI
6. Social proof section with "Compatible with" logo grid for supported agent platforms

Out of scope: documentation content (Feature 7), building integration surfaces (Features 1-6), FTUE changes (Feature 9), pricing, blog posts. See research/20260222_loop_developer_onboarding.md for patterns from Clerk, Twilio, and DevCycle on conversion-optimized integration pages.
```

---

### 9. FTUE Update

```
Update the FTUE onboarding flow to incorporate new agent integration surfaces. The full scope is documented in specs/agent-integration-strategy.md — this feature is "Feature 9: FTUE Update for Agent Integration".

The current FTUE (see specs/ftue-onboarding/) shows a setup checklist with curl/JS/Python code snippets. Now that we have an MCP server, connect CLI, and agent skills, the FTUE should guide users to the easiest path for their environment.

Updates needed:

1. Update setup checklist Step 3 ("Send your first issue") to offer multiple paths:
   - Recommended: `npx @dork-labs/loop-connect` (one-command connect)
   - Claude Code: `claude mcp add` command (one-command MCP connection)
   - Cursor: "Add to Cursor" deeplink button (one-click MCP install)
   - Manual: keep existing curl/JS/Python tabbed snippets as fallback

2. Add an "Agent Setup" step after the current checklist — guide users to install the Agent Skill or configure their agent's instruction file

3. Update welcome modal copy to mention agent compatibility

4. Smart detection — if possible, detect which agent platform the user came from and highlight the relevant setup path

5. Update polling step copy — "Waiting for your agent to send its first issue..." instead of generic "Listening..."

Out of scope: building the connect CLI, MCP server, or agent skill themselves (Features 2-4), documentation (Feature 7), marketing site (Feature 8), full FTUE redesign. The files to modify are primarily in apps/app/src/components/setup-checklist.tsx, apps/app/src/components/setup-code-snippet.tsx, and apps/app/src/components/welcome-modal.tsx.
```
