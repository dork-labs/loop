# Agent Discovery Layer — Task Breakdown

**Spec:** specs/agent-discovery-layer/02-specification.md
**Last Decompose:** 2026-02-23
**Total Tasks:** 11
**Phases:** 4

---

## Phase 1: Package Scaffold + SKILL.md (4 tasks)

### Task 1.1: Create packages/loop-skill/ directory with package.json

Create the `packages/loop-skill/` directory and `package.json` file.

**File:** `packages/loop-skill/package.json`

```json
{
  "name": "@dork-labs/loop",
  "version": "0.1.0",
  "description": "Agent skill for Loop — the autonomous improvement engine. Teaches AI agents how to use Loop's REST API.",
  "type": "module",
  "files": [
    "SKILL.md",
    "references/",
    "templates/",
    "README.md"
  ],
  "keywords": [
    "agent-skill",
    "openskills",
    "loop",
    "ai-agent",
    "mcp",
    "claude-code",
    "cursor",
    "codex"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/dork-labs/loop",
    "directory": "packages/loop-skill"
  },
  "homepage": "https://looped.me"
}
```

Key notes:
- No `main`, `bin`, or `exports` fields — this is a content-only package
- `files` explicitly lists what gets published (no build step needed)
- The `openskills` installer looks for `SKILL.md` at the package root
- Root `package.json` workspace glob `packages/*` already includes this package
- `turbo.json` needs no changes — content-only package has no build/test tasks

**Acceptance Criteria:**
- [ ] `packages/loop-skill/` directory exists
- [ ] `package.json` has name `@dork-labs/loop`, version `0.1.0`
- [ ] No `main`, `bin`, or `exports` fields present
- [ ] `files` array includes `SKILL.md`, `references/`, `templates/`, `README.md`
- [ ] Package is detected by monorepo workspace (verify with `npm ls @dork-labs/loop`)

---

### Task 1.2: Write SKILL.md (agentskills.io format)

Create the primary agent skill file at `packages/loop-skill/SKILL.md` following the agentskills.io specification.

**File:** `packages/loop-skill/SKILL.md`

```markdown
---
name: loop
description: >
  Interact with Loop (looped.me), the autonomous improvement engine for AI-powered
  development. Use when: (1) creating, listing, or updating issues in Loop, (2) ingesting
  signals or anomalies into the triage queue, (3) fetching the next prioritized work item
  for an agent to execute, (4) managing projects, goals, or prompt templates, or
  (5) checking system health via the dashboard API. Loop's REST API is at
  https://app.looped.me/api with Bearer token auth.
license: MIT
compatibility: Requires internet access to reach https://app.looped.me
metadata:
  author: dork-labs
  version: "1.0"
---

# Loop

Loop is an autonomous improvement engine with a REST API at https://app.looped.me/api.
Two core capabilities: **issue management** (create, list, update, dispatch work items)
and **signal ingestion** (webhook-style data that auto-creates triage issues).

## Authentication

Set before making API calls:

\`\`\`bash
export LOOP_API_KEY=loop_...
\`\`\`

Base URL: `https://app.looped.me/api`
All `/api/*` endpoints require: `Authorization: Bearer $LOOP_API_KEY`

Get a key at https://app.looped.me/settings/api-keys.
If the env var is not set, ask the user for their API key.

## The Dispatch Loop

The core agent workflow:

1. **Get next task:** Fetch the highest-priority unblocked issue
2. **Do the work:** Execute what the issue describes
3. **Report completion:** Update the issue status and add outcome notes
4. **Create discovered issues:** If you find bugs or tasks during work, create new issues
5. **Repeat:** Get the next task

## Common Operations

### Get the next issue to work on

