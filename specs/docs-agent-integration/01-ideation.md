---
slug: docs-agent-integration
number: 17
created: 2026-02-23
status: ideation
---

# Documentation Update — Agent Integration Surfaces

**Slug:** docs-agent-integration
**Author:** Claude Code
**Date:** 2026-02-23
**Related:** specs/agent-integration-strategy.md (Feature 7), specs/docs-update-post-mvp/

---

## 1) Intent & Assumptions

- **Task brief:** Update Loop's Fumadocs documentation site to cover all new agent integration surfaces shipped in Phase 1-2 of the agent integration strategy: API Key DX, MCP Server, Agent Discovery Layer, TypeScript SDK, Connect CLI, and Loop CLI. The docs need 8 major additions: rewritten Getting Started guide, MCP Server docs, Agent Skill docs, SDK reference, CLI reference, per-agent integration guides, API key management docs, and architecture overview.

- **Assumptions:**
  - All 6 prerequisite features (API Key DX, MCP Server, Agent Discovery Layer, TypeScript SDK, Connect CLI, Loop CLI) are built and merged
  - The existing Fumadocs site at `apps/web/` with MDX content in `docs/` is the target
  - We are pre-launch — no existing user habits or inbound links to preserve, so we can freely restructure
  - The primary audience is developers integrating AI agents (Claude Code, Cursor, Windsurf, OpenHands users)
  - Secondary audience is developers building custom integrations via SDK/API
  - All code examples should be runnable against the live API or self-hosted instance
  - No new Fumadocs plugins or custom components needed — existing `<Tabs>`, `<Steps>`, `<Cards>`, `<Callout>` cover all needs

