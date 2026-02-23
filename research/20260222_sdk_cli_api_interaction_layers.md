# SDK, CLI, and API Interaction Layers: Patterns and Recommendations for Loop

**Research Date:** 2026-02-22
**Mode:** Deep Research
**Searches Performed:** 14
**Sources Gathered:** 30+

---

## Research Summary

Developer tools follow a consistent maturity arc: REST API first, then TypeScript/JS SDK, then CLI, then MCP. The data shows that for a product at Loop's stage — a working REST API with early traction — a **TypeScript SDK is the highest-leverage next move**, both for human developers and AI agents. A CLI is valuable but secondary and, notably, the community will often build one before you do (as evidenced by the Linear ecosystem). MCP is emerging fast and should be a near-term consideration but is not the first priority. Critically, the patterns for "agent-friendly" SDKs are now well-defined and differ meaningfully from traditional human-developer SDKs.

---

## Key Findings

### 1. The Interaction Layer Map

The industry follows a clear progression from MVP to full developer platform:

| Layer | Who Has It | What It Enables |
|-------|-----------|-----------------|
| REST API only | Early-stage products, all startups at launch | Direct integration, only path available |
| REST API + SDK | Stripe, Twilio, SendGrid, OpenAI, Anthropic, Resend | Reduced boilerplate, type safety, faster integration |
| REST API + SDK + CLI | Vercel, Supabase, Railway, Fly.io, Neon, GitHub | Power user workflows, CI/CD, local dev, scripting |
| REST API + SDK + CLI + MCP | GitHub, Stripe, Linear (community), Neon (toolkit) | AI agent consumption without custom integration work |

Notable patterns:
- **GitHub** has the most mature multi-layer story: REST API + GraphQL API + Octokit SDK + `gh` CLI + GitHub MCP server
- **Linear** has a REST/GraphQL API + official `@linear/sdk` TypeScript SDK + **no official CLI** (the community has built 8+ of them, several explicitly agent-friendly)
- **Stripe** now has a regular SDK (`stripe-node`) + dedicated agent toolkit (`@stripe/agent-toolkit`) — they separated the two concerns deliberately
- **Neon** ships a regular SDK + a separate `@neondatabase/toolkit` designed specifically for AI agent usage

### 2. CLI Patterns for Issue/Project Management

#### GitHub CLI (`gh`)

The gold standard for developer CLI design. Command grammar: `gh <resource> <action> [flags]`.

Key patterns:
- `gh issue list` — filter by `--state`, `--label`, `--assignee`, `--author`; supports `--json <fields>`, `--jq <expression>`, `--template` for formatting output
- `gh issue create` — interactive by default, but all fields passable as flags for scripting
- `gh issue view` — terminal render + `--web` flag to open in browser
- `gh issue edit` — patch individual fields without touching others
- Every command has a `--json` flag returning structured output, enabling shell composability

Design lesson: The `--json` flag + `--jq` filter is the pattern that makes `gh` simultaneously human-friendly (pretty table by default) and agent/script-friendly (structured output on demand).

#### Linear CLI (Community-built)

Linear has no official CLI. The community has shipped multiple implementations:

**`schpet/linear-cli`** (most used) — explicitly "agent friendly," integrates with git/jj to detect current branch issues, exposes JSON output, supports `.linear.toml` config.

**`czottmann/linearis`** — designed specifically for LLM consumption. Notable design decision: "linearis usage tells the LLM everything it needs to know and comes in well under 1,000 tokens" vs. Linear's official MCP which consumes ~13,000 tokens just for connection. Pure JSON output, no decorative UI.

**`dorkitude/linctl`** — built with agents in mind, implemented in Go with Cobra.

The Linear CLI gap is a product signal: **when users build multiple CLIs for your tool, they are telling you they need one**. The existence of agent-specific Linear CLIs is particularly relevant to Loop's positioning.

#### Jira CLI (`jira-cli` by ankitpokhrel)