\`\`\`bash
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open&limit=1"
\`\`\`

### Create an issue

\`\`\`bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login redirect","type":"bug"}' \
  https://app.looped.me/api/issues
\`\`\`

### Ingest a signal

\`\`\`bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"agent","title":"Error rate spike","data":{"count":47}}' \
  https://app.looped.me/api/signals
\`\`\`

### Complete an issue

\`\`\`bash
curl -X PATCH -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}' \
  https://app.looped.me/api/issues/{id}
\`\`\`

### Add a progress comment

\`\`\`bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"Investigating root cause...","authorName":"agent"}' \
  https://app.looped.me/api/issues/{id}/comments
\`\`\`

## Issue Types

`signal` | `hypothesis` | `plan` | `task` | `monitor`

## Status Values

`triage` | `backlog` | `todo` | `in_progress` | `done` | `canceled`

## Error Handling

- **401:** Check `LOOP_API_KEY` is set and valid
- **404:** Issue/project ID doesn't exist — use list endpoints to find valid IDs
- **422:** Validation error — check required fields in request body

## Documentation

1. Fetch the docs index: `curl -s https://www.looped.me/llms.txt`
2. Full endpoint reference: see [references/api.md](references/api.md)
```

**Token budget constraints:**
- SKILL.md `description` frontmatter field: must be under 1,024 characters
- SKILL.md body (everything after frontmatter): must be under 5,000 tokens (~20,000 chars)

**Acceptance Criteria:**
- [ ] File exists at `packages/loop-skill/SKILL.md`
- [ ] YAML frontmatter parses correctly with `name`, `description`, `license`, `compatibility`, `metadata` fields
- [ ] `name` is lowercase, max 64 chars
- [ ] `description` is under 1,024 characters
- [ ] Body is under 5,000 tokens
- [ ] Contains Authentication, Dispatch Loop, Common Operations, Issue Types, Status Values, Error Handling, Documentation sections
- [ ] All API examples use `https://app.looped.me/api` base URL
- [ ] All auth examples use `$LOOP_API_KEY` env var (never hardcoded)

---

### Task 1.3: Write references/api.md (complete API endpoint reference)

Create the on-demand API reference file. This is loaded only when agents need full endpoint detail, not at skill activation time.

**File:** `packages/loop-skill/references/api.md`

Content should be the complete protected API endpoint table extracted from CLAUDE.md. Include all methods, paths, descriptions, and request/response shape examples for each endpoint group:

