---
slug: connect-cli
number: 14
created: 2026-02-23
status: specification
---

# Specification: Connect CLI — `npx @dork-labs/loop-connect`

## Overview

Build `npx @dork-labs/loop-connect` — a one-command interactive CLI that connects any existing project to Loop. The CLI validates an API key, lets the user pick a project, writes environment variables, and auto-detects the developer's agent environment to write the appropriate config files (MCP, Cursor rules, OpenHands microagent, CLAUDE.md context block).

**Package:** `@dork-labs/loop-connect` published to npm
**Location:** `packages/loop-connect/` in the monorepo
**Prompt library:** `@clack/prompts` (v1.0+)
**Build:** tsup → CJS bundle
**Related:** [Ideation](./01-ideation.md) | [Agent Integration Strategy](../agent-integration-strategy.md) (Feature 5)

## Technical Design

### Package Structure

```
packages/loop-connect/
├── src/
│   ├── bin.ts              # Entry point (shebang + arg parsing + run)
│   ├── index.ts            # Main interactive flow (clack prompts)
│   ├── lib/
│   │   ├── api.ts          # HTTP client (validate key, list/create projects)
│   │   ├── detectors.ts    # Environment detection (filesystem checks)
│   │   └── writers.ts      # Idempotent file writers
│   └── templates/
│       ├── claude-md.ts    # CLAUDE.md append block
│       └── mcp-config.ts   # .mcp.json server entry
├── __tests__/
│   ├── api.test.ts
│   ├── detectors.test.ts
│   ├── writers.test.ts
│   └── index.test.ts       # Integration test (full flow)
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

### Dependencies

**Runtime:**

- `@clack/prompts` — interactive prompts (intro, outro, password, select, spinner, confirm, log, note, isCancel)

**Dev:**

- `tsup` — bundler
- `typescript` — type checking
- `vitest` — testing

**No HTTP library** — use Node 18+ built-in `fetch`. This keeps the published package small.

### package.json

```json
{
  "name": "@dork-labs/loop-connect",
  "version": "0.1.0",
  "description": "Connect any project to Loop in one command",
  "type": "module",
  "bin": {
    "loop-connect": "./dist/bin.js"
  },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@clack/prompts": "^1.0.0"
  },
  "devDependencies": {
    "tsup": "latest",
    "typescript": "^5",
    "vitest": "^3.2"
  }
}
```

### tsup.config.ts

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  clean: true,
  splitting: false,
  banner: { js: '#!/usr/bin/env node' },
});
```

Note: ESM format with `"type": "module"` matches the MCP package pattern. The shebang is injected via tsup's `banner` option rather than in source.

### tsconfig.json

Extends the MCP package pattern:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

## Detailed Design

### Entry Point: `src/bin.ts`

Parses CLI arguments and delegates to the main flow.

**Arguments:**

- `--yes` / `-y` — Non-interactive mode
- `--api-key <key>` — Pass API key without prompting
- `--api-url <url>` — Override API URL (default: `https://app.looped.me`)

**Argument parsing:** Use `node:util` `parseArgs()` (built-in since Node 18). No commander needed for this simple interface.

```ts
import { parseArgs } from 'node:util';
import { run } from './index.js';

const { values } = parseArgs({
  options: {
    yes: { type: 'boolean', short: 'y', default: false },
    'api-key': { type: 'string' },
    'api-url': { type: 'string', default: 'https://app.looped.me' },
  },
});

run({
  nonInteractive: values.yes ?? false,
  apiKey: values['api-key'],
  apiUrl: values['api-url'] ?? 'https://app.looped.me',
});
```

### Main Flow: `src/index.ts`

Orchestrates the interactive setup using `@clack/prompts`.

**Flow (interactive mode):**

1. `intro('Loop — Connect your project')`
2. Prompt for API key via `password()` with sync format validation (`loop_` prefix, ≥37 chars)
3. Validate key via `spinner()` — call `GET /api/projects` with Bearer token
   - 401 → `log.error()` + loop back to step 2
   - Network error → `log.warn()` + ask `confirm()` to continue without validation
   - Success → store projects list, continue
4. `select()` project from API response + "Create new project" option
   - If "Create new" → `text()` for project name → `POST /api/projects`
5. Detect environment via `detectors.ts` → build list of files to write
6. Show `note()` with summary of what will be written
7. Write files via `writers.ts` (idempotent)
8. Show `note()` with summary of what was written
9. `outro('Connected! Visit https://app.looped.me/projects/<id>')`

**Flow (non-interactive / `--yes` mode):**

