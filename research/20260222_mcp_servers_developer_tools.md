# MCP (Model Context Protocol) Servers for Developer Tools

**Research Date:** 2026-02-22
**Depth:** Deep Research
**Searches Performed:** 14
**Relevance to Loop:** High — informs whether and how Loop should ship an MCP server alongside its REST API

---

## Research Summary

MCP has gone from Anthropic's open-source proposal in November 2024 to a genuine industry standard in roughly 14 months. As of early 2026, the official MCP Registry hosts thousands of entries with 97M+ monthly SDK downloads, and every major developer tool (GitHub, Linear, Sentry, Atlassian, Supabase) has shipped or is shipping an official MCP server. The protocol is now backed by Anthropic, OpenAI, Google DeepMind, and Microsoft — and was donated to the Linux Foundation's Agentic AI Foundation (AAIF) in December 2025.

For a product like Loop, the pattern is clear: **ship both REST API and MCP server**. The REST API serves programmatic integrations and existing agents that call APIs directly; the MCP server is what gets Loop discovered and used natively inside Claude Code, Cursor, Windsurf, and any other MCP-capable agent. These are not competing surfaces — they serve different audiences and different interaction patterns.

---

## Key Findings

### 1. MCP Adoption Is Now Table-Stakes for Developer Tools

MCP launched November 2024. By September 2025, the official MCP Registry was live and growing 407% per quarter. As of early 2026:

- **GitHub** — Official MCP server with 51 tools covering issues, PRs, code review, security, notifications, CI/CD. Deployed as a remote HTTP server at `https://api.githubcopilot.com/mcp/`. Both local and remote deployment options.
- **Linear** — Official MCP server launched May 2025, 22 tools covering issues, projects, teams, users, documents, labels. Remote HTTP server with OAuth.
- **Atlassian (Jira + Confluence)** — Official remote MCP server with 25 tools covering Jira issues (CRUD, JQL, transitions) and Confluence pages/spaces/comments. OAuth-secured.
- **Sentry** — Official remote MCP server with 16+ tools for error investigation, Seer AI analysis, releases, and performance monitoring. Zero-install via `npx add-mcp https://mcp.sentry.dev/mcp`.
- **Supabase** — Official MCP server with 20+ tools for database management, schema design, project management, branch management, query execution.
- **Stripe, Notion, HubSpot, PayPal, Asana** — All have official MCP servers accessible via `claude mcp add`.
- **AWS** — Open-source MCP servers for AWS services at `awslabs.github.io/mcp/`.

Any developer tool that wants to participate in AI-assisted workflows now needs an MCP server. It has become the equivalent of having a REST API: table-stakes for serious tooling.

### 2. Single-Click Install Patterns Are Well-Established

The installation experience has matured significantly. There are four distinct patterns in use:

**Pattern A: Remote HTTP MCP with OAuth (best UX)**
The server is centrally hosted. The user adds it with a single command, then authenticates via browser OAuth. No dependency management, no local process to manage, updates are instant.

```bash
# Sentry
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
> /mcp   # triggers browser OAuth

# GitHub
claude mcp add --transport http github https://api.githubcopilot.com/mcp/

# Linear (remote OAuth)
# Connected natively as Claude Integration — no CLI needed for Claude.ai users
```

**Pattern B: npx-based stdio (second best)**
The MCP server is an npm package. Users run it via `npx` — no global install required, just an API key env var:

```bash
claude mcp add --transport stdio --env AIRTABLE_API_KEY=YOUR_KEY airtable \
  -- npx -y airtable-mcp-server
```