**Protected endpoints (`/api/*` — requires `Authorization: Bearer $LOOP_API_KEY`):**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/issues` | List issues (filterable by status, type, projectId; paginated) |
| `POST` | `/api/issues` | Create an issue |
| `GET` | `/api/issues/:id` | Get issue by ID with labels, relations, comments |
| `PATCH` | `/api/issues/:id` | Update an issue |
| `DELETE` | `/api/issues/:id` | Soft-delete an issue |
| `POST` | `/api/issues/:id/relations` | Create a relation between two issues |
| `GET` | `/api/issues/:id/comments` | List comments for an issue (threaded) |
| `POST` | `/api/issues/:id/comments` | Add a comment to an issue |
| `GET` | `/api/projects` | List projects (paginated) |
| `POST` | `/api/projects` | Create a project |
| `GET` | `/api/projects/:id` | Get project with goal and issue counts |
| `PATCH` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Soft-delete a project |
| `GET` | `/api/goals` | List goals (paginated) |
| `POST` | `/api/goals` | Create a goal |
| `GET` | `/api/goals/:id` | Get goal by ID |
| `PATCH` | `/api/goals/:id` | Update a goal |
| `DELETE` | `/api/goals/:id` | Soft-delete a goal |
| `GET` | `/api/labels` | List labels (paginated) |
| `POST` | `/api/labels` | Create a label |
| `DELETE` | `/api/labels/:id` | Soft-delete a label |
| `DELETE` | `/api/relations/:id` | Hard-delete a relation |
| `POST` | `/api/signals` | Ingest a signal (creates signal + linked issue) |
| `GET` | `/api/templates` | List prompt templates (paginated) |
| `POST` | `/api/templates` | Create a prompt template |
| `GET` | `/api/templates/:id` | Get template with active version |
| `PATCH` | `/api/templates/:id` | Update a template |
| `DELETE` | `/api/templates/:id` | Soft-delete a template |
| `GET` | `/api/templates/:id/versions` | List versions for a template |
| `POST` | `/api/templates/:id/versions` | Create a new version |
| `POST` | `/api/templates/:id/versions/:versionId/promote` | Promote a version to active |
| `GET` | `/api/templates/:id/reviews` | List reviews across all versions |
| `POST` | `/api/prompt-reviews` | Create a prompt review |
| `GET` | `/api/dashboard/stats` | System health metrics |
| `GET` | `/api/dashboard/activity` | Signal chains for activity timeline |
| `GET` | `/api/dashboard/prompts` | Template health with scores |

**Webhook endpoints (`/api/signals/*` — provider-specific auth):**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/signals/posthog` | `POSTHOG_WEBHOOK_SECRET` | PostHog metric alerts |
| `POST` | `/api/signals/github` | `GITHUB_WEBHOOK_SECRET` (HMAC-SHA256) | GitHub events |
| `POST` | `/api/signals/sentry` | `SENTRY_CLIENT_SECRET` (HMAC-SHA256) | Sentry error alerts |

**Public endpoints (no auth):**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/` | Service info |

Include request/response examples for the most common operations (create issue, list issues, ingest signal, create project, dashboard stats). Format as a clean markdown reference document.

Target: ~3,000 tokens. No hard limit (on-demand loading).

**Acceptance Criteria:**
- [ ] File exists at `packages/loop-skill/references/api.md`
- [ ] Contains all protected API endpoints from CLAUDE.md
- [ ] Contains webhook endpoints with their auth mechanisms
- [ ] Includes request/response examples for key operations
- [ ] Uses `https://app.looped.me/api` as base URL throughout
- [ ] All auth examples use `$LOOP_API_KEY` env var

---

### Task 1.4: Write README.md for npm package

Create a README for the npm package that explains what it is and how to install/use it.

**File:** `packages/loop-skill/README.md`

The README should include:
1. Package name and description matching package.json
2. What the package contains (SKILL.md, templates, references)
3. Installation instructions via `npx openskills install @dork-labs/loop` and `npm install`
4. Brief explanation of each artifact:
   - SKILL.md: Cross-agent skill for Claude Code, Codex, Cursor, Amp, Goose
   - templates/AGENTS.md: Paste into your repo's AGENTS.md
   - templates/loop.mdc: Cursor rule file for `.cursor/rules/`
   - templates/openhands-loop.md: OpenHands microagent for `.openhands/microagents/`
   - references/api.md: Full API endpoint reference
5. Links to docs (https://www.looped.me/docs) and llms.txt (https://www.looped.me/llms.txt)
6. MIT license note

**Acceptance Criteria:**
- [ ] File exists at `packages/loop-skill/README.md`
- [ ] Contains installation instructions for both openskills and npm
- [ ] Lists all artifacts in the package
- [ ] Links to external documentation

---

## Phase 2: Template Files (3 tasks)

**Dependencies:** Phase 2 tasks are blocked by Task 1.1 (package scaffold must exist first).

### Task 2.1: Write templates/AGENTS.md

Create the AGENTS.md snippet following the Linux Foundation agents.md standard. Target ~300-400 tokens, self-contained.

**File:** `packages/loop-skill/templates/AGENTS.md`

```markdown
## Loop Integration

This project uses [Loop](https://looped.me) as its autonomous improvement engine.
Loop manages issues, signals, projects, and prompt templates via a REST API.

### Auth

API key is in `LOOP_API_KEY` (environment variable). All endpoints use:
`Authorization: Bearer $LOOP_API_KEY`

Base URL: `https://app.looped.me/api`

### When to Create a Loop Issue

- Bug found during work: `POST /api/issues` with `type: "bug"`
- External anomaly detected: `POST /api/signals`
- Task blocked by another: `POST /api/issues/:id/relations`

### Quick Reference

\`\`\`bash
# List open issues
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open"

# Create an issue
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"...","type":"bug"}' \
  https://app.looped.me/api/issues

# Dashboard stats
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  https://app.looped.me/api/dashboard/stats
\`\`\`

### Docs

- Full API: https://www.looped.me/docs
- Machine-readable: https://www.looped.me/llms.txt
- Agent Skill: `npx openskills install @dork-labs/loop`
```

**Token budget:** Under 600 tokens (loaded every session in integrated repos).

**Acceptance Criteria:**
- [ ] File exists at `packages/loop-skill/templates/AGENTS.md`
- [ ] Content is under 600 tokens
- [ ] Contains Auth, When to Create, Quick Reference, Docs sections
- [ ] Uses `https://app.looped.me/api` base URL
- [ ] Uses `$LOOP_API_KEY` env var for auth

---

### Task 2.2: Write templates/loop.mdc (Cursor rules)

Create the Cursor rule file in MDC format with Agent-Requested mode.

**File:** `packages/loop-skill/templates/loop.mdc`

```markdown
---
description: >
  Use when working with Loop (looped.me), the autonomous improvement engine.
  Apply when: creating or updating issues via the Loop API, ingesting signals,
  fetching the next work item for an agent, managing projects or goals, or
  accessing prompt templates. Loop API base: https://app.looped.me/api.
alwaysApply: false
---

# Loop — Autonomous Improvement Engine

## Auth

\`\`\`bash
export LOOP_API_KEY=loop_...
\`\`\`

All `/api/*` endpoints: `Authorization: Bearer $LOOP_API_KEY`

## Common Operations

\`\`\`bash
# List open issues
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open"

# Create issue
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"<title>","type":"bug|feature|task"}' \
  https://app.looped.me/api/issues

# Ingest a signal
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"custom","title":"<title>","data":{}}' \
  https://app.looped.me/api/signals
\`\`\`

## Issue Types

`signal` | `hypothesis` | `plan` | `task` | `monitor`

## Status Values

`triage` | `backlog` | `todo` | `in_progress` | `done` | `canceled`

## Docs

Full API: https://www.looped.me/docs
Machine-readable: https://www.looped.me/llms.txt
```

**Token budget:** Under 1,000 tokens (loaded when agent decides relevance).
**Mode:** `alwaysApply: false` — agent-requested, no globs.

**Acceptance Criteria:**
- [ ] File exists at `packages/loop-skill/templates/loop.mdc`
- [ ] MDC frontmatter has `description` and `alwaysApply: false`
- [ ] No `globs` field in frontmatter
- [ ] Content is under 1,000 tokens
- [ ] Contains Auth, Common Operations, Issue Types, Status Values, Docs sections

---

### Task 2.3: Write templates/openhands-loop.md (OpenHands microagent)

Create the OpenHands knowledge microagent with keyword triggers.

**File:** `packages/loop-skill/templates/openhands-loop.md`

```markdown
---
name: loop
agent: CodeActAgent
trigger_type: keyword
triggers:
  - loop
  - looped
  - looped.me
  - loop api
  - loop issue
  - ingest signal
---

# Loop — Autonomous Improvement Engine

Loop is an open-source REST API for managing issues, signals, projects, and
prompt templates in an autonomous development workflow.

## API Base URL

\`\`\`
https://app.looped.me/api
\`\`\`

All protected endpoints require: `Authorization: Bearer $LOOP_API_KEY`

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/issues | List issues (filter: status, type, projectId) |
| POST | /api/issues | Create an issue |
| PATCH | /api/issues/:id | Update an issue |
| DELETE | /api/issues/:id | Soft-delete an issue |
| POST | /api/signals | Ingest a signal (creates signal + triage issue) |
| GET | /api/projects | List projects |
| POST | /api/projects | Create a project |
| GET | /api/goals | List goals |
| GET | /api/dashboard/stats | System health metrics |

## Create an Issue

\`\`\`bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login flow","type":"bug"}' \
  https://app.looped.me/api/issues
\`\`\`

## Ingest a Signal

\`\`\`bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"agent","title":"Error spike","data":{"count":47}}' \
  https://app.looped.me/api/signals
\`\`\`

## Documentation

Full docs: https://www.looped.me/docs
Machine-readable index: https://www.looped.me/llms.txt
```

**Token budget:** Under 1,500 tokens (loaded on keyword trigger).
**Trigger keywords:** loop, looped, looped.me, loop api, loop issue, ingest signal

**Acceptance Criteria:**
- [ ] File exists at `packages/loop-skill/templates/openhands-loop.md`
- [ ] YAML frontmatter has `name`, `agent`, `trigger_type`, `triggers` fields
- [ ] `trigger_type` is `keyword`
- [ ] Content is under 1,500 tokens
- [ ] Contains Key Endpoints table, Create Issue example, Ingest Signal example

---

## Phase 3: llms.txt Endpoint (1 task)

**Dependencies:** None (independent of Phase 1 and 2).

### Task 3.1: Create llms.txt route handler in apps/web

Add a Next.js App Router route handler that serves the llms.txt content as plain text.

**File:** `apps/web/src/app/llms.txt/route.ts`

```typescript
const LLMS_TXT_CONTENT = `# Loop

> Loop is the Autonomous Improvement Engine — an open-source data layer and
> prompt engine that turns signals into prioritized, actionable issues for
> AI agents. REST API at https://app.looped.me/api.

## Getting Started

- [Quick Start](https://www.looped.me/docs/quickstart): Install and create your first issue
- [Authentication](https://www.looped.me/docs/auth): Bearer token setup with \`loop_\` prefixed keys
- [Core Concepts](https://www.looped.me/docs/concepts): Signals, issues, projects, goals, dispatch

## Issues

- [List Issues](https://www.looped.me/docs/api/issues): GET /api/issues — filter by status, type, project
- [Create Issue](https://www.looped.me/docs/api/issues-create): POST /api/issues
- [Update Issue](https://www.looped.me/docs/api/issues-update): PATCH /api/issues/:id
- [Issue Relations](https://www.looped.me/docs/api/relations): Blocking and dependency graphs

## Signals

- [Ingest Signal](https://www.looped.me/docs/api/signals): POST /api/signals — creates signal + triage issue
- [PostHog Webhook](https://www.looped.me/docs/webhooks/posthog)
- [Sentry Webhook](https://www.looped.me/docs/webhooks/sentry)
- [GitHub Webhook](https://www.looped.me/docs/webhooks/github)

## Agent Dispatch

- [Get Next Task](https://www.looped.me/docs/api/dispatch): Highest-priority unblocked issue with instructions
- [Complete Task](https://www.looped.me/docs/api/complete): Report completion with outcome notes

## Projects and Goals

- [Projects](https://www.looped.me/docs/api/projects): Group issues toward shared objectives
- [Goals](https://www.looped.me/docs/api/goals): Measurable success indicators

## Prompt Templates

- [Templates](https://www.looped.me/docs/prompts/overview): Manage agent instruction templates
- [Versions](https://www.looped.me/docs/prompts/versions): Version control and promotion

## Agent Integration

- [Agent Skill](https://www.looped.me/docs/agent-skill): \`npx openskills install @dork-labs/loop\`
- [AGENTS.md Snippet](https://www.looped.me/docs/agents-md): Paste into your repo
- [Cursor Rule](https://www.looped.me/docs/cursor-rule): Auto-activates in Cursor
- [MCP Server](https://www.looped.me/docs/mcp): Native tool access via MCP

## Optional

- [Dashboard Stats](https://www.looped.me/docs/api/dashboard): System health metrics
- [OpenAPI Spec](https://app.looped.me/api/openapi.json): Machine-readable API schema
- [Self-Hosting](https://www.looped.me/docs/self-hosting)`;

export async function GET() {
  return new Response(LLMS_TXT_CONTENT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
```

**Notes:**
- Content is an inline string constant, not a file read, for zero-latency serving
- Cache headers: 1h browser cache (`max-age=3600`), 24h CDN cache (`s-maxage=86400`)
- No rewrite needed in `next.config.ts` — Next.js App Router handles `/llms.txt` natively via the `llms.txt/route.ts` directory path
- Doc page URLs are forward-references — they point to where docs will live once Feature 7 ships
- Create the `apps/web/src/app/llms.txt/` directory (the directory name includes the dot)

**Acceptance Criteria:**
- [ ] File exists at `apps/web/src/app/llms.txt/route.ts`
- [ ] `GET` handler returns Response with `Content-Type: text/plain; charset=utf-8`
- [ ] `Cache-Control` header is `public, max-age=3600, s-maxage=86400`
- [ ] Response body starts with `# Loop`
- [ ] Contains all required H2 sections: Getting Started, Issues, Signals, Agent Dispatch, Projects and Goals, Prompt Templates, Agent Integration, Optional
- [ ] All URLs use `https://www.looped.me/docs/` prefix

---

## Phase 4: Dogfooding + Tests (3 tasks)

**Dependencies:** Phase 4 tasks are blocked by Phase 1, Phase 2, and Phase 3 completion.

### Task 4.1: Copy template files to Loop repo root for dogfooding

Copy the three template files to their dogfood locations in the Loop repository. These are maintained copies (not symlinks) since repo-root files may diverge slightly for local dev context.

**Copies to make:**

| Source | Destination |
|--------|-------------|
| `packages/loop-skill/templates/AGENTS.md` | `./AGENTS.md` |
| `packages/loop-skill/templates/loop.mdc` | `./.cursor/rules/loop.mdc` |
| `packages/loop-skill/templates/openhands-loop.md` | `./.openhands/microagents/loop.md` |

**Directory creation:**
- Create `.cursor/rules/` if it doesn't exist
- Create `.openhands/microagents/` if it doesn't exist

**Gitignore considerations:**
- Verify `.openhands/` is NOT in `.gitignore` (these files are intentionally committed)
- Verify `.cursor/rules/loop.mdc` is NOT in `.gitignore` (intentionally committed)
- If either is gitignored, add negation rules or remove the ignore entry

**Acceptance Criteria:**
- [ ] `AGENTS.md` exists at repo root with Loop Integration content
- [ ] `.cursor/rules/loop.mdc` exists with Cursor rule content
- [ ] `.openhands/microagents/loop.md` exists with OpenHands microagent content
- [ ] All three files are tracked by git (not ignored)
- [ ] Content matches the templates from Phase 2

---

### Task 4.2: Add llms.txt route handler test

Create a test file for the llms.txt route handler verifying correct response format and content.

**File:** `apps/web/src/app/llms.txt/__tests__/route.test.ts` (or appropriate test location for apps/web)

```typescript
import { describe, it, expect } from 'vitest';
import { GET } from '../route';

describe('GET /llms.txt', () => {
  it('returns markdown with correct content-type', async () => {
    const response = await GET();
    expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
  });

  it('returns correct cache-control headers', async () => {
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=3600, s-maxage=86400');
  });

  it('body starts with # Loop', async () => {
    const response = await GET();
    const body = await response.text();
    expect(body.startsWith('# Loop')).toBe(true);
  });

  it('contains all required H2 sections', async () => {
    const response = await GET();
    const body = await response.text();
    const requiredSections = [
      '## Getting Started',
      '## Issues',
      '## Signals',
      '## Agent Dispatch',
      '## Projects and Goals',
      '## Prompt Templates',
      '## Agent Integration',
      '## Optional',
    ];
    for (const section of requiredSections) {
      expect(body).toContain(section);
    }
  });
});
```

**Note:** Check if `apps/web/` already has Vitest configured. If not, the test may need to be placed differently or a test config added. The `vitest.workspace.ts` at repo root currently configures `apps/api` and `apps/app` — may need to add `apps/web`.

**Acceptance Criteria:**
- [ ] Test file exists and runs with `npx vitest run`
- [ ] Tests verify Content-Type header
- [ ] Tests verify Cache-Control header
- [ ] Tests verify body starts with `# Loop`
- [ ] Tests verify all 8 required H2 sections are present

---

### Task 4.3: Add token budget and content consistency tests

Create tests that validate token budgets across all artifacts and ensure content consistency (same API base URL, same auth pattern).

**File:** `packages/loop-skill/__tests__/artifacts.test.ts` (or similar test location)

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PKG_DIR = join(__dirname, '..');

function readArtifact(relativePath: string): string {
  return readFileSync(join(PKG_DIR, relativePath), 'utf-8');
}

function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

function extractFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: '', body: content };
  return { frontmatter: match[1], body: match[2] };
}

describe('Token Budget Validation', () => {
  it('SKILL.md description is under 1024 characters', () => {
    const content = readArtifact('SKILL.md');
    const { frontmatter } = extractFrontmatter(content);
    // Extract description field from YAML frontmatter
    const descMatch = frontmatter.match(/description:\s*>\s*\n([\s\S]*?)(?=\n\w|\n---)/);
    const description = descMatch ? descMatch[1].replace(/\n\s*/g, ' ').trim() : '';
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  it('SKILL.md body is under 5000 tokens', () => {
    const content = readArtifact('SKILL.md');
    const { body } = extractFrontmatter(content);
    const tokens = estimateTokens(body);
    expect(tokens).toBeLessThan(5000);
  });

  it('AGENTS.md snippet is under 600 tokens', () => {
    const content = readArtifact('templates/AGENTS.md');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThan(600);
  });

  it('loop.mdc is under 1000 tokens', () => {
    const content = readArtifact('templates/loop.mdc');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThan(1000);
  });

  it('openhands-loop.md is under 1500 tokens', () => {
    const content = readArtifact('templates/openhands-loop.md');
    const tokens = estimateTokens(content);
    expect(tokens).toBeLessThan(1500);
  });
});

