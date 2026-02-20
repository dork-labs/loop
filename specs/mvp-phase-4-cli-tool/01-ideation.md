---
slug: mvp-phase-4-cli-tool
number: 5
created: 2026-02-20
status: ideation
---

# MVP Phase 4: CLI Tool

**Slug:** mvp-phase-4-cli-tool
**Author:** Claude Code
**Date:** 2026-02-20
**Related:** [MVP Build Plan](../../specs/mvp-build-plan.md)

---

## 1) Intent & Assumptions

- **Task brief:** Build `looped`, a CLI tool that provides full command-line access to the Loop API. Loop is a DorkOS module (see [dorkos.ai](https://www.dorkos.ai)). The CLI is a thin HTTP client covering issue management, signal submission, triage, projects/goals, prompt templates, dispatch, config, and status. It lives in `apps/cli/` as a new app in the Turborepo monorepo.
- **Assumptions:**
  - Phases 1-3 are complete — all API endpoints exist and are tested
  - CLI makes no direct database calls; it only calls the Loop REST API
  - Auth uses the same Bearer token mechanism as the existing API (`Authorization: Bearer <LOOP_API_KEY>`)
  - Config persists at `~/.loop/config.json` (custom implementation with `node:fs`)
  - Environment variables (`LOOP_API_URL`, `LOOP_API_TOKEN`) override config file for CI/scripting use
  - The monorepo's `apps/*` workspace glob automatically includes `apps/cli/`
  - The CLI package is publishable to npm as `looped` (not `"private": true`)
  - npm package name: `looped`, binary name: `looped`
- **Out of scope:**
  - Interactive TUI (post-MVP)
  - Shell completions (post-MVP)
  - Plugin system (post-MVP)
  - Auto-update mechanism
  - Multi-user auth / OAuth flows
  - Shared types package extraction (follow-up)

## 2) Pre-reading Log

- `meta/loop-mvp.md`: Full MVP spec — CLI section defines all commands (list, show, create, signal, triage, projects, goals, templates, next, dispatch, config, status)
- `meta/loop-litepaper.md`: Loop vision — CLI is the developer-facing interface for the pull-based dispatch model
- `specs/mvp-build-plan.md`: Phase 4 depends on Phases 1 & 2 (not Phase 3); CLI and dashboard are independent
- `apps/api/src/app.ts`: Hono API entry point — routes registered as `api.route('/resource', routes)`, auth middleware injects db
- `apps/api/src/middleware/auth.ts`: Bearer token auth with timing-safe comparison against `LOOP_API_KEY`
- `apps/api/src/routes/issues.ts`: GET/POST/PATCH/DELETE with filtering (status, type, projectId, labelId, priority, parentId)
- `apps/api/src/routes/projects.ts`: GET/POST/PATCH/DELETE with goal/issue counts
- `apps/api/src/routes/goals.ts`: GET/POST/PATCH/DELETE for goals
- `apps/api/src/routes/labels.ts`: GET/POST/DELETE for labels
- `apps/api/src/routes/signals.ts`: POST to ingest signals (creates Signal + linked triage Issue)
- `apps/api/src/routes/relations.ts`: POST/DELETE for issue relations
- `apps/api/src/routes/comments.ts`: GET/POST for threaded comments
- `apps/api/src/routes/templates.ts`: Full template CRUD + versions + reviews + preview hydration
- `apps/api/src/routes/prompt-reviews.ts`: POST reviews with EWMA scoring; auto-creates improvement issues
- `apps/api/src/routes/dispatch.ts`: GET /next (atomic claim + prompt), GET /queue (priority-ordered preview)
- `apps/api/src/routes/dashboard.ts`: GET /stats, GET /activity, GET /prompts (health aggregates)
- `apps/api/src/db/schema/`: Issue enums (status: triage|todo|backlog|in_progress|done|canceled; type: signal|hypothesis|plan|task|monitor; priority 0-4)
- `apps/app/package.json`: Uses `ky@^1.14.3` as HTTP client — CLI should use the same
- `decisions/0013-use-ky-for-api-client.md`: ADR confirming ky as the project's HTTP client (4KB, TypeScript-first)
- `turbo.json`: Tasks (build, dev, test, typecheck, lint) with `dist/**` in build outputs — CLI fits naturally
- `package.json` (root): Workspaces `["apps/*", "packages/*"]`, `"type": "module"`

## 3) Codebase Map

**Primary Components/Modules:**
- `apps/api/src/routes/*.ts` — All API route handlers the CLI will call (12 route files)
- `apps/api/src/middleware/auth.ts` — Bearer token auth pattern the CLI must replicate
- `apps/api/src/db/schema/*.ts` — Type enums and field definitions (CLI needs compatible types)
- `apps/api/src/types.ts` — `AnyDb`, `AppEnv` types (internal to API, not shared)

**Shared Dependencies:**
- `ky` — HTTP client already used by `@loop/app`, should be reused by CLI
- `zod` — Used for validation in both API and app (CLI could use for config validation)
- Root ESLint 9 config + Prettier — CLI will inherit code quality tooling

**Data Flow:**
User types CLI command → Commander parses args/flags → API client (ky) sends HTTP request → Loop API processes → JSON response → CLI formats as table or JSON → stdout

**Feature Flags/Config:**
- `LOOP_API_URL` env var — overrides stored API base URL
- `LOOP_API_TOKEN` env var — overrides stored auth token (for CI)
- `~/.loop/config.json` — persistent config (custom implementation, all platforms)

**Potential Blast Radius:**
- Direct: New `apps/cli/` directory (all new files)
- Indirect: `package-lock.json` (new dependencies), potentially `turbo.json` if CLI needs custom task config
- Tests: New test files within `apps/cli/`
- No changes to existing `apps/api/` or `apps/app/` code

## 4) Root Cause Analysis

N/A — This is a new feature, not a bug fix.

## 5) Research

Research agent conducted 16 searches and 4 page fetches. Full research saved at `research/20260220_mvp-phase-4-cli-tool.md`.

### Potential Solutions

**1. Commander.js v14 + Lean Stack**
- Description: Commander for CLI framework, picocolors for colors, cli-table3 for tables, nanospinner for loading, @inquirer/prompts for interactive input, ky for HTTP, custom config at ~/.loop/config.json, tsup for bundling
- Pros:
  - Commander has 238M weekly downloads — by far the most battle-tested
  - ky already in the monorepo (consistency with `@loop/app`)
  - Minimal total runtime dependencies (6 packages — conf dropped in favor of custom config)
  - tsup handles ESM + shebang preservation automatically
  - picocolors is 14x smaller than chalk, sufficient for status/priority coloring
- Cons:
  - Commander types via `extra-typings` are good but not as deep as clipanion's compile-time safety
  - `conf` on macOS uses `~/Library/Preferences/` not `~/.loop/` (may need custom config if path matters)
- Complexity: Low
- Maintenance: Low

**2. oclif Framework**
- Description: Salesforce's full-featured CLI framework with plugin system, auto-generated help, class-based commands
- Pros:
  - Rich built-in features (auto-generated help, plugin system, update notifications)
  - Used by Heroku, Salesforce at scale
- Cons:
  - Only 173K weekly downloads (1,380x fewer than Commander)
  - Heavy dependency tree — overkill for a REST API wrapper
  - Plugin system adds complexity the CLI doesn't need
  - Class-based boilerplate per command
- Complexity: Medium-High
- Maintenance: Medium

**3. citty (UnJS) Modern Approach**
- Description: Zero-dependency CLI framework from UnJS, built on Node's native `util.parseArgs`
- Pros:
  - Zero dependencies, 100% TypeScript
  - Modern, elegant API design
  - Used by Nuxt CLI
- Cons:
  - Pre-1.0 (v0.2.1) — API stability risk
  - Only 1.1K GitHub stars — small community for troubleshooting
  - Less documentation and examples
- Complexity: Low
- Maintenance: Unknown (pre-1.0)

### Security Considerations
- Token stored in config file should have restricted file permissions (0600)
- Environment variable override pattern prevents config file from being the only auth source
- CLI should never echo the full token in output (mask it in `loop auth status`)

### Performance Considerations
- CLI startup time matters — Commander + picocolors + ky is lightweight (fast cold start)
- tsup bundles to a single file, avoiding module resolution overhead at startup
- ky's retry (2x on 429/500/503) handles transient API failures gracefully

### Recommendation

**Recommended Approach:** Commander.js v14 + Lean Stack (Option 1)

**Rationale:**
Commander is the de facto standard for Node.js CLIs with proven stability across 238M weekly installs. Combined with ky (already in the monorepo), picocolors (7KB), and tsup (zero-config bundling), this stack delivers a fast, maintainable CLI with minimal dependencies. The functional API is cleaner than oclif's class-based pattern for a fixed-command set.

**Caveats:**
- Config is custom (`~/.loop/config.json`) — not using `conf` package, so we handle file I/O, permissions, and atomic writes ourselves
- Commander's type inference on positional args is weaker than clipanion — use explicit type annotations where needed

## 6) Clarification (Resolved)

All clarification questions have been answered:

1. **Config file location:** `~/.loop/config.json` — custom implementation with `node:fs` + `node:os`, not the `conf` package. Same path on all platforms.

2. **`looped triage accept/decline` behavior:** Accept moves to `backlog`. Decline moves to `canceled` with a reason added as a comment.

3. **`looped dispatch 42` semantics:** PATCHes issue #42's status directly to `in_progress`, force-claiming it for agent work and bypassing the priority queue. Useful for debugging.

4. **`looped create` interactive mode:** Interactive prompts via `@inquirer/prompts` when running in a TTY (prompts for type, priority, project). Falls back to silent defaults (`type=task, priority=3, project=none`) when piped or in non-TTY environments.

5. **Package name and `bin` name:** npm package: `looped`. Binary: `looped`. Usage: `npx looped list` or after global install `looped list`. Loop is a DorkOS module (dorkos.ai).

6. **Shared types:** Manual types in `apps/cli/src/types.ts` for now. Extract to `packages/shared-types` later when a third consumer appears.
