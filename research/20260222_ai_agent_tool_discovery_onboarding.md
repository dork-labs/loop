# AI Agent Tool Discovery & Onboarding Patterns

**Date:** 2026-02-22
**Research Mode:** Deep Research
**Searches Performed:** 18
**Sources:** 30+ primary and secondary sources

---

## Research Summary

The AI coding agent ecosystem has rapidly converged on a layered set of standards for teaching agents about tools and services. There are now three complementary tiers: (1) plain-markdown project instruction files (CLAUDE.md, AGENTS.md, .cursorrules), which give agents persistent project context; (2) the Agent Skills open standard (SKILL.md at agentskills.io), which packages reusable, cross-agent capabilities into distributable units; and (3) MCP (Model Context Protocol), which exposes live, authenticated tool access to remote services. Products are increasingly shipping all three — an instruction file for context, a skill for workflows, and an MCP server for live API access — and "one-click" deeplink installation is emerging as the standard friction-reduction pattern.

---

## Key Findings

### 1. Every Major Agent Has Its Own Instruction File Format (But Convergence Is Happening)

Each agent reads a different file by default, but the content structure is nearly identical: project purpose, setup commands, coding conventions, and architecture notes. The Linux Foundation's Agentic AI Foundation now stewards `AGENTS.md` as the canonical cross-agent standard (60k+ projects), with individual tools either reading it natively or accepting symlinks from their own file.

### 2. The Agent Skills Open Standard Is the Most Significant Development of Late 2025

Anthropic published `SKILL.md` / agentskills.io as an open standard in late 2025. Within two months, OpenAI added support to Codex CLI, and VS Code Copilot, Cursor, Amp, Goose, and others followed. Skills use a three-tier progressive disclosure model (metadata → instructions → supporting files) that solves the context window bloat problem that plagued earlier approaches.

### 3. MCP Is Infrastructure; Skills Are the Interface

MCP provides the runtime connection to external tools (authentication, live data, API calls). Skills package the *workflow instructions* for using those tools. The best agent-first products (Stripe, Langfuse, DevCycle, Datadog) ship both: an MCP server for capability + a skill for guidance on how to use it.

### 4. "One-Click" Installation Is the New Standard

The friction of configuring MCP servers manually (editing JSON config files) has been largely eliminated through deeplinks (`cursor://`, `claude://` protocols), `.mcpb` desktop extension bundles, and "Add to Cursor / Add to Claude" buttons on product websites. DevCycle achieved 3x SDK install rates after moving to this model.

### 5. What Fails Without Agent-First Design

Giving an agent raw API docs produces high-confidence hallucinations, wrong endpoint calls, and silent failures. Agents need: (a) task-scoped context not reference manuals, (b) explicit "gotchas" and auth patterns, (c) decision tables not prose descriptions, and (d) knowing what *not* to do as much as what to do.

---

## Detailed Analysis

### Claude Code Integration Patterns

#### CLAUDE.md: Persistent Project Context

`CLAUDE.md` is read at the start of every Claude Code session. It serves as "configuration that Claude automatically incorporates into every conversation." Key characteristics:

- **Location hierarchy**: Enterprise (`managed settings`) > Personal (`~/.claude/CLAUDE.md`) > Project (`./.claude/CLAUDE.md` or `./CLAUDE.md`)
- **Import syntax**: `@path/to/file` pulls in external files, keeping the main file lean
- **`.claude/rules/` directory**: All `.md` files in this directory load with same priority as CLAUDE.md — supports splitting instructions into focused rule files
- **Monorepo support**: Nested `.claude/` directories in subdirectories are loaded automatically when working in that path
- **Auto-memory (v2.1.32+)**: Claude now writes its own `~/.claude/projects/{project}/memory/MEMORY.md` for personal working preferences, separate from team-shared CLAUDE.md

The best CLAUDE.md files document: dependency versions, architectural patterns, non-standard conventions, custom tool usage examples, git commit formats, and test/lint commands. They avoid prose walls — bullet points and concrete examples outperform paragraphs.

#### Skills: The Distributable Capability Unit

**Anatomy of a skill:**

```
my-skill/
├── SKILL.md           # Required entrypoint (frontmatter + instructions)
├── references/        # Detailed docs loaded on-demand
├── scripts/           # Executable code Claude can run
└── assets/            # Templates, schemas, data files
```

