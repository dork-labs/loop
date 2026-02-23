---
slug: connect-cli
number: 14
created: 2026-02-23
status: ideation
---

# Connect CLI — `npx @dork-labs/loop-connect`

**Slug:** connect-cli
**Author:** Claude Code
**Date:** 2026-02-23
**Related:** [Agent Integration Strategy](../agent-integration-strategy.md) (Feature 5)

---

## 1) Intent & Assumptions

- **Task brief:** Build `npx @dork-labs/loop-connect` — a one-command interactive CLI that connects any existing project to Loop. Prompts for API key, validates it, selects a project, writes env vars and agent config files, prints success.
- **Assumptions:**
  - The Loop API is running and accessible (either locally or at app.looped.me)
  - The user already has a Loop account and API key (or knows how to get one)
  - The `GET /api/projects` endpoint is the validation target (returns 401 on bad key, project list on good key)
  - Features 1 (API Key DX), 2 (MCP Server), and 3 (Agent Discovery Layer) are complete — their artifacts (loop\_ prefix, MCP config template, SKILL.md, AGENTS.md, cursor rules, OpenHands microagent) exist and can be referenced
  - The package will live at `packages/loop-connect/` in the monorepo
- **Out of scope:**
  - Account creation (user must already have a Loop account)
  - Building the MCP server itself (Feature 2, already done)
  - Building agent skill files (Feature 3, already done)
  - SDK/CLI tool installation (Features 4 and 6)
  - Vercel Marketplace integration
  - In-browser setup wizard
  - Multi-key management or key rotation

## 2) Pre-reading Log

- `specs/agent-integration-strategy.md`: Master feature dependency map. Connect CLI is Feature 5, blocked by 1/2/3 (all complete). Defines the exact interactive flow and technical requirements.
- `research/20260222_loop_developer_onboarding.md`: Deep research on vibe coder personas and the Convex `npx convex dev` pattern as gold standard. Recommends exact UX flow: prompt for API key → validate → select project → write .env → append CLAUDE.md → write cursor rules → success message.
- `research/20260222_sdk_cli_api_interaction_layers.md`: Establishes maturity arc (REST → SDK → CLI → MCP). Notes that `npx` init command is Priority 1 for onboarding infrastructure.
- `research/20260223_connect_cli_best_practices.md`: CLI framework comparison, npx publishing patterns, environment detection, idempotent file writes, API key validation UX, non-interactive mode patterns. Written by research agent for this feature.
- `packages/mcp/package.json`: MCP server package (`@dork-labs/loop-mcp`). Blueprint for how Loop packages are structured, built (tsup), and published.
- `packages/loop-skill/package.json`: Agent skill package (`@dork-labs/loop`). Pattern for non-code packages in the monorepo.
- `apps/cli/package.json`: Existing CLI (`@dork-labs/looped`). Uses Commander, ky, picocolors, @inquirer/prompts.
- `scripts/generate-api-key.js`: Auto-generates `loop_` prefixed keys. Shows idempotent env file write pattern (check for existing keys, support `--force`).
- `apps/api/src/env.ts`: Zod-based env validation with `ENV_HINTS` providing actionable error messages. Pattern for good CLI output on validation failures.
- `apps/api/src/routes/projects.ts`: Projects endpoint returns `{ data: [...], total: number }`. The response shape the CLI will parse for project selection.
- `.mcp.json`: Existing MCP config using `mcpServers` object with command/args pattern. Template exists at `packages/mcp/.mcp.json.template`.
- `AGENTS.md`: Standard agent discovery file with auth info and curl examples. Will be written/appended by connect CLI.
- `package.json` (root): Workspace includes `apps/*` and `packages/*`. New package auto-discovered.
- `tsconfig.json` (root): References `./apps/cli` explicitly. Will need a new reference for `./packages/loop-connect`.
- `turbo.json`: Standard Turborepo config. New package auto-discovered for build/test/lint tasks.

## 3) Codebase Map

**Primary Components/Modules:**

- `packages/loop-connect/` — **New package** (to be created)
  - `src/bin.ts` — Entry point with shebang (`#!/usr/bin/env node`)
  - `src/index.ts` — Main CLI logic (clack prompts flow)
  - `src/lib/api.ts` — HTTP client for Loop API (validate key, list projects, create project)
  - `src/lib/detectors.ts` — Environment detection (Claude Code, Cursor, OpenHands, MCP)
  - `src/lib/writers.ts` — Idempotent file writers (.env.local, .mcp.json, CLAUDE.md, cursor rules, OpenHands microagent)
  - `package.json` — With bin field, @clack/prompts dependency
  - `tsconfig.json` — Extending root
  - `tsup.config.ts` — CJS bundle for CLI
  - `__tests__/` — Unit tests for detectors, writers, and flow

**Shared Dependencies:**

- **Build:** tsup (bundling), TypeScript 5, vitest (testing)
- **HTTP:** ky or native fetch (Node 18+ has built-in fetch)
- **Prompts:** @clack/prompts (intro, outro, text, password, select, spinner, confirm, log, note, tasks, isCancel)

**Data Flow:**