The most feature-complete community Jira CLI. Design patterns:
- Interactive table view as default (arrow keys, vim navigation)
- `--plain`, `--raw` (JSON), `--csv` output modes
- Supports `issue create`, `issue move`, `issue assign`, `issue view`, `issue link`
- JQL pass-through for advanced filtering
- Interactive prompts for guided creation

Key lesson: Jira's CLI (community-built, ~12k GitHub stars) became the de facto standard Atlassian later formalized with their official ACLI. Same pattern may happen with Loop.

#### The Overall CLI UX Pattern

```
tool <resource> <action> [identifier] [--flags]
```

Examples across tools:
```bash
gh issue list --state open --json number,title,labels
linear issue start ABC-123
jira issue move ISSUE-1 "In Progress" --comment "starting"
loop issue list --status=triage --json
```

Three tiers of output:
1. **Human default**: colored, formatted table or card
2. **Script mode**: `--plain` or `--no-color`
3. **Machine mode**: `--json [fields]` (optionally with `--jq` filter)

---

### 3. SDK Design for Agent Consumption

#### The Emerging Split: Human SDK vs Agent SDK

The most significant finding in this research is that leading developer platforms are **splitting their SDKs into two distinct products**:

| SDK Type | Designed For | Example |
|----------|-------------|---------|
| Regular SDK | Human developers writing application code | `stripe-node`, `@linear/sdk` |
| Agent Toolkit | AI agents consuming tools via function calling | `@stripe/agent-toolkit`, `@neondatabase/toolkit` |

This split exists because the needs are genuinely different:
- Human SDKs optimize for **idiomatic code, IDE completion, type safety, fluent chaining**
- Agent SDKs optimize for **tool definitions, minimal token surface, clear descriptions, permission scoping**

#### What Makes an SDK "Agent-Friendly"

Based on the Stripe, Neon, and Linear examples:

1. **Tool definitions over fluent chains** — Agents need `{ name, description, parameters }` not `client.issues.list().filter().paginate()`

2. **Permission scoping** — Stripe's agent toolkit strongly recommends restricted API keys so "tool availability is determined by the permissions you configure." Agents should not get the full surface area unless needed.

3. **Token efficiency** — The linearis CLI is explicitly engineered to use <1,000 tokens vs. Linear's MCP at 13,000. Every token of context is cost.

4. **Machine-readable errors** — Structured error objects with `code`, `message`, `field` — not prose descriptions

5. **Idempotency** — Agents may retry. Stripe's SDK adds idempotency keys "where appropriate to prevent duplication."

6. **Minimal dependencies** — Stainless-generated SDKs ship "zero dependencies out of the box." Agents run in constrained environments.

#### How the Major SDKs Are Designed

**Stripe (`stripe-node`)**:
- Class-based resource pattern: `stripe.customers.create()`, `stripe.invoices.list()`
- Resources are namespaced on the main client instance
- Built-in retry with exponential backoff (configurable `maxNetworkRetries`)
- Auto-pagination via `autoPagingEach()` and `autoPagingToArray()`
- Full TypeScript types for every request/response shape
- Idempotency keys passed per-request or set globally

**OpenAI SDK**:
- Client-based initialization: `const openai = new OpenAI({ apiKey, maxRetries })`
- Resource namespacing: `openai.chat.completions.create()`
- Per-request option overrides (timeouts, retries, headers)
- Streaming via `.stream()` helper returning typed event objects
- Same SDK team that built Stripe's — very similar design

**Linear SDK (`@linear/sdk`)**:
- Client-based: `new LinearClient({ apiKey })`
- Model-centric: returns objects with methods — `me.assignedIssues()`, `issue.update()`
- Object-oriented with method chaining on returned models
- Async/await native
- Built on top of the GraphQL API but hides GraphQL from the consumer

**Neon Toolkit (`@neondatabase/toolkit`)**:
- Explicitly designed for AI agents
- Minimal surface: `createProject()`, `sql()`, `deleteProject()`
- Wraps the full SDK but exposes only ephemeral-db patterns agents actually need
- Access to underlying `apiClient` for advanced operations