**SKILL.md frontmatter fields:**

```yaml
---
name: skill-name              # Becomes /skill-name slash command
description: "..."            # Claude uses this to decide when to auto-invoke
disable-model-invocation: true  # Only user can invoke (e.g. /deploy)
user-invocable: false         # Only Claude can invoke (background knowledge)
allowed-tools: Read, Grep     # Pre-approved tools for this skill
context: fork                 # Run in isolated subagent
agent: Explore                # Which built-in agent type to use
model: claude-opus-4-6        # Override model for this skill
---
```

**Progressive disclosure (critical design principle):**
1. **Metadata (~100 tokens)**: `name` + `description` are always in context
2. **Instructions (<5000 tokens recommended)**: Full SKILL.md body loads when skill is activated
3. **Resources (as needed)**: Files in `references/`, `scripts/`, `assets/` only load when referenced

This solves context budget exhaustion — a common failure mode when teams dump all documentation into a single CLAUDE.md.

**Dynamic context injection** (powerful pattern):

```yaml
---
name: pr-summary
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`

## Your task
Summarize this pull request...
```

The `!`command`` syntax executes shell commands *before* Claude sees anything. Real data gets injected, not commands.

**Invocation control matrix:**

| Frontmatter | User can invoke | Claude auto-invokes | In context |
|---|---|---|---|
| (default) | Yes | Yes | Description always |
| `disable-model-invocation: true` | Yes | No | Not in context |
| `user-invocable: false` | No | Yes | Description always |

**Distribution scopes:**
- **Project**: Commit `.claude/skills/` to version control — all team members get it
- **Personal**: `~/.claude/skills/` — available across all your projects
- **Plugin**: `<plugin>/skills/` — bundled with a Claude plugin
- **Enterprise**: Managed settings push — organization-wide

**Skills can be installed via npm through the `openskills` package:**

```bash
npm i -g openskills
openskills install loop-triage  # hypothetical
```

The `openskills` package is a universal installer that works across Claude Code, Cursor, Windsurf, Aider, Codex, and anything reading AGENTS.md.

#### Custom Slash Commands (Now Subsumed Into Skills)

Legacy `.claude/commands/review.md` files still work and create `/review`. Skills are the preferred mechanism going forward — same capability, plus supporting files, frontmatter control, and subagent execution.

#### Claude Plugins

Anthropic launched the plugin marketplace in December 2025 with 36 curated plugins. A plugin is a package containing:
- `skills/` directory
- MCP server configuration
- Other extensions

Plugins create a distributable bundle that installs with a single click, enabling the "drop this into your project" integration pattern.

---

### Cursor Integration Patterns

#### Evolution: .cursorrules → .cursor/rules/*.mdc

Cursor has migrated from a single `.cursorrules` file (still functional, now legacy) to a modern directory system:

```
.cursor/
└── rules/
    ├── global-style.mdc
    ├── api-conventions.mdc
    └── testing-patterns.mdc
```

**MDC frontmatter structure:**

```yaml
---
description: "TypeScript API conventions for Hono routes"
globs: ["apps/api/src/**/*.ts"]
alwaysApply: false
---
```

- `globs`: File patterns that **auto-activate** the rule when matching files are in context
- `alwaysApply: true`: Rule loaded in every chat session
- `alwaysApply: false` (default): Description shown to agent, which decides whether to load it
- `description`: Agent reads this to decide relevance when `alwaysApply` is false

This is semantically equivalent to Claude Code's `user-invocable: false` + auto-description approach.

#### Cursor MCP Configuration

Stored in `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "loop": {
      "url": "https://api.looped.me/mcp",
      "headers": { "Authorization": "Bearer ${LOOP_API_KEY}" }
    }
  }
}
```

"Add to Cursor" deeplinks trigger one-click installation:
```
cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=<BASE64_JSON>
```

Cursor has a directory at `cursor.directory/mcp` listing available MCP servers, functioning like an app store for agent tools.

---

### OpenHands (formerly OpenDevin) / OpenClaw Patterns

OpenHands uses a `.openhands/` directory in the repository root for project-specific configuration:

#### Directory Structure

```
.openhands/
└── microagents/
    ├── repo.md                  # Repository-level instructions (always loaded)
    ├── knowledge/
    │   └── github-api.md        # Triggered by keywords in conversation
    └── tasks/
        └── pr-review.md         # Step-by-step task workflows
