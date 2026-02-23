---
slug: loop-cli
number: 15
created: 2026-02-23
status: ideation
---

# Loop CLI — Terminal-Native Interface with `loop next`

**Slug:** loop-cli
**Author:** Claude Code
**Date:** 2026-02-23
**Related:** [Agent Integration Strategy](../agent-integration-strategy.md) (Feature 6)

---

## 1) Intent & Assumptions

- **Task brief:** Refactor the existing DorkOS CLI (`apps/cli/`, published as `@dork-labs/looped`) into the Loop CLI — a terminal-native interface to Loop with `loop next` as the killer command. Rename the package to `@dork-labs/loop-cli` with binary `loop`, migrate internals to use the TypeScript SDK (Feature 4), add new commands (`auth`, `issues start/done`), add `--plain` output tier, and add shell completions.

- **Assumptions:**
  - TypeScript SDK (Feature 4, `@dork-labs/loop-sdk`) will be built first and the CLI depends on it
  - The existing CLI at `apps/cli/` is the starting point — this is a refactor, not a greenfield build
  - Existing `@dork-labs/looped` npm package will be unpublished (clean break)
  - Commander.js remains the CLI framework (ADR 0015 already decided this)
  - Config stays at `~/.loop/config.json` (no path migration)
  - All existing commands are preserved and reorganized to `gh`-style grammar

- **Out of scope:**
  - Interactive TUI with panels/vim navigation
  - MCP server (Feature 2, already built)
  - Wrapping every REST endpoint (agent-intent commands only)
  - Running a local Loop server
  - Plugin/extension system
  - Python/Go CLIs
  - OAuth/session auth (API key only for now)

---

## 2) Pre-reading Log

### Specifications

- `specs/mvp-phase-4-cli-tool/`: Original CLI specification with package structure, tech stack, command registry pattern
- `specs/typescript-sdk/`: SDK architecture — defines LoopClient with resource namespacing (loop.issues.list(), loop.dispatch.next(), etc.)
- `specs/connect-cli/`: Related CLI showing npx publishing patterns and environment detection
- `specs/agent-integration-strategy.md`: Feature map showing CLI is Feature 6, blocked by SDK (Feature 4)

### Decision Records

- `decisions/0015-use-commander-for-cli.md`: CLI framework decision — Commander.js over oclif
- `decisions/0031-hand-written-sdk-over-generation.md`: SDK approach — no auto-generation tools
- `decisions/0032-shared-types-package-for-api-types.md`: Shared types via `packages/types`
- `decisions/0033-use-ky-for-sdk-http-layer.md`: HTTP client choice — ky for SDK

### Existing Implementation

- `apps/cli/package.json`: Published as `@dork-labs/looped`, dependencies: commander@14, ky@1.14, picocolors@1, cli-table3@0.6, @inquirer/prompts@7, nanospinner@1
- `apps/cli/src/cli.ts`: Root Commander program with 12 registered subcommands
- `apps/cli/src/lib/api-client.ts`: ky HTTP client factory with Bearer auth, retry config
- `apps/cli/src/lib/config.ts`: `~/.loop/config.json` read/write with 0o600 file mode
- `apps/cli/src/lib/output.ts`: Table rendering + JSON output using cli-table3 and picocolors
- `apps/cli/src/lib/errors.ts`: HTTPError → message mapping with `withErrorHandler` wrapper
- `apps/cli/src/commands/dispatch.ts`: Existing `next` command — previews dispatch queue, calls `GET /api/dispatch/queue`

### Infrastructure

- `turbo.json`: Auto-discovers `apps/*` and `packages/*`, `^build` dependency ordering
- `packages/mcp/`: Recently built MCP package — shows tsup bundling, ky client, Zod validation patterns
- `tsconfig.json` (root): 14 project references, will need to add SDK packages

---

## 3) Codebase Map

### Primary Components/Modules

