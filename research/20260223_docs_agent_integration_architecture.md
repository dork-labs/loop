# Documentation Architecture for Loop Agent Integration Surfaces

**Feature:** docs-agent-integration
**Date:** 2026-02-23
**Mode:** Deep Research
**Searches performed:** 18
**Sources evaluated:** 30+

---

## Research Summary

Loop now has seven distinct integration surfaces — REST API, TypeScript SDK, CLI (`looped`), Connect CLI (`loop-connect`), MCP Server, Agent Skill (SKILL.md), and per-agent guides — but the current documentation covers only the API, original CLI, and basic concepts. Research across industry exemplars (Stripe, Twilio, LaunchDarkly, Render, Supabase) and documentation frameworks (Diátaxis, Fumadocs) reveals a clear best-practice architecture: organize documentation around user intent (not product structure), use Diátaxis's four quadrants as the skeleton, apply tabbed per-agent installation as the interaction pattern for MCP setup, keep SDK reference hand-written with inline examples, and structure CLI docs as command-per-page with a single index. The recommended architecture collapses all surfaces into one coherent "Integrate" section using choose-your-path entry cards rather than a surface-first hierarchy.

---

## Key Findings

### 1. Industry Exemplars and Their Core Patterns

**Stripe** is the universally cited benchmark. Their structural innovations:
- Three-column layout: navigation / prose / live code examples
- Test API keys auto-injected into code samples (eliminates copy-paste friction)
- Language tabs on every code block (curl, Node, Python, Go, Ruby)
- A tiered getting-started: quickstart → concepts → full API reference
- "Building with LLMs" page dedicated to agent/MCP integration with per-platform tabs for Claude, Claude Code, Cursor
- Documentation as a product discipline: shipped only when docs are written; docs count in performance reviews

**Twilio** pioneered the "quickstart per integration path" pattern:
- A top-level Quickstarts landing page with language/platform selectors
- Each quickstart is language-specific and walks exactly one complete path to a working result
- The same underlying API concept is documented N times — once per language — not as a single "here are all the options" page

**LaunchDarkly** (agent skills) introduced a clear cross-platform agent installation pattern:
- Single "Agent Skills Quickstart" page that covers all supported editors (Claude Code, Cursor, VS Code, Windsurf)
- `npx skills add` as the universal install command, with per-editor verification steps
- Template variables for dynamic per-invocation context
- The page is short enough to copy-paste from; heavy detail lives in per-editor reference pages

**Render** (MCP server) demonstrates the emerging MCP documentation standard:
- What / How It Works / Setup / Examples / Supported Actions / Limitations structure
- Tabbed interface within Setup — one tab per agent platform (Cursor, Claude Code, Claude Desktop, Windsurf)
- Each tab: config file location + code snippet with placeholder values + link to platform docs
- Setup is 3 steps: API key → tool config → workspace selection
- Examples section organized by use-case category (not by endpoint)

### 2. Diátaxis Framework — The Structural Backbone

The Diátaxis framework (used by Python, Ubuntu/Canonical, Gatsby) provides the strongest information architecture for developer tools. It identifies four distinct documentation types, each serving different user needs:

| Type | User need | User state | Loop examples |
|---|---|---|---|
| **Tutorials** | Learning-oriented, guided | Studying | Quickstart, "Your First Signal" |
| **How-to Guides** | Task-oriented, practical | Working | "Connect your MCP server", "Write a prompt template" |
| **Reference** | Information-oriented, accurate | Working | API endpoints, SDK methods, CLI commands |
| **Explanation** | Understanding-oriented | Studying | Concepts (signals, dispatch, issues, the loop) |

Anti-pattern: mixing types in one page. A concepts page that also has code samples mixes Explanation with How-to and confuses both audiences.

The Fumadocs author independently confirms this: "Organize by topic, eliminate duplication, build learning progressions, automate where possible."

### 3. SDK Reference: Hand-Written with Inline Examples Wins

Auto-generated TypeDoc output (pure generated HTML) fails because:
- Navigation becomes an API dump, not a mental model
- Method signatures without context examples require cross-referencing prose docs
- Generated output lacks the "when would I actually use this?" narrative layer