**Pattern C: `npx add-mcp` one-liner (Sentry's approach)**
Some tools expose a single command that auto-detects your MCP client and writes the config:

```bash
npx add-mcp https://mcp.sentry.dev/mcp
```

**Pattern D: MCPB files (Desktop Extension, one-click)**
Anthropic developed a packaged format (MCPB, formerly DXT) that installs like a browser extension — single-click in Claude Desktop. Emerging but not yet widely used by major tools.

**The `claude mcp add` command** in Claude Code supports:

- `--transport http` for remote HTTP/Streamable HTTP servers
- `--transport sse` for legacy SSE (deprecated)
- `--transport stdio` for local process-based servers
- `--scope local|project|user` — project scope writes `.mcp.json` for team sharing
- `--header "Authorization: Bearer ..."` for pre-shared API key auth
- `--client-id` + `--client-secret` for OAuth app credentials
- `claude mcp add-from-claude-desktop` imports from Claude Desktop config
- `claude mcp add-json` for raw JSON config

**The `.mcp.json` pattern** (project-scoped) is particularly important for Loop's use case: teams can commit a `.mcp.json` to their repo and every developer gets the Loop MCP server automatically when they open the project in Claude Code.

### 3. What PM/Issue Tracking Products Expose via MCP

**Linear (22 tools)**

| Category      | Tools                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Issues        | `list_issues`, `get_issue`, `create_issue`, `update_issue`, `list_my_issues`, `get_issue_git_branch_name` |
| Status/Labels | `list_issue_statuses`, `get_issue_status`, `list_issue_labels`                                            |
| Comments      | `list_comments`, `create_comment`                                                                         |
| Projects      | `list_projects`, `get_project`, `create_project`, `update_project`                                        |
| Teams/Users   | `list_teams`, `get_team`, `list_users`, `get_user`                                                        |
| Documents     | `list_documents`, `get_document`                                                                          |
| Reference     | `search_documentation`                                                                                    |

**Atlassian/Jira (25 tools)**

| Category            | Tools                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Jira Issues         | `getJiraIssue`, `createJiraIssue`, `editJiraIssue`, `getTransitionsForJiraIssue`, `transitionJiraIssue`                                |
| Jira Search         | `searchJiraIssuesUsingJql`, `lookupJiraAccountId`, `getVisibleJiraProjects`, `getJiraProjectIssueTypesMetadata`                        |
| Jira Comments       | `addCommentToJiraIssue`, `getJiraIssueRemoteIssueLinks`                                                                                |
| Confluence Pages    | `getConfluencePage`, `createConfluencePage`, `updateConfluencePage`, `getConfluencePageAncestors`, `getConfluencePageDescendants`      |
| Confluence Spaces   | `getConfluenceSpaces`, `getPagesInConfluenceSpace`                                                                                     |
| Confluence Comments | `getConfluencePageFooterComments`, `getConfluencePageInlineComments`, `createConfluenceFooterComment`, `createConfluenceInlineComment` |
| Confluence Search   | `searchConfluenceUsingCql`                                                                                                             |
| Auth/Admin          | `atlassianUserInfo`, `getAccessibleAtlassianResources`                                                                                 |

**GitHub (51 tools — the most comprehensive reference)**

Full coverage of: issues, PRs, code review, branches, file operations, commits, repository management, security scanning, notifications, search, and Copilot delegation. The GitHub MCP server is the best reference implementation of a mature MCP surface — it shows what "complete" looks like.

**Loop's Tool Target (derived from above patterns)**

Based on what Linear, Jira, and GitHub expose, a Loop MCP server should cover at minimum:

| Category  | Recommended Tools                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------------- |
| Issues    | `list_issues`, `get_issue`, `create_issue`, `update_issue`, `delete_issue`                            |
| Filtering | `list_issues` with filters: `status`, `type` (signal/triage/task/etc), `projectId`, `priority`        |
| Signals   | `ingest_signal`, `list_signals`                                                                       |
| Projects  | `list_projects`, `get_project`, `create_project`                                                      |
| Labels    | `list_labels`                                                                                         |
| Comments  | `list_comments`, `create_comment`                                                                     |
| Dispatch  | `get_next_task` (Loop's core unique tool — returns the highest priority actionable issue with prompt) |
| Dashboard | `get_dashboard_stats`                                                                                 |

The `get_next_task` tool is what differentiates Loop from a generic issue tracker's MCP server. It's the "what should I work on next?" endpoint that makes Loop an autonomous dispatch engine, not just a database.

### 4. MCP vs REST API — When to Use Which

**REST API is better when:**

- The caller is a human-built integration (webhook receiver, CI/CD step, another service)
- Deterministic, hardcoded workflows are needed — no LLM reasoning involved
- Performance-critical paths where the overhead of MCP tool discovery is unacceptable
- The client doesn't support MCP (legacy systems, simple scripts)
- You're ingesting signals programmatically (Loop's signal ingestion from PostHog, Sentry, GitHub webhooks)

**MCP is better when:**

- An AI agent needs to discover and compose operations autonomously
- The user wants to interact with Loop in natural language from Claude Code, Cursor, etc.
- You want agents to be able to say "create an issue for this bug" without pre-programmed API calls
- Agents need to work across multiple connected tools in a single session (e.g., "read the Sentry error, create a Loop issue, and open a GitHub PR")

**Key insight from the field:** MCP servers are typically thin wrappers over REST APIs. The REST API does the actual work; MCP provides the AI-friendly discovery and composition layer. Shipping both is not redundant — they address fundamentally different callers. As one practitioner framed it: "REST APIs are for developers; MCP is for AI agents."

**The context window problem is real but solved:** Early MCP implementations flooded the context window by loading all tool definitions upfront. Claude Code now implements "MCP Tool Search" — lazy-loading tools on demand when the set exceeds 10% of context. Accuracy improved from 49% to 74% on Claude Opus 4, with 85% reduction in token usage. This means large MCP surfaces (like GitHub's 51 tools) are now practical. But good design still recommends 5–15 focused tools per server — don't expose every API endpoint.

**The "stop converting your REST API to MCP" insight:** The seminal critical article from jlowin.dev (July 2025) argues that naively converting REST endpoints to MCP tools creates terrible agent experiences. Instead, MCP tools should be designed around **agent intent**, not API operations. Example: instead of `get_user` + `list_orders` + `get_order_status` (three REST endpoints), expose `track_order(email)` which orchestrates all three internally. This is a key design principle for Loop's MCP server — the tools should map to agent workflows, not to the REST endpoint structure.

### 5. Distribution Patterns

**The four distribution tiers (best to worst UX):**

1. **Remote HTTP MCP server (hosted by you)** — Best UX. User adds a URL, authenticates via OAuth, done. No npm, no local process, updates roll out instantly. Authentication is handled centrally. Examples: Linear, Sentry, GitHub, Atlassian. This is what Loop should build toward.

2. **npm + stdio via npx** — Good UX for technical users. `claude mcp add --transport stdio -- npx -y @dork-labs/loop-mcp`. Requires Node.js but no explicit install. API key passed as env var. Good for self-hosted Loop deployments where the user has a private API key.

3. **MCPB (Desktop Extension) one-click** — Emerging pattern from Anthropic. A bundled package that installs into Claude Desktop with a single click. Good for non-technical users. Still maturing.

4. **GitHub repo + manual build** — Worst UX. Only for open-source contributors who want to modify the server.

**The MCP Registry** (launched September 2025 at `registry.modelcontextprotocol.io`) is the official catalog. It hosts metadata only — the actual artifact lives on npm. Publishing there gets your server listed in Claude Code's built-in MCP server browser. Anthropic pulls from this registry to populate the `claude mcp add` suggested servers. **Loop should publish to the MCP Registry.**

**The `.mcp.json` team-sharing pattern** is especially compelling for Loop's B2B use case. A team can commit:

```json
{
  "mcpServers": {
    "loop": {
      "type": "http",
      "url": "https://app.looped.me/mcp",
      "headers": {
        "Authorization": "Bearer ${LOOP_API_KEY}"
      }
    }
  }
}
```

Every developer on the team gets Loop connected to their Claude Code automatically when they clone the repo. Environment variable expansion (`${LOOP_API_KEY}`) keeps the secret out of source control.

### 6. Emerging Trends and Trajectory

**Transport evolution:** The original SSE transport is deprecated. Streamable HTTP (introduced March 2025) is the current standard for remote MCP servers. Claude Code still supports SSE for backward compatibility but warns against it. Loop should build with Streamable HTTP from day one.

**OAuth as standard auth:** All major remote MCP servers use OAuth 2.0 for auth. This gives users per-app revocation, audit logs, and scope control. Pre-shared API key via `Authorization: Bearer` header is still common for programmatic use (CI, scripts), but OAuth is the UX-forward pattern.

**Tool Search / lazy loading:** Claude Code's automatic tool deduplication and lazy loading (activated when tools exceed 10% of context) makes it practical to connect many MCP servers simultaneously without degrading model performance.

**Governance:** Donated to the Linux Foundation (AAIF) in December 2025. This signals long-term standardization and removes Anthropic-vendor concerns. OpenAI, Google DeepMind, and Microsoft are all co-adopters. MCP is not going away.

**Server composition and orchestration:** The next frontier is MCP servers that call other MCP servers — agent-to-agent routing. Still emerging but Anthropic's roadmap hints at this direction.

**Limitations that remain:**

- Security: A 2025 scan of ~2,000 public MCP servers found nearly all lacked authentication. The community is still learning security best practices.
- Context overload: Still a concern for users who connect too many MCP servers (>8 in practice). Tool Search mitigates this but doesn't eliminate it.
- Prompt injection via MCP responses: A real attack vector — malicious data returned by an MCP tool can hijack the agent. Remote servers that fetch untrusted content are highest risk.
- No standard for rate limiting or billing: Each server handles this independently.

---

## Detailed Analysis

### How `claude mcp add` Works (Full Flow)

1. User runs `claude mcp add --transport http loop https://app.looped.me/mcp`
2. Claude Code writes the config to `~/.claude.json` (user scope) or `.mcp.json` (project scope)
3. On next session start, Claude Code connects to the MCP server, calls `list_tools`, and loads the tool definitions into context (or defers them if Tool Search is active)
4. When the user asks "what should I work on next?", Claude invokes Loop's `get_next_task` tool
5. The response is injected into the conversation context and Claude acts on it

For OAuth: after step 2, the user runs `/mcp` inside Claude Code, which opens a browser to Loop's OAuth flow. The token is stored in the system keychain and refreshed automatically.

### Designing Loop's MCP Server Tools for Agent Intent

Following the "outcomes over operations" principle, Loop's MCP tools should be designed around what an agent actually does, not around the REST API structure:

**Bad (direct REST mapping):**

- `GET /api/issues` → `list_issues`
- `POST /api/issues` → `create_issue`
- `GET /api/dashboard/stats` → `get_dashboard_stats`

**Good (agent-intent-oriented):**

- `get_next_task()` — Returns the highest-priority unblocked issue with full prompt/instructions. This is Loop's core value, exposed as a single tool.
- `report_task_complete(issue_id, outcome, notes)` — Agent reports back. Loop updates the issue and creates next steps.
- `ingest_signal(source, data)` — Ingest a signal and get back the created triage issue.
- `list_actionable_issues(filters)` — Issues that are ready to work (not blocked, not in progress).
- `get_issue_with_context(issue_id)` — Returns issue + parent chain + related issues + prompt — everything needed to work the issue.
- `create_issue(title, description, type, priority, project_id)` — Standard creation.
- `update_issue_status(issue_id, status, comment)` — Status transitions.

This maps to agent workflows: "pick up work → do work → report back → pick up next work."

### The Dual-Surface Strategy (REST + MCP)

**REST API serves:**

- The Loop CLI (`looped` CLI will call the REST API directly)
- Webhook integrations (PostHog, GitHub, Sentry all POST to REST endpoints)
- The Loop dashboard (the React app calls the REST API)
- External integrations built by developers who prefer direct API access
- Programmatic automation scripts in CI/CD

**MCP server serves:**

- Claude Code users who want to ask Loop questions in natural language
- Agent platforms that use MCP natively (Cursor, Windsurf, Amp, Factory)
- "What's my next task?" dispatch for DorkOS's Pulse scheduler
- Teams that want Loop accessible without leaving their editor

The MCP server is a thin layer on top of the REST API. All business logic lives in the API. The MCP server translates agent intent into REST calls and formats responses for LLM consumption.

**Implementation pattern used by Linear, Sentry, GitHub:**

```
Agent → MCP Server (Loop) → REST API (Loop) → Database
```

The MCP server is essentially a façade that:

1. Defines tool schemas with LLM-friendly descriptions
2. Validates inputs against Zod schemas
3. Calls the REST API (or directly the database layer)
4. Formats responses to be concise and useful (not raw JSON dumps)
5. Returns helpful error messages when things fail (not HTTP status codes)

---

## Sources & Evidence

### Protocol & Ecosystem

- "MCP launched November 2024, has 97M+ monthly SDK downloads" — [One Year of MCP: November 2025 Spec Release](http://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- "Donated to the Linux Foundation AAIF in December 2025" — [Anthropic MCP Donation Announcement](https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation)
- "OpenAI officially adopted MCP in March 2025" — [Model Context Protocol - Wikipedia](https://en.wikipedia.org/wiki/Model_Context_Protocol)
- "2026 marks transition from experimentation to enterprise-wide adoption" — [2026: The Year for Enterprise-Ready MCP Adoption](https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption)
- Official spec (November 2025): [Specification - Model Context Protocol](https://modelcontextprotocol.io/specification/2025-11-25)
- MCP Registry launched September 2025: [Introducing the MCP Registry](http://blog.modelcontextprotocol.io/posts/2025-09-08-mcp-registry-preview/)
- Registry URL: [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io/)
- 8,610+ servers indexed: [PulseMCP Server Directory](https://www.pulsemcp.com/servers)

### Tool Inventories

- Linear MCP docs: [Linear MCP Server — Docs](https://linear.app/docs/mcp)
- Linear MCP changelog: [Linear MCP Changelog](https://linear.app/changelog/2025-05-01-mcp)
- Linear 22 tools: [Linear MCP Server | OpenTools](https://opentools.com/registry/linear-remote)
- GitHub 51 tools: [Complete GitHub MCP Tool List (Gist)](https://gist.github.com/didier-durand/2970be82fec6c84d522f7953ac7881b4)
- GitHub official MCP repo: [github/github-mcp-server](https://github.com/github/github-mcp-server)
- Atlassian 25 tools: [Atlassian MCP Tool List (Gist)](https://gist.github.com/didier-durand/de20b1bd16b5789c302cabea127766ed)
- Atlassian MCP announcement: [Introducing Atlassian's Remote MCP Server](https://www.atlassian.com/blog/announcements/remote-mcp-server)
- Sentry MCP docs: [Sentry MCP Server](https://docs.sentry.io/product/sentry-mcp)
- Supabase MCP docs: [Model Context Protocol | Supabase](https://supabase.com/docs/guides/getting-started/mcp)

### Installation & Distribution

- Claude Code MCP docs: [Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)
- Distribution guide: [Distribute your MCP server | Speakeasy](https://www.speakeasy.com/mcp/distributing-mcp-servers)
- MCP Registry publishing: [Quickstart: Publish an MCP Server](https://modelcontextprotocol.io/registry/quickstart)

### MCP vs REST API Analysis

- "REST APIs are for developers, MCP is for AI agents" — [MCP vs APIs: When to Use Which | Tinybird](https://www.tinybird.co/blog/mcp-vs-apis-when-to-use-which-for-ai-agent-development)
- "Stop converting REST APIs to MCP" — [jlowin.dev](https://www.jlowin.dev/blog/stop-converting-rest-apis-to-mcp)
- MCP design best practices: [MCP is Not the Problem, It's your Server | philschmid.de](https://www.philschmid.de/mcp-best-practices)
- From REST API to MCP: [Stainless MCP Portal](https://www.stainless.com/mcp/from-rest-api-to-mcp-server)

### Limitations & Problems

- Context overload (81,986 tokens before first message): [MCP and Context Overload | EclipseSource](https://eclipsesource.com/blogs/2026/01/22/mcp-context-overload/)
- "Too many tools" problem: [Model Context Protocol and the 'too many tools' problem | demiliani.com](https://demiliani.com/2025/09/04/model-context-protocol-and-the-too-many-tools-problem/)
- Tool Search accuracy improvement (49% → 74%): [MCP Roadmap | modelcontextprotocol.io](https://modelcontextprotocol.io/development/roadmap)

### Transport

- STDIO vs Streamable HTTP: [MCP Transport Mechanisms | AWS Builder](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http)
- SSE deprecation: [Why MCP Deprecated SSE | fka.dev](https://blog.fka.dev/blog/2025-06-06-why-mcp-deprecated-sse-and-go-with-streamable-http/)

---

## Recommendations for Loop

### Priority 1: Remote HTTP MCP Server (Streamable HTTP + OAuth)

Host at `https://app.looped.me/mcp`. This is the pattern all major tools (Linear, Sentry, Atlassian, GitHub) have converged on. It provides:

- Zero-install experience for users
- OAuth authentication with revocation and audit logs
- Instant updates when Loop ships new tools
- Central visibility into which agents are calling which tools

**Installation would be:**

```bash
claude mcp add --transport http loop https://app.looped.me/mcp
> /mcp   # triggers OAuth login
```

### Priority 2: Tool Design Around Agent Workflows

Do not naively expose all 20+ REST endpoints as MCP tools. Design 8-12 tools around agent intent:

1. `get_next_task()` — Loop's signature tool. Returns the highest-priority actionable issue with dispatch instructions.
2. `get_issue(id)` — Full issue detail with parent chain and related issues.
3. `list_issues(filters)` — Filtered listing with pagination.
4. `create_issue(...)` — Create a new issue.
5. `update_issue(id, ...)` — Update status, priority, assignee.
6. `create_comment(issue_id, body)` — Agent reports progress on an issue.
7. `complete_task(issue_id, outcome, notes)` — Agent reports completion. Loop handles next steps.
8. `ingest_signal(source, data)` — Push a signal into the triage queue.
9. `get_project(id)` — Project details with goal and metrics.
10. `list_projects()` — All projects.

This surface is sufficient for agents to do full loop work. Additional tools can be added as usage patterns emerge.

### Priority 3: npm Package for Programmatic Use

Publish `@dork-labs/loop-mcp` to npm as a stdio server for users who want to connect a self-hosted Loop API or who prefer stdio over remote HTTP:

```bash
claude mcp add --transport stdio --env LOOP_API_KEY=... loop \
  -- npx -y @dork-labs/loop-mcp
```

### Priority 4: Publish to MCP Registry

Once the server is live, publish to `registry.modelcontextprotocol.io`. This gets Loop listed in Claude Code's built-in server browser and makes it discoverable via `claude mcp add`.

### Priority 5: Ship `.mcp.json` Template

Document a `.mcp.json` snippet teams can commit to their repo:

```json
{
  "mcpServers": {
    "loop": {
      "type": "http",
      "url": "https://app.looped.me/mcp",
      "headers": {
        "Authorization": "Bearer ${LOOP_API_KEY}"
      }
    }
  }
}
```

This is the B2B "every developer is connected" pattern.

---

## Research Gaps & Limitations

- **Cursor and Windsurf MCP UX**: The research focused on Claude Code installation flows. Cursor and Windsurf have their own configuration UX — these should be verified directly with their documentation before publishing install guides.
- **MCP server implementation libraries**: The research covered distribution and design but did not deeply evaluate which SDK to use for implementing Loop's MCP server (the official `@modelcontextprotocol/sdk` vs. community frameworks like FastMCP or mcp-framework).
- **Pricing/monetization via MCP**: How tools like Stripe handle usage tracking and billing attribution for requests coming via MCP vs. direct API was not researched.
- **MCP security best practices**: The authentication and injection defense landscape is still immature. More specific research on securing MCP servers against prompt injection should be done before Loop's server goes to production.

---

## Search Methodology

- Searches performed: 14
- Most productive search terms: "Linear MCP server tools operations", "GitHub MCP server 51 tools", "claude mcp add command install", "MCP vs REST API agents comparison", "MCP server distribution npm registry"
- Primary information sources: official product documentation (linear.app, sentry.io, supabase.com, code.claude.com), GitHub repositories, community research gists, Anthropic official announcements
- Research depth: Deep (10-15 tool calls)