| File                             | Role                                                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/cli/src/bin.ts`            | Shebang entry point, imports cli.ts and calls `program.parseAsync()`                                        |
| `apps/cli/src/cli.ts`            | Root Commander program, registers 12 subcommands, defines global options (`--json`, `--api-url`, `--token`) |
| `apps/cli/src/commands/*.ts`     | 12 command files, each exports `registerXxxCommand(program)`                                                |
| `apps/cli/src/lib/api-client.ts` | `createApiClient(opts)` — ky instance with Bearer auth                                                      |
| `apps/cli/src/lib/config.ts`     | `readConfig()` / `writeConfig()` — `~/.loop/config.json` with 0o600                                         |
| `apps/cli/src/lib/output.ts`     | `output(data, opts, renderFn)` — JSON or human-formatted output                                             |
| `apps/cli/src/lib/errors.ts`     | `withErrorHandler(fn)` — centralized error handling                                                         |
| `apps/cli/src/types.ts`          | API response type mirrors — will be replaced by `@dork-labs/loop-types`                                     |

### Existing Command Inventory

| Command               | File         | What It Does               | Loop CLI Equivalent                |
| --------------------- | ------------ | -------------------------- | ---------------------------------- |
| `config set/get/list` | config.ts    | Manage config values       | `loop config` + `loop auth`        |
| `issues`              | issues.ts    | List issues with filters   | `loop issues list`                 |
| `show <id>`           | show.ts      | Show issue detail          | `loop issues view <id>`            |
| `create`              | create.ts    | Create issue               | `loop issues create`               |
| `comment`             | comment.ts   | Comment on issue           | `loop comments add`                |
| `signal`              | signal.ts    | Submit signal              | `loop signals ingest`              |
| `triage`              | triage.ts    | Triage queue management    | `loop triage` (keep)               |
| `projects`            | projects.ts  | List projects              | `loop projects list`               |
| `goals`               | goals.ts     | List goals                 | `loop goals list`                  |
| `templates`           | templates.ts | Template list/show/promote | `loop templates list/view/promote` |
| `next` (dispatch)     | dispatch.ts  | Preview dispatch queue     | `loop next` (signature command)    |
| `status`              | status.ts    | System health              | `loop dashboard`                   |

### Shared Dependencies

- `ky@1.14` — HTTP client (will be replaced by SDK calls)
- `commander@14` — CLI framework (stays)
- `picocolors@1` — Terminal colors (stays)
- `cli-table3@0.6` — Table rendering (stays)
- `nanospinner@1` — Loading spinners (stays)
- `@inquirer/prompts@7` — Interactive prompts (stays)
- `tsup@8` — Bundler (stays)

### Data Flow

```
User runs `loop next`
  → Commander.js parses command + flags
  → Command handler calls SDK: loop.dispatch.next()
  → SDK makes HTTP call: GET /api/dispatch/next (Bearer auth)
  → API processes request (auth, query, FOR UPDATE SKIP LOCKED)
  → SDK returns typed DispatchResult
  → output() renders human table or JSON
```

### Feature Flags/Config

- `~/.loop/config.json` — apiUrl, token fields
- `LOOP_API_URL` env var — override API base URL
- `LOOP_API_TOKEN` env var — override auth token
- Priority: CLI flags > env vars > config file

### Potential Blast Radius

- **Direct (refactored):** `apps/cli/` — all source files modified to use SDK, package.json renamed
- **Dependencies:** `packages/loop-sdk/` (must exist), `packages/types/` (must exist)
- **Config:** `turbo.json` (no changes needed — auto-discovers), `tsconfig.json` root (add SDK references)
- **npm:** Unpublish `@dork-labs/looped`, publish `@dork-labs/loop-cli`
- **Tests:** All existing tests need updating to mock SDK instead of ky

---

## 4) Root Cause Analysis

N/A — this is a new feature, not a bug fix.

---

## 5) Research

Full research saved to `research/20260223_loop_cli_best_practices.md`.

### Potential Solutions

**1. Commander.js + picocolors + cli-table3 (Existing Stack)**

- Description: Keep the current framework stack, refactor internals to use SDK, add new commands and output tier
- Pros: No framework migration risk, existing ADR supports this, team already knows the patterns, lowest startup time (~40ms)
- Cons: Commander's subcommand nesting is verbose for deep `gh`-style grammar
- Complexity: Low
- Maintenance: Low

**2. oclif (Salesforce Framework)**

- Description: Full-featured CLI framework with plugin system, code generation, auto-docs
- Pros: Plugin system, auto-generated help, TypeScript-first
- Cons: Heavy (3x startup time), contradicts ADR 0015, over-engineered for our needs
- Complexity: High
- Maintenance: Medium

**3. citty (unjs Lightweight)**

- Description: Minimal CLI builder from the unjs ecosystem
- Pros: Very lightweight, modern ESM, minimal dependencies
- Cons: Less mature, smaller community, would need custom output formatting
- Complexity: Medium
- Maintenance: Medium

### Output Formatting

**Three-tier output model (from gh CLI patterns):**

1. **Human (default):** Colored tables, spinners, formatted text via picocolors + cli-table3
2. **`--plain`:** No colors, no spinners, tab-separated values — for `grep`, `awk`, `cut` piping
3. **`--json`:** Raw JSON with optional `--jq` filter — for machine consumption

### Shell Completions

- **omelette** recommended — lightweight, supports bash/zsh/fish, simple registration API
- Alternative: Commander.js has built-in completion support as of v12

### Recommendation

**Recommended Approach:** Refactor existing CLI with Commander.js + SDK migration

**Rationale:** The existing `apps/cli/` already has 80% of the needed commands with the right framework (ADR 0015). The refactor adds: SDK migration (type safety, retry logic, pagination), `--plain` output tier, `loop auth` commands, `loop issues start/done` commands, shell completions, and `gh`-style command grammar reorganization.

**Caveats:**

- TypeScript SDK must be built first (Feature 4 is a hard blocker)
- npm unpublish of `@dork-labs/looped` is irreversible after 72 hours
- Shell completions add ~2KB to the binary but no runtime cost

---

## 6) Clarifications & Decisions

### Decisions Made

1. **CLI strategy** → Refactor existing `apps/cli/` (not a new separate package). Rename from `@dork-labs/looped` to `@dork-labs/loop-cli`, binary from `looped` to `loop`. Keep all existing commands, reorganize grammar.

2. **Package name** → `@dork-labs/loop-cli` with binary `loop`. Follows the naming pattern: `@dork-labs/loop-mcp` (MCP), `@dork-labs/loop-cli` (CLI), `@dork-labs/loop-sdk` (SDK).

3. **Config location** → Keep `~/.loop/config.json` as-is. No XDG migration. Familiar path, works today, no migration complexity.

4. **SDK dependency** → Build on TypeScript SDK as the brief specifies. Feature 4 (`@dork-labs/loop-sdk`) must be built first. CLI becomes a thin command layer over SDK methods.

5. **Legacy package** → Unpublish `@dork-labs/looped` from npm. Clean break, no dual-publishing.

### Open Questions

None — all critical decisions resolved.