```
npx @dork-labs/loop-connect [--yes --api-key <key>]
  ↓
intro() — "Loop — Connect your project"
  ↓
password() — "Paste your API key" (format validation: loop_ prefix, min length)
  ↓
spinner() — GET /api/projects with Bearer token
  ↓ (401 → error + re-prompt | success → continue)
select() — "Which project?" (list from API + "Create new")
  ↓ (if "Create new" → text() for project name → POST /api/projects)
  ↓
Detect environment → show what will be written
  ↓
Write files (idempotent):
  • .env.local — LOOP_API_KEY + LOOP_API_URL
  • .mcp.json — MCP server config (if Claude Code / MCP detected)
  • .cursor/rules/loop.mdc — Cursor rules (if .cursor/ exists)
  • .openhands/microagents/knowledge/loop.md — OpenHands microagent (if .openhands/ exists)
  • CLAUDE.md — Append Loop context block (if CLAUDE.md exists)
  ↓
note() — Summary of what was written
outro() — "Connected! Visit https://app.looped.me/projects/<id>"
```

**Feature Flags/Config:**

- `--yes` flag for non-interactive mode (requires `--api-key <key>` or `LOOP_API_KEY` env var)
- `--api-key <key>` flag to pass key without prompting
- `--api-url <url>` flag to override default API URL (defaults to `https://app.looped.me`)
- Idempotent by design — safe to run multiple times

**Potential Blast Radius:**

- **New:** `packages/loop-connect/` directory with all source files
- **Modified:** `tsconfig.json` (root) — add project reference
- **Tests:** Unit tests with mocked fs and HTTP, no real API calls

## 4) Root Cause Analysis

N/A — not a bug fix.

## 5) Research

### CLI Framework Comparison

| Framework         | Bundle            | Maintenance                            | Verdict                                                             |
| ----------------- | ----------------- | -------------------------------------- | ------------------------------------------------------------------- |
| @clack/prompts    | ~240 kB installed | Active (v1.0.1, Feb 2026)              | **Winner** — beautiful defaults, built-in spinner/intro/outro/tasks |
| @inquirer/prompts | ~23 kB minified   | Active                                 | Good but needs ora for spinners, no intro/outro                     |
| enquirer          | Unknown           | **Stale** (last published 3 years ago) | Do not use                                                          |
| ink               | Large (React dep) | Active                                 | Overkill for linear wizard                                          |
| prompts           | Small             | **Stale**                              | Do not use                                                          |

**Decision:** @clack/prompts. It has the exact primitives needed (intro, outro, password, select, spinner, tasks, note, log) with beautiful defaults out of the box. Used by create-t3-app and Astro.

### npx Publishing Best Practices

- Entry point must start with `#!/usr/bin/env node`
- Build with tsup in CJS format (no ESM complexity for CLI tools)
- Use `"files": ["dist"]` to whitelist only built output
- Use `"engines": { "node": ">=18" }` for built-in fetch
- Run `npm pack --dry-run` before publishing to verify contents
- Use `prepublishOnly` script to ensure build runs before publish

### Environment Detection Strategy

Filesystem presence is the primary signal (more reliable than env vars):

| Agent       | Detection                                  | Config to write                                  |
| ----------- | ------------------------------------------ | ------------------------------------------------ |
| Claude Code | `CLAUDE.md` exists                         | Append Loop context block                        |
| Cursor      | `.cursor/` directory exists                | Write `.cursor/rules/loop.mdc`                   |
| OpenHands   | `.openhands/` directory exists             | Write `.openhands/microagents/knowledge/loop.md` |
| MCP-capable | `.mcp.json` exists OR Claude Code detected | Add MCP server entry to `.mcp.json`              |

### Idempotent File Write Patterns

1. **`.env.local`** — Read existing, parse keys into Set, append only missing entries. Never overwrite existing values.
2. **`.mcp.json`** — Parse existing JSON, deep-merge new config under `mcpServers.loop`, write formatted output.
3. **Markdown files** (`CLAUDE.md`) — Use sentinel comment (`<!-- loop-connect -->`) to detect prior runs. Skip if present; append with sentinel if absent.
4. **New files** (`.cursor/rules/loop.mdc`, OpenHands microagent) — Check existence, skip if present, create with `mkdirSync({ recursive: true })` if absent.

### API Key Validation UX

Two-phase pattern (clack's `validate()` is synchronous):

1. **Phase 1 — format check inside `password()`**: Validate `loop_` prefix and minimum length. Catches typos instantly.
2. **Phase 2 — network check via `spinner()`**: Call `GET /api/projects` with Bearer token. On 401 → error + re-prompt loop. On network error → warn and offer to continue. On success → proceed.

### Security Considerations

- Use `password()` to mask API key during entry
- Write to `.env.local` (gitignored by default), not `.env`
- Check `.gitignore` and warn if `.env.local` is not listed
- Mask key in success output: show `loop_***...abc` not full value
- All API calls over HTTPS
- Validation call is read-only (`GET /api/projects`) — no mutations during setup

### Recommendation

**CLI Framework:** @clack/prompts — perfect fit for linear setup wizard
**Package Structure:** `packages/loop-connect/` with tsup CJS build, bin field, files whitelist
**File Write Strategy:** Read-parse-upsert per file type with sentinel comments for markdown
**Non-interactive Mode:** `--yes` flag requires `--api-key` or `LOOP_API_KEY` env var; project defaults to first from API

## 6) Clarifications & Decisions

1. **Package location:** `packages/loop-connect/` — follows same pattern as `packages/mcp` and `packages/loop-skill` for publishable npm packages
2. **Prompt library:** @clack/prompts — modern, beautiful defaults, built-in spinner/intro/outro/tasks. Better fit than @inquirer/prompts for a setup wizard despite apps/cli using inquirer. (Added task to `tasks-for-loop.md` to investigate switching apps/cli to clack for consistency.)
3. **API key input:** `password()` with masked entry — standard practice for credentials in CLIs

- **Open questions:** None