1. Resolve API key: `--api-key` flag → `LOOP_API_KEY` env var → error with `process.exit(1)`
2. Validate key (same network check, exit on failure)
3. Select first project from API (no prompt)
4. Detect environment, write all applicable files (no confirmation)
5. Print summary to stdout

**Cancellation:** Every prompt result is checked with `isCancel()`. On cancel → `cancel('Setup cancelled.')` + `process.exit(0)`.

### API Client: `src/lib/api.ts`

Thin wrapper around `fetch` for the two API calls needed.

```ts
interface LoopProject {
  id: string;
  name: string;
  status: string;
  description: string | null;
}

interface ProjectListResponse {
  data: LoopProject[];
  total: number;
}

/** Fetch projects. Returns the list on success, throws on auth/network failure. */
async function listProjects(apiUrl: string, apiKey: string): Promise<ProjectListResponse>;

/** Create a project. Returns the created project. */
async function createProject(apiUrl: string, apiKey: string, name: string): Promise<LoopProject>;
```

**Error handling:**

- 401 → throw a typed `AuthError` (the caller shows "Invalid API key" and re-prompts)
- Network/timeout → throw a typed `NetworkError` (caller warns and offers to continue)
- Other HTTP errors → throw with status code and message

### Environment Detection: `src/lib/detectors.ts`

Pure functions that check filesystem presence. All checks are relative to `process.cwd()`.

```ts
interface DetectedEnvironment {
  hasClaudeMd: boolean; // CLAUDE.md exists
  hasCursor: boolean; // .cursor/ directory exists
  hasOpenHands: boolean; // .openhands/ directory exists
  hasMcpJson: boolean; // .mcp.json exists
  hasGitignore: boolean; // .gitignore exists
  envLocalIgnored: boolean; // .env.local is in .gitignore
}

function detectEnvironment(): DetectedEnvironment;
```

Each boolean maps to a specific file write action:

- `hasClaudeMd` → append Loop context block to `CLAUDE.md`
- `hasCursor` → write `.cursor/rules/loop.mdc`
- `hasOpenHands` → write `.openhands/microagents/loop.md`
- `hasMcpJson` OR `hasClaudeMd` → add/merge MCP server entry in `.mcp.json`
- `hasGitignore` AND NOT `envLocalIgnored` → warn user to add `.env.local` to `.gitignore`

### Idempotent File Writers: `src/lib/writers.ts`

Each writer reads the current file state before writing. Exports one function per file type.

#### `writeEnvLocal(apiKey: string, apiUrl: string): WriteResult`

- Read `.env.local` if it exists
- Parse existing keys into a `Map<string, string>`
- Set `LOOP_API_KEY` and `LOOP_API_URL` only if not already present
- If key already exists and matches → skip (return `'skipped'`)
- If key already exists and differs → return `'conflict'` (caller prompts to overwrite or skip)
- Append missing keys at end of file
- Create file if it doesn't exist

#### `writeMcpJson(apiKey: string, apiUrl: string): WriteResult`

- Read `.mcp.json` if it exists
- Parse JSON (if malformed, back up to `.mcp.json.bak` and start fresh)
- Deep-merge `mcpServers.loop` entry:
  ```json
  {
    "mcpServers": {
      "loop": {
        "command": "npx",
        "args": ["-y", "@dork-labs/loop-mcp"],
        "env": {
          "LOOP_API_KEY": "<key>",
          "LOOP_API_URL": "<url>"
        }
      }
    }
  }
  ```
- If `mcpServers.loop` already exists → skip (return `'skipped'`)
- Write formatted JSON with 2-space indent

#### `writeClaudeMdBlock(): WriteResult`

- Read `CLAUDE.md`
- Check for sentinel: `<!-- loop-connect -->`
- If sentinel present → skip
- If absent → append:

  ```markdown
  <!-- loop-connect -->

  ## Loop Integration

  This project uses [Loop](https://looped.me) as its autonomous improvement engine.
  Loop manages issues, signals, projects, and prompt templates via a REST API.

  - **Auth:** `Authorization: Bearer $LOOP_API_KEY` (stored in `.env.local`)
  - **API URL:** Configured in `.env.local` as `LOOP_API_URL`
  - **MCP Server:** Configured in `.mcp.json` — provides `loop_get_next_task`, `loop_complete_task`, and more
  - **Docs:** https://www.looped.me/docs
  - **Dashboard:** https://app.looped.me
  ```

#### `writeCursorRules(): WriteResult`