#### TypeScript Patterns: Class-Based vs Function-Based

The industry has largely settled on a **class-based client with resource namespacing**:

```typescript
// Dominant pattern (Stripe, OpenAI, Linear)
const client = new LoopClient({ apiKey: 'lp_...' });
const issues = await client.issues.list({ status: 'triage' });
const issue = await client.issues.create({ title: '...', type: 'bug' });
```

Not the flat function pattern:
```typescript
// Less common, harder to tree-shake, no shared config
import { listIssues, createIssue } from '@loop/sdk';
```

Not the deep chain pattern (explicitly called out as anti-pattern in SDK design literature):
```typescript
// Anti-pattern: too deep
client.projects(id).goals(goalId).issues.list()
```

#### Thin Wrapper vs Convenience Layer

The industry consensus from multiple sources:

- **Start thin** — your SDK should map 1:1 to your API endpoints to prevent drift
- **Add convenience in layers** — don't put convenience in the base client; create higher-level helpers separately
- **Neon's model** is the clearest: base `@neondatabase/api-client` (thin) + `@neondatabase/toolkit` (convenience wrapper for agents)

This is directly relevant to Loop: a thin `@loop/sdk` wrapping the REST API + a separate `@loop/agent-toolkit` exposing tool definitions for MCP/function calling.

---

### 4. What to Build First: Priority Order for Loop

Based on the research, here is the prioritized build order for Loop at its current stage:

#### Priority 1: TypeScript SDK (`@loop/sdk`) — **Build This Now**

**Why:** Loop's REST API is the core product, but every integration requires re-implementing auth, error handling, pagination, and type definitions. A thin TypeScript SDK eliminates this friction and enables:
- Direct consumption by AI agents running Node.js (Claude Code, Codex, etc.)
- Type-safe programmatic use in user applications
- A foundation that the CLI and agent toolkit are built on top of

**Design:**
```typescript
const loop = new LoopClient({ apiKey: process.env.LOOP_API_KEY });

// Issues
await loop.issues.list({ status: 'triage', limit: 20 });
await loop.issues.create({ title: '...', type: 'signal', projectId: '...' });
await loop.issues.get(id);
await loop.issues.update(id, { status: 'in_progress' });
await loop.issues.delete(id);

// Signals
await loop.signals.ingest({ source: 'posthog', payload: { ... } });

// Dashboard / dispatch
await loop.dispatch.next(); // returns next priority item + instructions
```

**Complexity:** Low-to-medium. Can be generated from the existing OpenAPI spec using Stainless or Fern. If hand-rolling, 2-3 days of work for a clean TypeScript SDK.

**Stainless note:** Stainless generates the TypeScript SDK that OpenAI and Cloudflare use. It handles retries, pagination, error handling, full types. Loop already has an OpenAPI registry entry point — this is well-positioned for generation.

#### Priority 2: `loop` CLI — **Build When SDK is Stable**

**Why:** The CLI is where human developers live. Loop's use case — managing issues, checking what to work on next, ingesting signals — is deeply terminal-native for developers. The Linear example proves the community will build CLIs for your product anyway. Building the official one lets you control the design and integrate it tightly with the dispatch workflow.

**Core commands for Loop:**

```bash
# Issue management
loop issues list [--status=triage] [--type=signal] [--json]
loop issues create --title "..." --type bug --project my-project
loop issues view ISSUE-ID
loop issues start ISSUE-ID       # transition to in_progress + show instructions
loop issues done ISSUE-ID        # mark complete + prompt for outcome

# Dispatch (the killer feature)
loop next                         # what should I work on? returns top item + instructions
loop next --json                  # machine-readable for scripting

# Signals
loop signal ingest --source sentry --payload '{"error": "..."}'

# Projects
loop projects list
loop projects view PROJECT-ID
```

The `loop next` command is Loop's unique CLI moment. No other tool has this. It's the pull-based dispatch mechanism made into a one-liner that any agent or developer can call.