The industry pattern is a hybrid: **hand-written structure with TSDoc-comment-driven examples**. The SDK source already has TSDoc examples in it (e.g., `LoopClient`, `DispatchResource.next()`). The documentation strategy should be:
1. A hand-written "SDK Overview" page with the `LoopClient` instantiation pattern and the top-level resource map
2. Per-resource pages (hand-written) with: purpose statement, all methods as subsections, TypeScript type signatures shown as code, and at least one complete usage example per method
3. Error handling page covering all `Loop*Error` subclasses with when each is thrown
4. The TypeDoc-generated output can live at a secondary URL (e.g., `/docs/sdk/api-reference`) for deep-dive use; it should not be the primary SDK docs

### 4. CLI Reference: Command-Per-Page with a Single Index

Three approaches were evaluated:

| Approach | Pros | Cons |
|---|---|---|
| Single long page | Easy Ctrl+F search; no navigation overhead | Becomes unmaintainable at >10 commands; hard to deep-link |
| Command-per-page | Each command gets full treatment; good for SEO and deep-linking | Adds sidebar items; users may not discover related commands |
| Generated from --help | Always in sync with code | Output is terse; lacks examples and explanations |

The winner for Loop's scale (10+ commands, each with subcommands) is **command-per-page**, with:
- A single index page (already exists at `/docs/cli`) that acts as the quick reference table
- Per-command pages for commands with significant options: `looped list`, `looped triage`, `looped templates`, `looped dispatch`, `looped status`, `looped signals`
- The existing index structure already implements this correctly; the gap is that the underlying per-command pages need updating for new commands (`looped auth`, `looped dashboard`, `looped labels`, `looped completions`)

The "generated from --help" approach is good for inline terminal help (`--help` flags) but should not replace web documentation. The web docs should be richer.

### 5. MCP Server Documentation: Tabbed Per-Agent Installation

The emerging standard (observed in Render, Stripe, ClickUp, Postman, DigitalOcean) is:
- One MCP server documentation page
- Tabbed setup section with one tab per agent platform
- Universal structure per tab: (1) config file location, (2) JSON snippet with placeholder values, (3) verification step
- Platforms to cover: Claude Desktop, Claude Code, Cursor, Windsurf (in that order — from most general to most developer-focused)
- A "running locally" section for self-hosters
- A "supported tools" table listing all 9 tools with one-line descriptions

The `npx @dork-labs/loop-mcp` install pattern maps directly to this. The `.mcp.json.example` in the repo already has the correct JSON snippet format.

### 6. Agent Skill Documentation: Separate from MCP

SKILL.md / agent skill documentation has a different audience than MCP server docs:
- MCP: developers who want to give their agent structured tool access (function calls, structured I/O)
- Agent Skill: developers who want to give their agent contextual instructions (prose, curl examples, workflow guidance)

These serve different needs and should be separate pages, though cross-linked. The SKILL.md file already exists at `packages/loop-skill/SKILL.md`. The docs page should explain:
- What an agent skill is vs an MCP server (decision guide)
- How to install/load it in each supported editor (Claude Code, Cursor, Windsurf, Codex)
- The YAML frontmatter fields and their meaning
- When to use the skill alongside the MCP vs instead of it

### 7. Per-Agent Integration Guides: The "Connect" Pattern

Stripe's "Building with LLMs" page and LaunchDarkly's agent skills pattern both point toward a **per-agent integration guide** approach for new integration surfaces. This is analogous to Stripe Connect's per-platform documentation.

The pattern:
- A top-level "Agents" landing page with cards for each supported agent (Claude Code, Cursor, Windsurf, OpenHands, custom)
- Each agent gets its own page with the complete integration path: install MCP + load skill + configure API key + verify
- The per-agent page is opinionated and complete: it tells you exactly what to do for that specific agent, not "here are your options"
- Cross-links to MCP reference, Skill reference, and API key management

Anti-pattern to avoid: A "Supported Agents" page that is just a comparison table. Tables help discovery but do not serve the "I'm using Cursor, what do I do?" user who wants a complete walkthrough.

### 8. Architecture Overview: Diagrams over Prose