```

#### repo.md Format

`repo.md` is the equivalent of CLAUDE.md — loaded automatically whenever OpenHands works with the repository. It should contain:
- Project purpose and architecture
- Setup and build commands
- CI/CD workflow descriptions
- Development guidelines

YAML frontmatter is optional (default agent is `CodeActAgent`).

#### Knowledge Microagents

These are triggered by **keywords** appearing in the conversation, not file context. When a user mentions "GitHub API" or "React hooks," the matching knowledge microagent is injected. They live in `.openhands/microagents/knowledge/` with frontmatter specifying trigger terms.

This is a keyword-based relevance model versus Claude Code's description-embedding approach — different mechanism, similar intent.

#### MCP Integration

Repo microagents can define MCP tools that are exposed to the agent. The `get_microagent_mcp_tools()` method collects these tools from the microagent definitions. This means any repository can extend OpenHands's tool set by declaring MCP tools in microagent files.

#### Teaching OpenHands About a New API

1. Create `.openhands/microagents/knowledge/your-api.md` with trigger keywords
2. Include auth patterns, common operations, error handling, gotchas
3. Optionally declare MCP tools in the frontmatter
4. OpenHands loads the microagent when users invoke matching keywords

---

### The Agent Skills Open Standard (agentskills.io)

This is the most important cross-agent standard that emerged in late 2025.

#### Specification (canonical from agentskills.io)

**Minimum viable skill:**

```
skill-name/
└── SKILL.md
```

**Full SKILL.md structure:**

```yaml
---
name: pdf-processing           # Required: kebab-case, max 64 chars
description: "Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDFs, forms, or document extraction."  # Required: max 1024 chars
license: Apache-2.0            # Optional
compatibility: "Requires poppler-utils"  # Optional: environment requirements
metadata:                      # Optional: arbitrary key-value
  author: dork-labs
  version: "1.0"
allowed-tools: Read Bash(python *)  # Optional (experimental): pre-approved tools
---

## Instructions

[Markdown instructions, no format restrictions]
```

**Optional directory structure:**

```
skill-name/
├── SKILL.md               # Required
├── scripts/               # Executable code agents can run
├── references/            # REFERENCE.md, domain-specific docs (loaded on demand)
└── assets/                # Templates, images, schemas
```

#### Progressive Disclosure Model

The specification formally defines three tiers:
1. **Metadata (~100 tokens)**: `name` + `description` pre-loaded at startup for every skill
2. **Instructions (<5000 tokens recommended)**: Full SKILL.md body loaded on activation
3. **Resources (as needed)**: Supporting files loaded only when referenced by the agent

#### Adoption

Within two months of Anthropic publishing the standard (late 2025), the following platforms adopted it:
- **Claude Code** (originator, most features)
- **OpenAI Codex CLI** (quietly added support)
- **GitHub Copilot / VS Code** (official VS Code docs cover agent skills)
- **Cursor** (via agentskills.io compatibility)
- **Amp, Letta, Goose, OpenCode** (listed on agentskills.io homepage)

The standard is validated using `skills-ref`:

```bash
skills-ref validate ./my-skill
```

**The skill marketplace landscape:**
- `agentskills.io` — reference implementation and specification
- `skillsmp.com` (SkillsMP) — skills marketplace for Claude, Codex, and other agents
- `playbooks.com` — community skills repository
- `github.com/anthropics/skills` — Anthropic's official skills repo
- `npm:openskills` — universal CLI installer (`npm i -g openskills`)

---

### AGENTS.md: The Cross-Agent Instruction Standard

**Governed by:** Agentic AI Foundation (Linux Foundation)
**Adoption:** 60,000+ open-source projects

AGENTS.md is plain Markdown, no required frontmatter, no required sections. It emerged from collaborative work between OpenAI Codex, Amp, Jules (Google), Cursor, and Factory.

**Tools that read AGENTS.md natively (2025-2026):**

| Tool | Native Support | Alternative File |
|---|---|---|
| OpenAI Codex CLI | Native | — |
| Windsurf | Native | Also reads `.windsurfrules` |
| Aider | Via `--read` flag | `CONVENTIONS.md` |
| Google Jules | Native | — |
| Factory | Native | — |
| GitHub Copilot (coding agent) | Native | — |
| Cursor | Via symlink | `.cursorrules` / `.cursor/rules/` |
| Claude Code | Via symlink or manual | `CLAUDE.md` |
| Devin | Native | — |
| Goose (Block) | Native | — |

**Hierarchical scoping:** The closest `AGENTS.md` to the edited file wins. A monorepo can have:
```
AGENTS.md           # Global instructions
packages/
  api/
    AGENTS.md       # API-specific overrides
  frontend/
    AGENTS.md       # Frontend-specific overrides