**Design principles:**
- Human-readable default, `--json` flag for everything
- `--no-color` / `--plain` for CI environments
- Auth via `LOOP_API_KEY` env var or `~/.loop/config.toml`
- Follows `gh` command grammar: `loop <resource> <action>`

**Complexity:** Medium. 1-2 weeks with a solid Go or Node CLI framework (Cobra for Go, oclif for Node). Could reuse the TypeScript SDK as the client layer.

#### Priority 3: MCP Server — **Build Alongside or After CLI**

**Why now:** MCP has 97M+ monthly SDK downloads and is backed by OpenAI, Anthropic, Google, and Microsoft. It donated to the Linux Foundation in December 2025 — it's infrastructure, not a trend. Claude Code (Loop's likely primary agent environment, given DorkOS context) natively supports MCP servers.

**The token efficiency angle is critical for Loop specifically:** The linearis example (Loop's direct analogue for Linear) proves that a purpose-built tool using <1,000 tokens crushes the 13,000-token MCP approach. Loop's MCP should expose a minimal, efficient surface:

```
tools:
  - loop_next_issue        # get next priority issue + instructions
  - loop_create_issue      # create an issue
  - loop_update_issue      # update issue status/fields
  - loop_list_issues       # list with filtering
  - loop_ingest_signal     # send a signal
  - loop_complete_issue    # mark done with outcome
```

**6 tools, not 60.** The goal is not to wrap every API endpoint — it's to expose the core agentic workflow. Agents don't need `loop_pin_issue` or `loop_lock_issue`.

**The auto-generation path:** Loop already has an OpenAPI spec. Tools like Zuplo's MCP Server Handler and Stainless's MCP generation can turn an OpenAPI spec into an MCP server automatically. This makes MCP potentially very low-effort if the OpenAPI spec is well-maintained.

**Complexity:** Low (if auto-generated from OpenAPI) to medium (if hand-crafted for optimal agent UX).

#### Priority 4: Agent Toolkit (`@loop/agent-toolkit`) — **After MCP proves usage**

A separate npm package that wraps the SDK's capabilities as tool definitions compatible with LangChain, OpenAI Agents SDK, Vercel AI SDK, etc. Model it exactly on `@stripe/agent-toolkit`. Defer until there's clear demand.

---

### 5. Agent-Specific SDKs: What's Different

#### Real-World Examples of Agent-First Design

| Product | Regular SDK | Agent SDK | Key Difference |
|---------|-------------|-----------|----------------|
| Stripe | `stripe-node` | `@stripe/agent-toolkit` | Tool definitions vs fluent client; permission scoping |
| Neon | `@neondatabase/api-client` | `@neondatabase/toolkit` | Ephemeral lifecycle methods; 3 operations vs ~100 |
| Linear | `@linear/sdk` | `czottmann/linearis` (community) | JSON-only output; <1,000 token usage surface |
| Anthropic | `@anthropic-ai/sdk` | Agent SDK | Structured outputs; tool definitions; defer_loading |

#### What's Structurally Different

**1. Tool definitions instead of methods**

Human SDK:
```typescript
const issues = await loop.issues.list({ status: 'triage' });
```

Agent SDK (MCP / function calling):
```json
{
  "name": "loop_list_issues",
  "description": "List issues from Loop, filtered by status, type, or project. Use this to see what needs attention or find specific work items.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["triage", "open", "in_progress", "done"] },
      "limit": { "type": "integer", "default": 20 }
    }
  }
}
```

The description is load-bearing for agents. It's not documentation — it's a prompt that shapes agent behavior.

**2. Minimal surface area**

Agents don't benefit from comprehensive API coverage. They benefit from a small set of well-described tools that handle the cases they encounter. Stripe's agent toolkit exposes ~20 operations out of Stripe's 500+ API endpoints.

**3. Structured error objects**

Agents need errors they can act on:
```json
{ "error": "ISSUE_NOT_FOUND", "issue_id": "abc-123", "suggestion": "Use loop_list_issues to find valid IDs" }
```

Not:
```
Error: Request failed with status code 404
```

**4. Permission scoping**

Agents should not have write access unless they need it. An agent that only triages issues should not be able to delete projects. The agent toolkit should surface this through restricted key patterns or explicit scope declarations.

**5. Token-efficient responses**

Default response shapes for human SDKs often include rich metadata. Agent responses should be leaner:
```json
// Human SDK response
{ "id": "abc", "title": "...", "status": "...", "createdAt": "...", "updatedAt": "...", "creator": { ... }, "labels": [...], "comments": [...] }

// Agent response (minimal by default, expand on request)
{ "id": "abc", "title": "...", "status": "triage", "priority": 1 }
```

**6. Retry behavior and idempotency**

Agents operate in environments where retries are common. Every mutating operation should support idempotency keys. The Stripe pattern: automatic idempotency keys on all safe-to-retry operations.

---

## Detailed Analysis

### The "Loop Next" CLI Command as a Differentiator

Every CLI in this research follows the `<resource> <action>` grammar. Loop has an opportunity for a category-defining command: `loop next`.

```bash
$ loop next

Next item: LOP-47 — "Triage: PostHog conversion drop -12%"
Priority: URGENT  |  Type: triage_signal  |  Project: onboarding

Instructions:
  1. Review the PostHog data in the signal payload
  2. Check recent deployments in the last 48h
  3. Assess signal confidence and create hypothesis issue if real
  4. Mark this issue done with outcome notes

Related: LOP-45 (parent signal), LOP-23 (related hypothesis from last week)

$ loop next --json
{ "issue": { "id": "lop-47", ... }, "instructions": "...", "context": { ... } }
```

No other project management tool has a `next` command that returns fully-prepared agent instructions. This is Loop's CLI superpower. It's the dispatch endpoint made tangible.

### The Linear Community Signal

Linear has 8+ community CLIs. This is a powerful market signal: developers who use Linear in agent workflows are building the tools they need because Linear hasn't provided them. The most popular ones are explicitly "agent friendly."

This is the gap Loop can close natively. Loop is designed from the ground up for agents. Its CLI should not be an afterthought — it should be the primary agentic interface.

### SDK Generation vs Hand-Rolling

At Loop's stage, generating the SDK from the OpenAPI spec is the pragmatic path:

**Generation tools:**
- **Stainless** — built the SDKs for OpenAI, Cloudflare, Anthropic; produces idiomatic code with retries, pagination, types; Loop already has OpenAPI integration
- **Fern** — combines SDK generation + docs generation; good for multi-language
- **Speakeasy** — alternative to Stainless with multi-language support

**When to hand-roll:** Only if the generated SDK doesn't handle Loop-specific patterns well (e.g., the dispatch endpoint with its rich instruction payload may need custom handling that a generator won't get right).