The Fumadocs author states: "Diagrams are the best way to showcase architecture or principles." The existing `docs/index.mdx` has an ASCII diagram that is functional but could be elevated. Best practices:
- Mermaid diagrams render natively in Fumadocs via MDX and are maintainable in source
- The C4 model suggests a "context diagram" (system and its external actors) and a "container diagram" (internal components)
- For developer tools docs, a "data flow" diagram works better than an organizational chart
- The diagram should answer: "What sends data to Loop? What reads from Loop? What happens in the middle?"

### 9. Getting Started Flow: Choose-Your-Path over Linear

The current quickstart is a single linear tutorial (self-host → clone → run API → hit endpoints). This works for developers who want to run Loop locally. But Loop now has cloud/hosted mode and multiple integration surfaces, which means the "getting started" flow should branch.

The Twilio/Stripe "choose your integration" model:
- Entry: "How are you using Loop?" (cards: Hosted / Self-hosted)
- Then: "How do you want to integrate?" (cards: MCP Server / TypeScript SDK / CLI / REST API)
- Each card leads to a minimal quickstart for that specific path
- A "Core concepts" section sits parallel to getting started, not inside it

The current quickstart is a good "self-host + REST API" path. It should become one of four quickstart variants, not the only one.

### 10. API Key Management — New Standalone Section

With `loop_` prefixed API keys (ADR 0023), API key management deserves its own documentation page (currently it is buried in the Authentication page). Best practices from Stripe and Supabase:
- Dedicated "API Keys" page in Getting Started or Settings section
- Explains the `loop_` prefix format and what it means
- Shows how to generate keys (UI walkthrough + API equivalent)
- Key rotation, revocation, environment separation (test vs production)
- Security best practices callout (never commit, use env vars, rotate on exposure)

---

## Detailed Analysis

### Current Documentation Gaps

Mapping the seven integration surfaces against the current docs structure:

| Surface | Current docs coverage | Gap |
|---|---|---|
| REST API | Full (API reference, quickstart) | Needs SDK code examples alongside curl |
| TypeScript SDK | None | Full new section needed |
| CLI (`looped`) | Partial (index + 6 command pages) | New commands need pages; auth command missing |
| Connect CLI (`loop-connect`) | None | New section or page needed |
| MCP Server | None | Full new section needed |
| Agent Skill (SKILL.md) | None | Full new section needed |
| Per-agent guides | None | Full new section needed |
| API Key management | Partial (buried in Auth page) | Dedicated page needed |
| Architecture overview | Minimal ASCII diagram | Richer diagram(s) needed |

### Proposed Documentation Structure