- Check if `.cursor/rules/loop.mdc` exists → skip if present
- Create `.cursor/rules/` directory (recursive)
- Copy content from `packages/loop-skill/templates/loop.mdc` (bundled as a string constant in `src/templates/`)

#### `writeOpenHandsMicroagent(): WriteResult`

- Check if `.openhands/microagents/loop.md` exists → skip if present
- Create `.openhands/microagents/` directory (recursive)
- Copy content from `packages/loop-skill/templates/openhands-loop.md` (bundled as a string constant)

#### WriteResult type

```ts
type WriteResult = {
  status: 'written' | 'skipped' | 'conflict';
  path: string;
  reason?: string;
};
```

### Template Content: `src/templates/`

File templates are stored as exported string constants (not external files) so they're bundled into the single CJS output. Content is sourced from `packages/loop-skill/templates/` during development but inlined at build time.

- `claude-md.ts` — the CLAUDE.md append block (with sentinel comment)
- `mcp-config.ts` — the `.mcp.json` server entry object

The Cursor rules and OpenHands microagent templates are also inlined as string constants.

### Summary Output

After all writes, display a `note()` showing what was done:

```
┌  Files written:
│
│  ✓ .env.local         — LOOP_API_KEY, LOOP_API_URL
│  ✓ .mcp.json          — MCP server config
│  ✓ CLAUDE.md          — Loop context block (appended)
│  ○ .cursor/rules/     — Skipped (not detected)
│  ○ .openhands/        — Skipped (not detected)
│
│  ⚠ Add .env.local to .gitignore
│
└  Connected to project: My Project
```

Legend: `✓` written, `○` skipped (not applicable), `⚠` warning

### Masked Key Display

The API key is never shown in full after entry. In any output (note, log, summary), display as:

```
loop_***...{last 4 chars}
```

Example: `loop_abc123...` → `loop_***...c123`

## Implementation Phases

### Phase 1: Package Scaffolding

1. Create `packages/loop-connect/` directory
2. Write `package.json`, `tsconfig.json`, `tsup.config.ts`
3. Add project reference to root `tsconfig.json`
4. Write `src/bin.ts` with arg parsing
5. Verify `npm run build` produces `dist/bin.js` with shebang
6. Verify `npx .` runs (locally, before publishing)

### Phase 2: Core Logic

7. Implement `src/lib/api.ts` — `listProjects()` and `createProject()` with typed errors
8. Implement `src/lib/detectors.ts` — `detectEnvironment()` with filesystem checks
9. Implement `src/lib/writers.ts` — all five file writers with idempotency
10. Implement `src/templates/` — inline template strings

### Phase 3: Interactive Flow

11. Implement `src/index.ts` — full interactive flow with clack prompts
12. Wire up the re-prompt loop for invalid API keys
13. Implement `--yes` non-interactive mode
14. Handle cancellation (`isCancel()`) at every prompt

### Phase 4: Testing

15. Unit tests for `api.ts` — mock `fetch`, test success/401/network error
16. Unit tests for `detectors.ts` — mock `fs.existsSync`, test all combinations
17. Unit tests for `writers.ts` — mock `fs`, test idempotency (write, skip, conflict)
18. Integration test for `index.ts` — mock api + fs, verify full happy path

### Phase 5: Monorepo Integration

19. Run `npm install` from root to link the new package
20. Run `npm run typecheck` across the monorepo
21. Run `npm run lint` and fix any issues
22. Run `npm test` to verify all tests pass
23. Run `npm run build` to verify the package builds

## Acceptance Criteria

1. `npx @dork-labs/loop-connect` prompts for API key, validates it, lets user select a project, writes config files, and prints success
2. Invalid API key (401) re-prompts instead of crashing
3. Network errors warn gracefully and offer to continue
4. All file writes are idempotent — running twice produces the same result
5. `--yes --api-key <key>` mode completes without any prompts
6. CLAUDE.md append uses sentinel comment and doesn't duplicate on re-run
7. .mcp.json merge preserves existing MCP server entries
8. .env.local writes don't overwrite existing values without confirmation
9. All tests pass with mocked fs and HTTP (no real API calls)
10. Package builds to a single entry point with shebang
11. `npm pack --dry-run` shows only `dist/` contents

## Out of Scope

- Account creation flow (user must already have an account)
- Building MCP server, agent skills, or SDK (separate features)
- Vercel Marketplace / hosted key management
- In-browser setup wizard
- Multi-key management or key rotation
- `loop` CLI subcommand (Feature 6 will add `loop init` later)
- Windsurf detection (no reliable signal yet; can be added later)
- AGENTS.md writing (this is a repo-level file typically committed, not generated per-project)