describe('Content Consistency', () => {
  const artifacts = [
    { name: 'SKILL.md', path: 'SKILL.md' },
    { name: 'AGENTS.md', path: 'templates/AGENTS.md' },
    { name: 'loop.mdc', path: 'templates/loop.mdc' },
    { name: 'openhands-loop.md', path: 'templates/openhands-loop.md' },
  ];

  it('all artifacts use consistent API base URL', () => {
    for (const artifact of artifacts) {
      const content = readArtifact(artifact.path);
      expect(content, `${artifact.name} missing API base URL`).toContain(
        'https://app.looped.me/api'
      );
    }
  });

  it('all artifacts reference LOOP_API_KEY', () => {
    for (const artifact of artifacts) {
      const content = readArtifact(artifact.path);
      expect(content, `${artifact.name} missing LOOP_API_KEY`).toContain('LOOP_API_KEY');
    }
  });

  it('all artifacts use Bearer auth pattern', () => {
    for (const artifact of artifacts) {
      const content = readArtifact(artifact.path);
      expect(content, `${artifact.name} missing Bearer auth`).toContain(
        'Authorization: Bearer'
      );
    }
  });
});
```

**Note:** May need to add `packages/loop-skill` to `vitest.workspace.ts` or create a local vitest config. Token estimation uses chars/4 as a rough approximation per the spec.

**Acceptance Criteria:**
- [ ] Test file exists and runs with `npx vitest run`
- [ ] Token budget tests pass for SKILL.md description (<1024 chars), SKILL.md body (<5000 tokens), AGENTS.md (<600 tokens), loop.mdc (<1000 tokens), openhands-loop.md (<1500 tokens)
- [ ] Content consistency tests verify all artifacts use `https://app.looped.me/api`
- [ ] Content consistency tests verify all artifacts reference `LOOP_API_KEY`
- [ ] Content consistency tests verify all artifacts use `Authorization: Bearer` pattern