```
docs/
├── index.mdx                          (update: add new surfaces to cards)
├── getting-started/
│   ├── index.mdx                      (update: choose-your-path entry)
│   ├── quickstart.mdx                 (keep: self-host + REST API path)
│   ├── hosted-quickstart.mdx          (new: hosted cloud path)
│   ├── authentication.mdx             (keep: expand with loop_ key format)
│   └── api-keys.mdx                   (new: dedicated API key management)
├── concepts/
│   ├── index.mdx                      (keep)
│   ├── issues.mdx                     (keep)
│   ├── signals.mdx                    (keep)
│   ├── dispatch.mdx                   (keep)
│   ├── prompts.mdx                    (keep)
│   ├── projects-and-goals.mdx         (keep)
│   └── architecture.mdx               (new: overview diagram + surface map)
├── agents/                            (new section)
│   ├── index.mdx                      (new: landing with agent cards + MCP vs Skill decision)
│   ├── claude-code.mdx                (new: complete Claude Code integration guide)
│   ├── cursor.mdx                     (new: complete Cursor integration guide)
│   ├── windsurf.mdx                   (new: complete Windsurf integration guide)
│   ├── openhands.mdx                  (new: complete OpenHands integration guide)
│   └── custom.mdx                     (new: generic HTTP poll pattern for other agents)
├── mcp/                               (new section)
│   ├── index.mdx                      (new: overview + tabbed installation)
│   └── tools.mdx                      (new: all 9 tools with descriptions and examples)
├── sdk/                               (new section)
│   ├── index.mdx                      (new: LoopClient overview, install, first call)
│   ├── dispatch.mdx                   (new: dispatch.next(), dispatch.queue())
│   ├── issues.mdx                     (new: full issues resource)
│   ├── signals.mdx                    (new: signals.ingest())
│   ├── projects.mdx                   (new: projects resource)
│   ├── goals.mdx                      (new: goals resource)
│   ├── templates.mdx                  (new: templates + versions + reviews)
│   ├── dashboard.mdx                  (new: dashboard resource)
│   └── errors.mdx                     (new: error classes and handling patterns)
├── skill/                             (new section)
│   └── index.mdx                      (new: what is the Loop agent skill, install per editor)
├── cli/
│   ├── index.mdx                      (update: add new commands to table)
│   ├── issues.mdx                     (keep: update for new subcommands)
│   ├── signals.mdx                    (new: replaces old; covers looped signals)
│   ├── triage.mdx                     (keep)
│   ├── templates.mdx                  (keep)
│   ├── dispatch.mdx                   (keep)
│   ├── status.mdx                     (keep)
│   ├── auth.mdx                       (new: looped auth login/logout/whoami)
│   ├── dashboard.mdx                  (new: looped dashboard)
│   ├── labels.mdx                     (new: looped labels)
│   └── completions.mdx                (new: shell completions setup)
├── guides/
│   ├── dashboard.mdx                  (keep)
│   ├── writing-templates.mdx          (keep)
│   ├── connect-cli.mdx                (new: loop-connect npx setup guide)
│   └── agent-polling-loop.mdx         (new: building an autonomous polling loop)
├── integrations/
│   ├── index.mdx                      (keep: expand to include MCP integrations)
│   ├── github.mdx                     (keep)
│   ├── sentry.mdx                     (keep)
│   └── posthog.mdx                    (keep)
├── api/                               (keep: auto-generated, no changes needed)
├── self-hosting/                      (keep)
└── contributing/                      (keep)
```

This structure adds ~25 new pages while keeping all existing content intact.

### Fumadocs-Specific Implementation Notes

The existing docs already use Fumadocs components well:
- `<Tabs>` / `<Tab>` — use for per-agent MCP installation tabs
- `<Steps>` / `<Step>` — use for quickstart flows and per-agent setup guides
- `<Cards>` / `<Card>` — use for the agents landing page and the new getting-started choose-your-path
- `<Callout>` — use for security warnings on API key pages and deprecation notices