- **Out of scope:**
  - Building any integration surfaces (Features 1-6 are already shipped)
  - Marketing site content (Feature 8: Marketing Site Update)
  - FTUE dashboard changes (Feature 9: FTUE Update)
  - Blog posts, changelog entries, social media content
  - Auto-generated TypeDoc output (hand-written SDK docs preferred per ADR 0031)
  - Contributing/developer setup guides (separate concern)
  - Python/Go SDK documentation (SDKs don't exist yet)

---

## 2) Pre-reading Log

### Documentation Infrastructure
- `apps/web/source.config.ts`: Fumadocs config pointing to `../../docs` directory
- `apps/web/src/lib/source.ts`: Source loader with `/docs` base URL
- `apps/web/src/app/(docs)/docs/[[...slug]]/page.tsx`: Catch-all MDX rendering route
- `apps/web/src/components/mdx-components.tsx`: Available MDX components (Steps, Tabs, Callout, APIPage, Cards)
- `docs/meta.json`: Root navigation — currently 8 top-level sections
- `docs/*/meta.json`: Per-section navigation configs

### Existing Documentation (80+ pages across 8 sections)
- `docs/getting-started/` (3 pages): index, quickstart, authentication — generic intro, needs agent-focused rewrite
- `docs/concepts/` (6 pages): index, issues, signals, dispatch, prompts, projects-and-goals — solid, keep as-is
- `docs/guides/` (3 pages): index, dashboard, writing-templates — keep, add new guides
- `docs/integrations/` (4 pages): index, github, posthog, sentry — webhook-only, needs agent platform expansion
- `docs/api/` (50+ pages): auto-generated from OpenAPI spec — keep as-is
- `docs/cli/` (8 pages): index + 7 command pages — needs new commands added
- `docs/self-hosting/` (4 pages): index, deployment, environment — keep as-is
- `docs/contributing/` (1 page): stub only

### Agent Integration Code Packages
- `packages/mcp/`: @dork-labs/loop-mcp — 9 agent tools, dual transport (stdio + HTTP)
- `packages/sdk/`: @dork-labs/loop-sdk — TypeScript SDK with 11 resource namespaces, LoopClient class
- `packages/types/`: @dork-labs/loop-types — shared Zod-inferred type definitions
- `packages/loop-skill/`: @dork-labs/loop — SKILL.md, AGENTS.md template, Cursor rules template, OpenHands microagent
- `apps/cli/`: @dork-labs/loop-cli — CLI with `loop next` as the killer command

### Agent Discovery Artifacts
- `apps/web/src/app/llms.txt/route.ts`: llms.txt endpoint indexing /docs/* pages
- `packages/loop-skill/SKILL.md`: Cross-agent skill definition (agentskills.io format)
- `AGENTS.md` (root): Linux Foundation standard repo-level context
- `.cursor/rules/loop.mdc` + `packages/loop-skill/templates/loop.mdc`: Cursor IDE rules
- `packages/loop-skill/templates/openhands-loop.md`: OpenHands microagent

### Related Specifications
- `specs/docs-update-post-mvp/01-ideation.md` (spec #6): Earlier docs ideation — OpenAPI infrastructure, initial 35+ MDX pages
- `specs/mcp-server/` (spec #11): MCP server architecture, 9 tools, dual transport
- `specs/agent-discovery-layer/` (spec #12): llms.txt, SKILL.md, AGENTS.md, Cursor rules, OpenHands
- `specs/api-key-dx/` (spec #10): `loop_` prefixed keys, auto-generation, error messages
- `specs/typescript-sdk/` (spec #13): SDK design, resource namespacing, pagination patterns
- `specs/loop-cli/` (spec #15): CLI refactor, `gh`-style grammar, output tiers
- `specs/connect-cli/` (spec #14): Setup CLI (npx @dork-labs/loop-connect)

### Architecture Decision Records
- ADR 0018: Use zod-to-openapi for API docs
- ADR 0023: Use `loop_` prefix for API keys
- ADR 0025: Dual-transport MCP package
- ADR 0026: Outcomes over operations tool design
- ADR 0027: Use @hono/mcp for HTTP transport
- ADR 0028: Content-only npm package for agent skill
- ADR 0030: Progressive disclosure across discovery artifacts
- ADR 0031: Hand-written SDK over generation
- ADR 0032: Shared types package for API types
- ADR 0033: Use ky for SDK HTTP layer
- ADR 0034: Use clack prompts for connect CLI
- ADR 0035: Use native fetch for connect CLI

---

## 3) Codebase Map

**Primary Components/Modules:**

| Path | Role |
|------|------|
| `docs/` | Monorepo-level MDX content directory |
| `docs/meta.json` | Root navigation config (8 sections → will grow to 12) |
| `apps/web/source.config.ts` | Fumadocs MDX source configuration |
| `apps/web/src/lib/source.ts` | Source loader, baseUrl: `/docs` |
| `apps/web/src/app/(docs)/` | Docs routing and rendering |
| `apps/web/src/components/mdx-components.tsx` | MDX component exports |

**Shared Dependencies:**
- `fumadocs-mdx` — MDX processing
- `fumadocs-core/source` — source loading
- `fumadocs-ui/components/*` — Steps, Tabs, Cards, Callout, Code Block
- `fumadocs-ui/page` — DocsPage, DocsBody, DocsTitle

**Data Flow:**
MDX files in `docs/` → `source.config.ts` reads them → `source.ts` exposes as pages → `[[...slug]]/page.tsx` renders with MDX components → Vercel deploys as static HTML

**Feature Flags/Config:**
- Fumadocs `meta.json` files control sidebar navigation and section ordering
- APIPage component available via `full: true` frontmatter for OpenAPI pages
- llms.txt route auto-indexes docs pages for AI agent discovery

**Potential Blast Radius:**
- **Direct changes:** ~25 new MDX pages, 4-5 meta.json updates, 3-4 existing page rewrites
- **Indirect:** llms.txt should auto-discover new pages (verify)
- **No code changes** — this is purely content + navigation config

---

## 4) Root Cause Analysis

N/A — this is a feature, not a bug fix.

---

## 5) Research

Full research document: `research/20260223_docs_agent_integration_architecture.md`

### Potential Solutions

**1. Additive Structure with Diátaxis Principles (Recommended)**

- Description: Keep topic-based navigation (developers think "I need SDK docs" not "I need a Reference"). Add 4 new top-level sections (agents/, mcp/, sdk/, skill/). Apply Diátaxis principles within each section — every page is clearly one of: tutorial, how-to, reference, or explanation.
- Pros:
  - Matches developer mental models (Stripe, Vercel, Supabase all use this pattern)
  - `agents/` landing page with decision tree answers the #1 question: "which surface do I use?"
  - Per-agent guides (Claude Code, Cursor, etc.) give complete opinionated paths
  - Each surface (SDK, MCP, CLI) gets standalone deep-linkable reference section
  - Clean pre-launch structure — no legacy constraints
- Cons:
  - Sidebar grows from 8 to 12 items (manageable but approaching crowded)
  - Some conceptual overlap between "Agents" and "Integrations" sections
- Complexity: Medium
- Maintenance: Low — each section is self-contained

**2. Full Diátaxis Restructure (Clean Slate)**

- Description: Reorganize everything into four quadrants: Tutorials, How-To Guides, Reference, Explanation
- Pros:
  - Theoretically cleanest information architecture
  - Industry-validated (Python, Ubuntu, Gatsby)
- Cons:
  - Developers think in topics, not quadrants — "I need SDK docs" not "I need a Reference"
  - No major developer tool docs site (Stripe, Vercel, Supabase, Linear) uses pure Diátaxis navigation
  - "Reference" as a nav item is less intuitive than "SDK Reference" or "CLI Reference"
- Complexity: High
- Maintenance: Medium — requires ongoing discipline to classify every page

**3. Surface-First Navigation**

- Description: Organize entirely around integration surfaces — each surface (API, SDK, CLI, MCP, Skill) has its own section with its own Getting Started, Reference, and Guides
- Pros: Maximally clear for developers who already know which surface they want
- Cons:
  - Core concepts (issues, signals, dispatch) get duplicated across sections
  - New users without context have no clear entry point
  - Doesn't match any major dev docs site's mental model
- Complexity: High
- Maintenance: High — content duplication across surfaces

**4. Tabbed Integration Guides (Twilio Model)**

- Description: Per-agent complete walkthrough pages where surfaces are covered inline rather than in standalone sections
- Pros: Excellent "I use Cursor, show me everything" UX
- Cons: SDK and CLI need standalone reference sections that don't fit this model; heavy duplication of MCP setup across 5 agent pages
- Complexity: Medium
- Maintenance: Medium — duplication creates drift risk

### Security Considerations

- API key docs must have security callouts on every page showing a key in code samples
- MCP config stores API key on disk — docs should recommend `env:` variable injection over hardcoding (`.mcp.json.example` already uses this pattern)
- Connect CLI docs should warn about shell history exposure with `--api-key` flags
- Webhook secrets already well-documented in `authentication.mdx` — new surfaces should cross-link, not re-explain

### Performance Considerations

- ~25 new static MDX pages — zero runtime impact (Fumadocs compiles to static HTML)
- Code examples should stay under 30 lines; longer examples in expandable blocks
- Mermaid diagrams for architecture page — consider pre-rendered SVG to avoid client-side layout shift
- llms.txt generation should be updated to include new agent integration pages

### Recommendation

**Implement Solution 1: Additive Structure with Diátaxis Principles applied within sections.** This is the approach used by every top-tier developer docs site (Stripe, Vercel, Supabase) and produces the best UX for Loop's two audiences: agent-integrating developers (who enter via `agents/` landing) and SDK/API developers (who enter via `sdk/` or `api/`).

---

## 6) Clarifications & Decisions

- **Decision 1: Documentation architecture** — Additive Structure with Diátaxis principles applied within each section. Topic-based navigation (agents/, sdk/, mcp/, cli/) rather than quadrant-based (Tutorials/, Reference/). User confirmed: "Which document structure is going to create the absolute best documents, and the best user experience? That's the approach we want to take." Pre-launch means no redirect concerns.

- **Open questions:** None

---

## Appendix A: Proposed Documentation Tree

```
docs/
├── index.mdx                          (update: add new surfaces to cards, update flow diagram)
├── meta.json                          (update: add agents, mcp, sdk, skill sections)
│
├── getting-started/
│   ├── meta.json                      (update: add api-keys page)
│   ├── index.mdx                      (rewrite: choose-your-path cards — MCP/SDK/CLI/REST)
│   ├── quickstart.mdx                 (rewrite: connect CLI → first issue → dispatch loop)
│   ├── authentication.mdx             (update: expand with loop_ key format, link to api-keys)
│   └── api-keys.mdx                   (NEW: dedicated API key management — generation, prefix, rotation, security)
│
├── concepts/
│   ├── meta.json                      (update: add architecture page)
│   ├── index.mdx                      (keep)
│   ├── issues.mdx                     (keep)
│   ├── signals.mdx                    (keep)
│   ├── dispatch.mdx                   (keep)
│   ├── prompts.mdx                    (keep)
│   ├── projects-and-goals.mdx         (keep)
│   └── architecture.mdx               (NEW: how MCP, SDK, CLI, REST API relate — Mermaid diagram)
│
├── agents/                            (NEW section)
│   ├── meta.json                      (NEW)
│   ├── index.mdx                      (NEW: decision tree — MCP vs Skill vs SDK vs CLI + agent cards)
│   ├── claude-code.mdx                (NEW: complete Claude Code integration — MCP + Skill + API key + verify)
│   ├── cursor.mdx                     (NEW: complete Cursor integration — MCP + rules + API key + verify)
│   ├── windsurf.mdx                   (NEW: complete Windsurf integration — MCP + API key + verify)
│   ├── openhands.mdx                  (NEW: complete OpenHands integration — microagent + API key + verify)
│   └── custom.mdx                     (NEW: generic HTTP poll pattern for any agent)
│
├── mcp/                               (NEW section)
│   ├── meta.json                      (NEW)
│   ├── index.mdx                      (NEW: overview + tabbed installation — Claude Code/Cursor/Windsurf/Claude Desktop)
│   ├── tools.mdx                      (NEW: all 9 tools with descriptions, parameters, examples)
│   └── troubleshooting.mdx            (NEW: common errors, .mcp.json config, env vars)
│
├── sdk/                               (NEW section)
│   ├── meta.json                      (NEW)
│   ├── index.mdx                      (NEW: LoopClient overview, install, first call, resource map)
│   ├── dispatch.mdx                   (NEW: dispatch.next(), dispatch.queue() — the core agent workflow)
│   ├── issues.mdx                     (NEW: issues.list/get/create/update/delete with examples)
│   ├── signals.mdx                    (NEW: signals.ingest() with typed payloads)
│   ├── projects.mdx                   (NEW: projects resource)
│   ├── goals.mdx                      (NEW: goals resource)
│   ├── templates.mdx                  (NEW: templates + versions + reviews)
│   ├── dashboard.mdx                  (NEW: dashboard.stats/activity/prompts)
│   └── errors.mdx                     (NEW: error classes, retry behavior, handling patterns)
│
├── skill/                             (NEW section)
│   ├── meta.json                      (NEW)
│   └── index.mdx                      (NEW: what is the Loop agent skill, install per editor, customization)
│
├── cli/
│   ├── meta.json                      (update: add new command pages)
│   ├── index.mdx                      (update: add new commands to reference table)
│   ├── issues.mdx                     (update: add start/done subcommands)
│   ├── dispatch.mdx                   (keep)
│   ├── signals.mdx                    (update for new command structure)
│   ├── status.mdx                     (keep)
│   ├── templates.mdx                  (keep)
│   ├── triage.mdx                     (keep)
│   ├── auth.mdx                       (NEW: loop auth login/logout/status)
│   ├── dashboard.mdx                  (NEW: loop dashboard)
│   ├── labels.mdx                     (NEW: loop labels list/create/delete)
│   └── completions.mdx                (NEW: shell completions setup — bash/zsh/fish)
│
├── guides/
│   ├── meta.json                      (update: add new guides)
│   ├── index.mdx                      (keep)
│   ├── dashboard.mdx                  (keep)
│   ├── writing-templates.mdx          (keep)
│   ├── connect-cli.mdx                (NEW: npx @dork-labs/loop-connect walkthrough)
│   └── agent-polling-loop.mdx         (NEW: building an autonomous agent polling loop)
│
├── integrations/
│   ├── meta.json                      (keep)
│   ├── index.mdx                      (update: add cross-links to agents/ section)
│   ├── github.mdx                     (keep)
│   ├── sentry.mdx                     (keep)
│   └── posthog.mdx                    (keep)
│
├── api/                               (keep: auto-generated from OpenAPI)
│   └── ... (50+ pages, no changes)
│
├── self-hosting/
│   └── ... (keep: 4 pages, no changes)
│
└── contributing/
    └── index.mdx                      (keep: stub, out of scope for this feature)
```

**Page count:** ~25 new pages + ~8 updated pages = ~33 pages touched
**New sections:** 4 (agents/, mcp/, sdk/, skill/)
**Sidebar items:** 8 → 12

### Appendix B: Key Design Patterns

**MCP Installation Tabs (Render/Stripe pattern):**
```mdx
<Tabs items={["Claude Code", "Cursor", "Windsurf", "Claude Desktop"]}>
  <Tab value="Claude Code">
    ```bash
    claude mcp add loop-mcp -- npx -y @dork-labs/loop-mcp
    ```
    Set your API key:
    ```bash
    export LOOP_API_KEY=loop_your_key_here
    ```
  </Tab>
  <Tab value="Cursor">
    Add to `.cursor/mcp.json`:
    ```json
    {
      "mcpServers": {
        "loop": {
          "command": "npx",
          "args": ["-y", "@dork-labs/loop-mcp"],
          "env": { "LOOP_API_KEY": "loop_your_key_here" }
        }
      }
    }
    ```
  </Tab>
  ...
</Tabs>
```

**Agent Decision Tree (agents/index.mdx landing):**
```
Are you integrating an AI agent with Loop?
├── Want zero-code setup in an existing IDE agent?
│   └── Use the MCP Server → /docs/mcp
├── Want to give your agent contextual instructions?
│   └── Use the Agent Skill → /docs/skill
├── Building a custom application or agent framework?
│   └── Use the TypeScript SDK → /docs/sdk
├── Automating Loop from scripts or CI?
│   └── Use the CLI → /docs/cli
└── Integrating from any other language or tool?
    └── Use the REST API directly → /docs/api
```

**SDK Reference Pages (hand-written with examples):**
Each SDK resource page follows the same structure:
1. Purpose statement (1 sentence)
2. Import / setup snippet
3. Methods table (name, params, return type, description)
4. Full example per method with realistic data
5. Error handling callout
6. Cross-links to related API endpoints and MCP tools

**Per-Agent Guides (complete opinionated paths):**
Each agent page covers the full setup in one place:
1. Prerequisites (API key)
2. Install MCP server (with platform-specific command)
3. Load Agent Skill (if supported)
4. Verify connection (run `loop_get_next_task`)
5. First dispatch cycle walkthrough
6. Troubleshooting for that specific platform

### Appendix C: Implementation Priority Order

| Priority | Pages | Rationale |
|----------|-------|-----------|
| 1 | `agents/index.mdx` | Answers the #1 new user question: "which surface do I use?" |
| 2 | `mcp/index.mdx` + `mcp/tools.mdx` | Highest-value surface for agent users; tabbed installation |
| 3 | `agents/claude-code.mdx`, `agents/cursor.mdx`, `agents/windsurf.mdx` | Per-agent complete guides for top 3 platforms |
| 4 | `skill/index.mdx` | Agent skill documentation |
| 5 | `sdk/index.mdx` + `sdk/dispatch.mdx` | SDK entry point + core dispatch workflow |
| 6 | Remaining SDK resource pages (7 pages) | Complete SDK reference |
| 7 | `getting-started/quickstart.mdx` rewrite + `getting-started/api-keys.mdx` | Onboarding flow with choose-your-path |
| 8 | New CLI command pages (4 pages) | auth, dashboard, labels, completions |
| 9 | `concepts/architecture.mdx` | Architecture overview with Mermaid diagram |
| 10 | `agents/openhands.mdx`, `agents/custom.mdx`, guides, troubleshooting | Remaining pages |

### Appendix D: Sources

- [Stripe API Documentation](https://docs.stripe.com/api) — three-column layout, language tabs, test key injection
- [Stripe "Building with LLMs"](https://docs.stripe.com/building-with-llms) — agent integration model with per-platform tabs
- [Diátaxis Framework](https://diataxis.fr/) — four-quadrant documentation taxonomy
- [Fumadocs — How to write good docs](https://fuma-nama.vercel.app/blog/good-docs) — organize by topic, eliminate duplication
- [Render MCP Server Docs](https://render.com/docs/mcp-server) — tabbed per-agent MCP installation pattern
- [LaunchDarkly Agent Skills Quickstart](https://launchdarkly.com/docs/tutorials/agent-skills-quickstart) — cross-platform agent installation
- [Command Line Interface Guidelines](https://clig.dev/) — CLI documentation best practices
- [ReadMe — Most Effective API Quickstarts](https://www.readme.com/resources/the-most-effective-api-quickstarts-in-8-examples/) — quickstart structural patterns
- [TypeDoc](https://typedoc.org/) — auto-generation evaluated and rejected for primary docs (ADR 0031)
- [Sequin — We fixed our docs with Diátaxis](https://blog.sequinstream.com/we-fixed-our-documentation-with-the-diataxis-framework/) — Diátaxis adoption case study