---

## Dependency Graph

```
Task 1.1 (package.json)
  └─ Task 1.2 (SKILL.md)         ─┐
  └─ Task 1.3 (references/api.md) │
  └─ Task 1.4 (README.md)         │
  └─ Task 2.1 (AGENTS.md)         ├─ Task 4.1 (dogfood copies)
  └─ Task 2.2 (loop.mdc)          │  Task 4.3 (token + consistency tests)
  └─ Task 2.3 (openhands-loop.md) ─┘

Task 3.1 (llms.txt route) ─────────── Task 4.2 (llms.txt tests)
```

**Phase 1:** Tasks 1.2, 1.3, 1.4 depend on 1.1. Tasks 1.2/1.3/1.4 can run in parallel after 1.1.
**Phase 2:** Tasks 2.1, 2.2, 2.3 depend on 1.1. All three can run in parallel.
**Phase 3:** Task 3.1 has no dependencies (can run in parallel with Phase 1 and 2).
**Phase 4:** Task 4.1 depends on 2.1, 2.2, 2.3. Task 4.2 depends on 3.1. Task 4.3 depends on 1.2, 2.1, 2.2, 2.3.

## Parallel Execution Opportunities

- Tasks 1.2, 1.3, 1.4 can run in parallel (after 1.1)
- Tasks 2.1, 2.2, 2.3 can run in parallel (after 1.1)
- Task 3.1 can run in parallel with all Phase 1 and Phase 2 tasks
- Phase 1 tasks (1.2-1.4) and Phase 2 tasks (2.1-2.3) can all run in parallel after 1.1

**Critical path:** Task 1.1 -> Task 2.1/2.2/2.3 -> Task 4.1/4.3

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | 4 | Package scaffold, SKILL.md, API reference, README |
| Phase 2 | 3 | AGENTS.md, Cursor rule, OpenHands microagent |
| Phase 3 | 1 | llms.txt route handler |
| Phase 4 | 3 | Dogfood copies, route tests, artifact tests |
| **Total** | **11** | |