Recommendation: **Generate the base SDK, then hand-write extensions** for Loop-specific workflows like dispatch and signal ingestion.

### The MCP Timing Question

The research surfaced a genuine debate about when to build MCP:

**Argument for building MCP sooner:** Claude Code (Loop's natural habitat given DorkOS integration) natively supports MCP. If Loop ships an MCP server, Claude Code agents can use Loop without any custom integration code — `loop_next_issue` just works in Claude's tool use. This is a zero-friction path to the core Loop workflow.

**Argument for deferring MCP:** The token efficiency problem is real. An auto-generated MCP from the full OpenAPI spec will expose 40+ tools and consume thousands of tokens of context per connection. A hand-crafted MCP with 6 focused tools is much more valuable but takes meaningful design effort.

**Resolution:** Ship auto-generated MCP quickly as an experiment (low effort if OpenAPI spec is clean), then hand-craft the agent-optimized version once you understand usage patterns.

---

## Recommendations for Loop

### Sequenced Build Plan

**Week 1-2: TypeScript SDK**
- Generate from OpenAPI spec using Stainless
- Hand-write the dispatch client (`loop.dispatch.next()`) since this is Loop's unique endpoint
- Publish as `@loop/sdk` on npm
- Primary use case: AI agents running in Node.js environments (Claude Code, Codex)

**Week 3-4: MCP Server (auto-generated)**
- Use OpenAPI-to-MCP tooling to generate quickly
- Expose as `npx @loop/mcp` or Docker image
- Test with Claude Code's MCP integration immediately
- Purpose: unblock the DorkOS integration and validate agent workflows

**Month 2: `loop` CLI**
- Build on top of the TypeScript SDK
- Lead with the `loop next` command — this is the killer feature
- Follow `gh` grammar for everything else
- Human-readable default + `--json` for everything
- Auth via env var + config file

**Month 3+: Agent Toolkit + refined MCP**
- `@loop/agent-toolkit` for LangChain/OpenAI Agents SDK/Vercel AI SDK integration
- Redesign MCP with minimal surface (<10 tools, <1,000 token description surface)
- Permission scoping via restricted API key patterns

### SDK Design Decisions

```typescript
// Client initialization (follow Stripe/OpenAI pattern)
const loop = new LoopClient({
  apiKey: process.env.LOOP_API_KEY,
  baseURL: 'https://api.looped.me', // or custom for self-hosted
  maxRetries: 2,
  timeout: 30000,
});

// Resource namespacing
loop.issues        // CRUD + relations + comments
loop.projects      // CRUD + goals
loop.goals         // CRUD
loop.signals       // ingest
loop.labels        // CRUD
loop.templates     // CRUD + versions + reviews
loop.dispatch      // next() — Loop's unique endpoint
loop.dashboard     // stats(), activity(), prompts()
```

### CLI Command Design

```
loop next [--json]                           # THE command
loop issues list [filters] [--json]
loop issues create [flags]
loop issues view <id> [--web]
loop issues start <id>                       # transition + show instructions
loop issues done <id> [--outcome "..."]
loop projects list [--json]
loop signals ingest --source <src> [flags]
loop auth login / logout / status
```

### What NOT to Build

- **Do not** build a full TUI (terminal UI with interactive panels). Jira-style interactive CLIs are beautiful but create friction for agent consumption. Keep it composable and scriptable.
- **Do not** build an MCP server that wraps every API endpoint. 6 agent-focused tools > 40 comprehensive tools.
- **Do not** hand-roll the base SDK if Stainless can generate it from your OpenAPI spec in a day.
- **Do not** build the agent toolkit before proving SDK + MCP usage. Build it when users ask for it.

---

## Research Gaps and Limitations

- No data on actual adoption rates / conversion from API-only to SDK integration for comparable tools
- Linear's official MCP server (if it exists) details were not found — the token count comparison came from a community tool's README
- Loop's OpenAPI spec completeness was not audited — SDK generation quality depends heavily on spec quality
- No data on whether Loop's target users (agent developers) prefer SDK vs MCP vs CLI as primary integration pattern

## Contradictions and Disputes

- **CLI vs MCP:** Some sources argue CLIs are sufficient for agents (because Claude Code can run shell commands). Others argue MCP is superior because it provides richer tool definitions. Both are valid — different contexts. The Zuplo article makes the strongest case that they serve different audiences (developers vs non-developers) and both should exist.

- **Thin wrapper vs convenience:** SDK design literature disagrees on how much convenience to bake in. Resolution: start thin, add a convenience layer in a separate package (Neon's approach).

- **Generate vs hand-roll:** Generated SDKs drift if the generation is not automated in CI. Hand-rolled SDKs can be more idiomatic but require more maintenance. For Loop at this stage, generate + extend is the right balance.

---

## Search Methodology

- Searches performed: 14
- Most productive search terms: "agent toolkit design patterns," "Linear CLI agent friendly," "Stripe agent-toolkit," "MCP vs SDK API builders," "CLI or MCP developer tools"
- Primary sources: GitHub READMEs (schpet/linear-cli, czottmann/linearis, stripe/agent-toolkit), official docs (Linear SDK, GitHub CLI, Neon toolkit), industry analysis (Pragmatic Engineer, osada.blog, zuplo.com)