```

**What belongs in AGENTS.md:**
- Build and test commands
- Code style rules with examples
- Testing requirements (coverage thresholds, patterns)
- Security gotchas
- Architecture decisions affecting everyday code
- PR and commit conventions

---

### llms.txt: Web Content for Agent Consumption

**Origin:** Proposed by Jeremy Howard (FastAI), standardized at llmstxt.org
**Adoption:** 844,000+ websites as of October 2025 (BuiltWith)
**Active users:** Stripe, Twilio, Anthropic, Cloudflare, Mintlify

**File structure:**

```markdown
# Product Name

> One-paragraph summary of what this is

## Section Title

- [Resource Name](https://example.com/page.md): Brief description of what this page covers
- [API Reference](https://example.com/api.md): Complete API documentation

## Optional

- [Advanced Topics](https://example.com/advanced.md): Can skip if context is tight
```

**Key design decisions:**
- Markdown format (not XML/JSON) — readable by both humans and LLMs
- Links to `.md` versions of pages (Stripe: append `.md` to any URL)
- "Optional" section has semantic meaning: skip these if context window is constrained
- `llms-full.txt` variant: expands all linked content inline (FastHTML's `llms-ctx-full.txt` pattern)

**Controversy:** As of late 2025, no major AI platform had officially committed to parsing `llms.txt`, and crawl analysis showed zero visits from GPTbot, ClaudeBot, or PerplexityBot to the llmstxt.org page itself. However, the standard's value lies in agent *inference-time* use (e.g., an agent fetches your llms.txt to navigate your docs), not crawler indexing.

**Practical pattern:** Products like Mintlify auto-generate `llms.txt` from their doc structure. Langfuse's MCP server exposes their `llms.txt` content as searchable context. Stripe provides `.md` versions of all pages reachable from their `llms.txt`.

---

### The Agent-First Onboarding Stack (Industry Synthesis)

Leading products are converging on a four-layer stack for agent onboarding:

```
Layer 1: DISCOVERY
  llms.txt / agents.md / SKILL.md at /.well-known/skills/
  → Agents can find your integration surface autonomously

Layer 2: CONTEXT
  CLAUDE.md / AGENTS.md / .cursorrules
  → Project-level persistent instructions

Layer 3: CAPABILITY
  MCP server (remote or local)
  → Authenticated, live API access

Layer 4: WORKFLOW
  SKILL.md / Agent Skills
  → Task-specific procedural guidance bundled with scripts
```

**The "drop this into your project" pattern:**

A product wanting Claude Code integration should ship:

1. **A CLAUDE.md snippet** (or AGENTS.md section) that users paste or drop into their project
2. **A skill** in their docs or npm package:
   ```bash
   npx openskills install your-product
   # installs .claude/skills/your-product/SKILL.md
   ```
3. **An MCP server** with deeplink installation:
   ```
   Add to Claude Code: claude://mcp/install?name=yourproduct&config=...
   Add to Cursor: cursor://anysphere.cursor-deeplink/mcp/install?...
   ```
4. **A skills/default/skill.md at `/.well-known/`** for auto-discovery

**Stripe's full implementation** (the gold standard as of 2026):
- `/llms.txt` with links to `.md` versions of all doc pages
- MCP server at `mcp.stripe.com` with OAuth
- Agent skills installable via Claude connectors, Claude Code plugins, Cursor extensions
- `@stripe/agent-toolkit` SDK for frameworks (LangChain, OpenAI Agents SDK, CrewAI)
- "Add to Claude" and "Add to Cursor" buttons on their MCP documentation page

---

### What Fails When You Just Give an Agent Raw API Docs

Based on production experience across multiple teams, the failure modes are consistent:

**1. Context volume ≠ context quality**
Dumping an entire OpenAPI spec into an agent's context produces hallucinations *with high confidence*. The agent pattern-matches on familiar patterns and invents plausible but wrong endpoint calls. Less context, correctly scoped, outperforms more.

**2. Missing auth flow**
API docs describe endpoints, not auth handshakes. Agents attempting OAuth2 or API key flows without explicit, step-by-step auth instructions fail silently — the tool call returns 401, the agent retries with the same bad approach, and eventually gives up.

**3. No error recovery guidance**
API docs document success cases. Agents need to know: what does a rate limit look like? What's the retry pattern? What errors are permanent vs. transient? Without this, agents loop infinitely or abandon tasks unnecessarily.

**4. No scope boundary**
An agent given full API access and no instructions about scope will use whatever's easiest, not whatever's correct. The agent creating a production resource instead of a test resource because the API supports it is a real failure pattern.

**5. Reference docs vs. task docs**
API reference is organized around resources. Agent tasks are organized around outcomes. "Create a feature flag for a new user" requires knowledge spread across multiple endpoints in reference documentation. A skill that describes the *task* workflow is more effective than a skill describing the *API surface*.

**Real example from DevCycle:** Previous onboarding that pointed agents at the SDK docs produced failed installations for many users because agents couldn't navigate the human-centric documentation structure. After switching to MCP + a task-focused skill, they achieved ~3x SDK installation rates.

**The minimum viable agent context set:**
1. What this product does (one paragraph)
2. Authentication pattern (verbatim: "set header `Authorization: Bearer $KEY`")
3. The 2-3 most common operations with exact request/response examples
4. Error codes and what they mean
5. Explicit "don't do this" list (gotchas, rate limits, destructive operations)

---

## Implications for Loop

Loop is well-positioned to implement the full agent-first stack. Specific recommendations:

### 1. The CLAUDE.md / AGENTS.md Drop-In Snippet
Publish a canonical snippet that teams add to their project:

```markdown
## Loop Integration
This project uses Loop (looped.me) for autonomous issue management.
- API endpoint: https://api.looped.me
- Auth: `Authorization: Bearer $LOOP_API_KEY`
- Create issues: POST /api/issues
- Get next priority task: GET /api/dispatch/next
- Report completion: PATCH /api/issues/:id (set status to "done")
```

### 2. An Agent Skill for Loop Dispatch
A skill at `.claude/skills/loop-dispatch/SKILL.md` that:
- Polls Loop for the next issue
- Understands Loop's issue format
- Knows how to report completion, create relations, add comments
- Bundles a script for continuous polling

Distributable via:
```bash
npx openskills install @dork-labs/loop
```

### 3. An MCP Server
`mcp.looped.me` exposing:
- `get_next_issue()` — fetch highest-priority unblocked item
- `create_issue(...)` — signal from agent
- `update_issue(id, ...)` — report progress/completion
- `add_comment(id, ...)` — agent communication

With deeplinks:
```
claude mcp add --transport http loop https://mcp.looped.me
```

### 4. An OpenHands Microagent
`.openhands/microagents/knowledge/loop.md` for repositories that use Loop, teaching OpenHands about the Loop dispatch pattern and API surface.

### 5. A Mintlify-Style llms.txt
`/llms.txt` at `api.looped.me` or `docs.looped.me` with links to the key API docs in `.md` format, enabling agent auto-discovery of the integration surface.

---

## Research Gaps & Limitations

- **OpenHands knowledge microagent format** — the full frontmatter spec (especially trigger keyword syntax) wasn't fully retrievable from docs
- **Devin-specific configuration** — Devin's proprietary knowledge graph and auto-indexing make it less configurable via dropped files; the mechanism for teaching Devin about a new API is less clear
- **OpenClaw** — no specific documentation found; may be a product that doesn't yet have an established public name or docs
- **Measured skill adoption rates** — quantitative data on skill invocation effectiveness vs. raw CLAUDE.md is limited
- **Enterprise MCP security patterns** — how organizations secure MCP servers with SSO/OAuth beyond basic API keys

---

## Contradictions & Disputes

**Skills vs. MCP: complementary or overlapping?**
Some practitioners ("Did Skills Kill MCP?" — Goose blog) argue that skills may reduce the need for many MCP servers by bundling scripts directly. Others (LlamaIndex) maintain they are genuinely complementary. Current consensus favors the layered model: MCP for network/auth-dependent capabilities, skills for everything that can run locally.

**llms.txt effectiveness debate:**
BuiltWith reports 844k websites with llms.txt, but crawl data shows no major AI bot reads it. The counter-argument (Mintlify) is that llms.txt value is at *inference time* — the agent fetches it during task execution — not at training/crawl time. This distinction is important: it's not for training data, it's for runtime navigation.

**AGENTS.md vs. CLAUDE.md vs. tool-specific files:**
AGENTS.md as a Linux Foundation standard may not fully displace tool-specific files because tool-specific files can carry tool-specific frontmatter (Cursor's `globs`, Claude Code's `disable-model-invocation`). The practical resolution: maintain one `AGENTS.md` as the canonical source and use symlinks or imports for tool-specific files.

---

## Sources & Evidence

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Using CLAUDE.md Files — Anthropic Blog](https://claude.com/blog/using-claude-md-files)
- [Agent Skills Specification — agentskills.io](https://agentskills.io/specification)
- [AGENTS.md Official Site](https://agents.md/)
- [Windsurf AGENTS.md Documentation](https://docs.windsurf.com/windsurf/cascade/agents-md)
- [OpenHands Repository](https://github.com/OpenHands/OpenHands)
- [OpenHands Microagents Documentation](https://docs.openhands.dev/modules/usage/microagents/microagents-repo)
- [llms.txt Specification](https://llmstxt.org/)
- [skill.md Open Standard — Mintlify](https://www.mintlify.com/blog/skill-md)
- [Stripe: Building with LLMs](https://docs.stripe.com/building-with-llms)
- [Stripe MCP Documentation](https://docs.stripe.com/mcp)
- [Stripe AI Repository](https://github.com/stripe/ai)
- [Twilio MCP Server](https://github.com/twilio-labs/mcp)
- [DevCycle: MCP-Centered Onboarding (3x result)](https://blog.devcycle.com/we-rebuilt-our-onboarding-around-mcp-the-result-3x-sdk-installs/)
- [Langfuse: Agentic Onboarding & Docs MCP](https://langfuse.com/changelog/2025-06-28-agentic-onboarding-and-docs-mcp)
- [Datadog: Agentic Onboarding Setup](https://docs.datadoghq.com/agentic_onboarding/setup/)
- [MCP, Skills, and Agents — Craig Ramsay (cra.mr)](https://cra.mr/mcp-skills-and-agents/)
- [Skills vs MCP — LlamaIndex](https://www.llamaindex.ai/blog/skills-vs-mcp-tools-for-agents-when-to-use-what)
- [Did Skills Kill MCP? — Goose Blog](https://block.github.io/goose/blog/2025/12/22/agent-skills-vs-mcp/)
- [openskills npm package](https://www.npmjs.com/package/openskills)
- [OpenSkills GitHub](https://github.com/numman-ali/openskills)
- [Aider Conventions Documentation](https://aider.chat/docs/usage/conventions.html)
- [Cursor Rules Deep Dive](https://mer.vin/2025/12/cursor-ide-rules-deep-dive/)
- [One-Click MCP Install with Cursor Deeplinks](https://aiengineerguide.com/blog/cursor-mcp-deeplink/)
- [Anthropic Desktop Extensions](https://www.anthropic.com/engineering/desktop-extensions)
- [Claude Code: Merges Slash Commands Into Skills — Medium](https://medium.com/@joe.njenga/claude-code-merges-slash-commands-into-skills-dont-miss-your-update-8296f3989697)
- [AGENTS.md: One File to Guide Them All — Layer5](https://layer5.io/blog/ai/agentsmd-one-file-to-guide-them-all/)
- [Awesome Claude Code — GitHub](https://github.com/hesreallyhim/awesome-claude-code)
- [SkillsMP Marketplace](https://skillsmp.com)
- [Anthropics/skills — GitHub](https://github.com/anthropics/skills)

---

## Search Methodology

- **Searches performed:** 18
- **Tool calls:** ~25 (searches + page fetches)
- **Most productive search terms:** "agent skills open standard SKILL.md", "AGENTS.md Linux Foundation", "MCP deeplink add to cursor", "DevCycle MCP onboarding", "Stripe building with LLMs"
- **Primary source types:** Official documentation, engineering blogs, GitHub repositories, product changelogs
- **Domains avoided:** Content farms, SEO-optimized "what is X" roundups without original analysis