New Fumadocs components to introduce:
- The sidebar should use `_meta.json` files (or Fumadocs' `meta` convention) to create section groupings with custom labels
- The `agents/` section should appear above `sdk/` in the sidebar since MCP/skill is the zero-config path

### The MCP vs SDK vs CLI Decision Guide

This is the most important piece of "architecture explanation" content that does not yet exist. Developers approaching Loop from an agent context need to understand when to use each surface:

```
Are you building an AI agent that needs to use Loop?
├── Want zero-code setup in an existing IDE agent?
│   └── Use the MCP Server — npx install, JSON config, done
├── Want to give your agent instructions, not just tools?
│   └── Use the Agent Skill — load the SKILL.md, agent gets context
├── Building a custom application or agent framework?
│   └── Use the TypeScript SDK — full type-safe client
├── Automating Loop from scripts or CI?
│   └── Use the CLI — looped commands in shell
└── Integrating with Loop from any other language or tool?
    └── Use the REST API directly
```

This decision tree should appear on the `agents/index.mdx` landing page and as a condensed callout in the SDK and MCP index pages.

---

## Potential Solutions

### Solution 1: Full Diátaxis Restructure (Clean Slate)

Complete reorganization of the entire docs tree into the four Diátaxis quadrants: Tutorials, How-To Guides, Reference, Explanation. Every page is assigned to one quadrant and moved.

**Pros:**
- Maximally clean information architecture; each page has a single clear purpose
- Eliminates the current mixing of tutorial content with concept explanations
- Industry-validated (Python, Ubuntu, Gatsby)

**Cons:**
- Requires moving existing pages, breaking inbound links (unless redirects are added)
- Fumadocs sidebar organization would need custom `_meta.json` work to match quadrant labels
- Higher migration effort; existing Getting Started / Concepts / Guides / API structure is already a reasonable approximation of Diátaxis
- "Reference" as a top-level nav item is less intuitive than "API Reference" and "CLI Reference"

**Effort:** High (refactor all existing + add new)
**Risk:** Medium (link breakage, disorientation for existing users)

### Solution 2: Additive Structure (Recommended)

Keep the existing top-level sections (Getting Started, Concepts, Guides, API Reference, CLI, Integrations, Self-Hosting, Contributing). Add three new sections alongside them: `Agents`, `MCP`, `SDK`. Add new pages within existing sections where natural (authentication expansion, new CLI commands, architecture concept page). The `Skill` surface gets a page in `Agents` rather than its own section.

**Pros:**
- Preserves all existing URLs (zero link breakage)
- Adds all missing surfaces with clear homes
- Lower implementation risk; can be done page-by-page
- Most familiar to existing users
- Aligns with how Stripe, Vercel, Supabase add new surface coverage: alongside existing structure, not replacing it

**Cons:**
- The top-level navigation grows from 8 items to 11 items, which may start to feel crowded
- Some conceptual overlap remains (e.g., "Agents" and "Integrations" may feel similar to new users)
- The Concepts section still mixes explanation with some how-to content

**Effort:** Medium (add new; update index pages and sidebar)
**Risk:** Low

### Solution 3: Surface-First Navigation

Reorganize navigation entirely around integration surfaces: API, SDK, CLI, MCP, Skill, REST. Each surface has its own section with its own Getting Started, Reference, and Guides sub-pages.

**Pros:**
- Maximally clear for developers who already know which surface they want
- Each section is self-contained; no cross-referencing required

**Cons:**
- Core concepts (issues, signals, dispatch) become duplicated across sections or require a shared "Concepts" section that sits awkwardly outside the surface sections
- New users without prior context ("I just signed up, what do I do?") have no clear entry point
- The "Getting Started" flow disappears as a concept
- Does not match the mental model of any major developer documentation site

**Effort:** High
**Risk:** High (disorientation for all users)

### Solution 4: Tabbed Integration Guides (Twilio Model)

Create a single "Integrations" section where each integration guide is a top-level page (like Twilio's quickstart-per-language model). Every agent type gets its own complete walkthrough page. Surfaces (SDK, MCP, CLI) are covered within the relevant agent page rather than getting their own reference sections.

**Pros:**
- Excellent for "I use Cursor, show me everything I need" user journey
- Minimal navigation complexity
- Clear opinionated paths (no decision paralysis)

**Cons:**
- SDK and CLI reference docs cannot live in this model — they need standalone reference sections
- Heavy duplication if MCP setup instructions appear in 5 different agent pages
- The "build your own agent" use case (custom HTTP polling) has no clean home

**Effort:** Medium
**Risk:** Low, but limits future documentation growth

---

## Security Considerations

1. **API key documentation** must have prominent security callouts on every page that shows an API key in a code sample. The existing `authentication.mdx` has this pattern; it must be replicated in SDK, CLI auth, and MCP setup pages. The `loop_` prefix format should be called out specifically — it is intentional and allows secret scanning tools to detect exposed keys.

2. **MCP server configuration** stores the API key in a JSON config file on disk. Documentation should note the file permission implications and recommend `LOOP_API_KEY` environment variable injection rather than hardcoding in the JSON (the `.mcp.json.example` format already uses `env:` — docs should reinforce this is the preferred approach).

3. **Connect CLI** (`npx @dork-labs/loop-connect`) runs as an npx invocation. Documentation should note that users should verify the package name before running, and should never run with `--api-key` flag values that could appear in shell history. Recommend environment variable approach.

4. **Webhook secrets** are already well-documented in `authentication.mdx`. No changes needed to the security model, just ensure new surfaces reference back to that page rather than re-explaining webhook auth inline.

---

## Performance Considerations

1. **Page weight**: Fumadocs with MDX compiles to static HTML at build time. Adding ~25 new pages has no runtime performance impact. The only concern is build time, which scales linearly with page count.

2. **Code examples**: Large TypeScript code blocks in SDK reference pages may slow initial page paint on mobile. Best practice is to keep examples under 30 lines; longer examples should be in expandable `<Accordion>` blocks or linked to GitHub.

3. **Diagrams**: Mermaid diagrams in MDX are rendered client-side by default in most Next.js setups. If the architecture page uses multiple complex Mermaid diagrams, consider using static SVG exports instead to avoid layout shift. The existing ASCII diagram in `docs/index.mdx` avoids this problem entirely and should be kept as-is or upgraded to a Mermaid diagram that pre-renders to SVG at build time.

4. **llms.txt compatibility**: The new docs structure should maintain the existing `llms.txt` at `looped.me/llms.txt`. As new pages are added, the sitemap and `llms.txt` generation should be updated to include new agent integration surface pages. LLMs accessing Loop's documentation via `llms.txt` should be able to discover the MCP, SDK, and Skill pages.

---

## Contradictions and Disputes

**Auto-generated vs hand-written SDK docs**: The TypeDoc ecosystem argues that auto-generated docs are "always in sync." This is true for type signatures but not for usage examples and narrative context. The Stripe model (hand-written with embedded code that is tested separately) produces better developer experience. The tradeoff is maintenance burden. For Loop's scale (11 resource classes, ~50 methods), hand-written docs are maintainable. At 500+ methods, the calculus would shift toward generation.

**Single long page vs command-per-page for CLI**: `clig.dev` and `bettercli.org` both recommend that `--help` output be comprehensive enough for terminal use. This argues for a single reference page. But web documentation is a different medium — it supports deep linking, search, and richer examples. Both approaches can coexist: terminal `--help` for quick reference, web docs per-command for complete examples and explanation.

**Tabs vs separate pages for per-agent instructions**: The Render model (tabbed) and the Stripe model (separate per-platform pages linked from a landing) are both valid. Tabs work well when the per-agent differences are small (just a config file location). Separate pages work better when each agent has a meaningfully different integration story. For Loop: MCP installation differences between agents are small (config file location only) → use tabs. Full agent integration guides (MCP + Skill + API key + verification) are richer → use separate pages in the `agents/` section.

---

## Recommendation

**Implement Solution 2 (Additive Structure)** with three refinements drawn from the exemplar research:

**Refinement 1: Add a dedicated `agents/` section as the primary entry point for the new surfaces.** This section sits above `sdk/` and `mcp/` in the sidebar. It serves the most common new user question: "I'm building an agent — what do I use?" The landing page has the decision tree (MCP vs Skill vs SDK vs CLI) and agent-specific cards (Claude Code, Cursor, Windsurf, OpenHands, custom). Each agent card leads to a self-contained integration page.

**Refinement 2: MCP docs use the Render/Stripe tabbed pattern.** One `mcp/index.mdx` page with Fumadocs `<Tabs>` for Claude Desktop, Claude Code, Cursor, Windsurf. Each tab shows: config file location + JSON snippet + verification step. A separate `mcp/tools.mdx` catalogs all 9 tools. This avoids duplication while keeping per-agent instructions discoverable.

**Refinement 3: SDK docs follow the hybrid hand-written + TSDoc pattern.** The existing SDK source already has TSDoc comments and `@example` blocks in the right places (`LoopClient`, `DispatchResource.next()`). The docs should extract and expand these examples into full narrative pages organized by resource. Start with `dispatch.mdx` (the core agent workflow) and `issues.mdx` (the most-used resource), then add the rest.

**Priority order for implementation:**
1. `agents/index.mdx` — decision tree + agent cards (answers the "what do I use?" question first)
2. `mcp/index.mdx` — tabbed MCP installation (highest-value surface for agent users)
3. `agents/claude-code.mdx`, `agents/cursor.mdx`, `agents/windsurf.mdx` — per-agent complete guides
4. `skill/index.mdx` — agent skill documentation
5. `sdk/index.mdx` + `sdk/dispatch.mdx` — SDK entry point + core dispatch workflow
6. Remaining SDK resource pages
7. New CLI command pages (`auth`, `dashboard`, `labels`, `completions`)
8. `getting-started/api-keys.mdx` — dedicated API key management
9. `concepts/architecture.mdx` — architecture overview with diagram
10. `getting-started/index.mdx` update — choose-your-path cards

**What to avoid:**
- Do not reorganize existing pages (preserves URLs and existing user mental models)
- Do not use TypeDoc-generated output as the primary SDK docs (produces API dumps, not documentation)
- Do not create a single "all agents" comparison table as the only agent integration resource (tables aid discovery but do not serve the "what do I do?" user)
- Do not duplicate MCP installation instructions across per-agent pages (use the tabbed MCP page and deep-link to the relevant tab from each agent page)

---

## Sources and Evidence

- Stripe three-column layout and interactive docs culture: [Why Stripe's API Docs Are the Benchmark](https://apidog.com/blog/stripe-docs/)
- Stripe "Building with LLMs" agent integration model: [Build on Stripe with LLMs](https://docs.stripe.com/building-with-llms)
- Stripe custom docs tooling: [How Stripe builds interactive docs with Markdoc](https://stripe.com/blog/markdoc)
- Diátaxis four-quadrant framework: [Diátaxis](https://diataxis.fr/)
- Fumadocs author on writing good docs: [Fuma Nama — How to write a good docs](https://fuma-nama.vercel.app/blog/good-docs)
- Render MCP server documentation pattern: [Render MCP Server Docs](https://render.com/docs/mcp-server)
- LaunchDarkly agent skills cross-platform pattern: [LaunchDarkly Agent Skills Quickstart](https://launchdarkly.com/docs/tutorials/agent-skills-quickstart)
- CLI documentation best practices: [Command Line Interface Guidelines](https://clig.dev/)
- API quickstart structural patterns: [ReadMe — Most Effective API Quickstarts](https://www.readme.com/resources/the-most-effective-api-quickstarts-in-8-examples/)
- MCP setup across Claude Code, Cursor, Windsurf: [YourGPT MCP Setup Guide](https://help.yourgpt.ai/article/mcp-setup-guide-for-claude-desktop-cursor-and-windsurf-1789)
- TypeDoc auto-generation: [TypeDoc](https://typedoc.org/)
- Fumadocs framework: [Fumadocs](https://www.fumadocs.dev/)
- Diátaxis adoption at Sequin: [We fixed our documentation with Diátaxis](https://blog.sequinstream.com/we-fixed-our-documentation-with-the-diataxis-framework/)
- Architecture diagram best practices: [Atlassian — Architecture Diagrams](https://www.atlassian.com/work-management/project-management/architecture-diagram)
- AGENTS.md universal standard: [AGENTS.md: One File to Guide Them All](https://layer5.io/blog/ai/agentsmd-one-file-to-guide-them-all/)
- Twilio quickstart per-platform pattern: [Twilio Docs](https://www.twilio.com/docs)

---

## Research Gaps and Limitations

- Could not locate a direct comparison of Fumadocs sidebar performance for documentation sets >100 pages; the new structure (~85 pages) should be fine but this is an assumption.
- The "Connect CLI" (`npx @dork-labs/loop-connect`) package was identified in the git commit history but its source was not available for review. The documentation recommendation assumes it follows the standard Loop authentication model.
- No data on what percentage of Loop's current users are humans vs agents accessing docs programmatically (via `llms.txt`). This would affect prioritization of machine-readable vs human-readable documentation formats.
- Fumadocs tabs deep-linking behavior (whether a URL can encode which tab is active) was not verified. If tabs are not deep-linkable, per-agent pages in the `agents/` section become more important as the canonical URL for sharing.

---

## Search Methodology

- Searches performed: 18
- Most productive search terms: "Render MCP server docs", "LaunchDarkly agent skills quickstart", "Stripe building with LLMs", "Diátaxis framework developer tools", "CLI documentation command-per-page vs single page"
- Primary information sources: stripe.com, render.com, launchdarkly.com, diataxis.fr, fumadocs.dev, clig.dev, apidog.com
- Codebase files reviewed: `docs/index.mdx`, `docs/getting-started/quickstart.mdx`, `docs/getting-started/authentication.mdx`, `docs/cli/index.mdx`, `packages/mcp/src/index.ts`, `packages/mcp/src/tools/index.ts`, `packages/mcp/.mcp.json.example`, `packages/sdk/src/index.ts`, `packages/sdk/src/client.ts`, `packages/sdk/src/resources/dispatch.ts`, `packages/loop-skill/SKILL.md`
