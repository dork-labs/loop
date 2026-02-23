---
slug: connect-cli
number: 14
created: 2026-02-23
status: tasks
---

# Tasks: Connect CLI — `npx @dork-labs/loop-connect`

## Phase 1: Package Scaffolding

### Task 1.1: Create package directory and package.json

**Subject:** `[connect-cli] [P1] Create package directory and package.json`

Create the `packages/loop-connect/` directory and write `package.json` with the exact contents from the spec.

**Steps:**

1. Create `packages/loop-connect/` directory
2. Write `packages/loop-connect/package.json`:

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

**Acceptance Criteria:**

- `packages/loop-connect/package.json` exists with correct content
- Package name is `@dork-labs/loop-connect`
- `bin` field points to `./dist/bin.js`
- `files` field restricts published content to `dist/`

---

### Task 1.2: Create tsconfig.json and tsup.config.ts

**Subject:** `[connect-cli] [P1] Create tsconfig.json and tsup.config.ts`

Write the TypeScript and build configuration files matching the MCP package pattern.

**Steps:**

1. Write `packages/loop-connect/tsconfig.json`:

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

2. Write `packages/loop-connect/tsup.config.ts`:

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

**Acceptance Criteria:**

- `tsconfig.json` matches MCP package pattern exactly
- `tsup.config.ts` produces ESM output with shebang banner
- Single entry point `src/bin.ts`

**Blocked by:** Task 1.1

---

### Task 1.3: Add project reference to root tsconfig.json and vitest workspace

**Subject:** `[connect-cli] [P1] Add project reference to root tsconfig.json and vitest workspace`

Register the new package in the monorepo build and test systems.

**Steps:**

1. Edit `/tsconfig.json` — add `{ "path": "./packages/loop-connect" }` to the `references` array
2. Edit `/vitest.workspace.ts` — add `'packages/loop-connect'` to the workspace array

**Acceptance Criteria:**

- Root `tsconfig.json` includes `{ "path": "./packages/loop-connect" }` in `references`
- `vitest.workspace.ts` includes `'packages/loop-connect'` in the array

**Blocked by:** Task 1.2

---

### Task 1.4: Write src/bin.ts entry point with arg parsing

**Subject:** `[connect-cli] [P1] Write src/bin.ts entry point with argument parsing`

Create the CLI entry point using `node:util` `parseArgs()`.

**Steps:**

1. Create `packages/loop-connect/src/` directory
2. Write `packages/loop-connect/src/bin.ts`:

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

3. Create a stub `packages/loop-connect/src/index.ts` that exports `run()` so the build succeeds:

```ts
export interface RunOptions {
  nonInteractive: boolean;
  apiKey?: string;
  apiUrl: string;
}

export async function run(options: RunOptions): Promise<void> {
  console.log('loop-connect stub', options);
}
```

**Acceptance Criteria:**

- `bin.ts` uses `node:util` `parseArgs()` (no external CLI library)
- Supports `--yes`/`-y`, `--api-key <key>`, `--api-url <url>` flags
- Default `apiUrl` is `https://app.looped.me`
- Stub `index.ts` exports `run()` with `RunOptions` interface

**Blocked by:** Task 1.2

---

### Task 1.5: Verify build and local execution

**Subject:** `[connect-cli] [P1] Verify build produces dist/bin.js with shebang`

Run `npm install` from root, build the package, and verify the output is correct.

**Steps:**

1. Run `npm install` from monorepo root to link the new package
2. Run `npm run build` from `packages/loop-connect/`
3. Verify `packages/loop-connect/dist/bin.js` exists
4. Verify `dist/bin.js` starts with `#!/usr/bin/env node`
5. Verify `node packages/loop-connect/dist/bin.js --help` runs without error (exits cleanly)
6. Verify `npm pack --dry-run` from `packages/loop-connect/` shows only `dist/` contents

**Acceptance Criteria:**

- `dist/bin.js` exists after build
- File starts with shebang `#!/usr/bin/env node`
- Executing the file does not throw
- `npm pack --dry-run` shows only files under `dist/`

**Blocked by:** Task 1.4

---

## Phase 2: Core Logic

### Task 2.1: Implement src/lib/api.ts with typed errors

**Subject:** `[connect-cli] [P2] Implement api.ts with listProjects, createProject, and typed errors`

Create the API client module with typed error classes and two functions.

**Steps:**

1. Create `packages/loop-connect/src/lib/` directory
2. Write `packages/loop-connect/src/lib/api.ts`:

```ts
/** Project returned by the Loop API. */
export interface LoopProject {
  id: string;
  name: string;
  status: string;
  description: string | null;
}

/** Paginated project list response. */
export interface ProjectListResponse {
  data: LoopProject[];
  total: number;
}

/** Thrown when the API returns 401 Unauthorized. */
export class AuthError extends Error {
  constructor() {
    super('Invalid API key');
    this.name = 'AuthError';
  }
}

/** Thrown on network failures (timeout, DNS, connection refused). */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Network error — could not reach Loop API');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** Thrown for unexpected HTTP status codes. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`API error ${status}: ${message}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Fetch projects from the Loop API.
 *
 * @param apiUrl - Loop API base URL (e.g. https://app.looped.me)
 * @param apiKey - Bearer token for authentication
 * @returns Paginated project list
 * @throws AuthError on 401
 * @throws NetworkError on network failure
 * @throws ApiError on other HTTP errors
 */
export async function listProjects(apiUrl: string, apiKey: string): Promise<ProjectListResponse> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/projects`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    throw new NetworkError(err);
  }

  if (response.status === 401) throw new AuthError();
  if (!response.ok) throw new ApiError(response.status, await response.text());

  return response.json() as Promise<ProjectListResponse>;
}

/**
 * Create a new project in Loop.
 *
 * @param apiUrl - Loop API base URL
 * @param apiKey - Bearer token
 * @param name - Project name
 * @returns The created project
 * @throws AuthError on 401
 * @throws NetworkError on network failure
 * @throws ApiError on other HTTP errors
 */
export async function createProject(
  apiUrl: string,
  apiKey: string,
  name: string
): Promise<LoopProject> {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });
  } catch (err) {
    throw new NetworkError(err);
  }

  if (response.status === 401) throw new AuthError();
  if (!response.ok) throw new ApiError(response.status, await response.text());

  return response.json() as Promise<LoopProject>;
}
```

**Acceptance Criteria:**

- Exports `LoopProject`, `ProjectListResponse` interfaces
- Exports `AuthError`, `NetworkError`, `ApiError` error classes
- `listProjects()` calls `GET /api/projects` with Bearer auth
- `createProject()` calls `POST /api/projects` with JSON body
- Uses built-in `fetch` (no HTTP library)
- 401 throws `AuthError`, network errors throw `NetworkError`, other errors throw `ApiError`

**Blocked by:** Task 1.4

---

### Task 2.2: Implement src/lib/detectors.ts

**Subject:** `[connect-cli] [P2] Implement detectors.ts with filesystem-based environment detection`

Create the environment detection module using synchronous filesystem checks.

**Steps:**

1. Write `packages/loop-connect/src/lib/detectors.ts`:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Result of scanning the working directory for known agent environments. */
export interface DetectedEnvironment {
  /** CLAUDE.md exists in cwd */
  hasClaudeMd: boolean;
  /** .cursor/ directory exists in cwd */
  hasCursor: boolean;
  /** .openhands/ directory exists in cwd */
  hasOpenHands: boolean;
  /** .mcp.json exists in cwd */
  hasMcpJson: boolean;
  /** .gitignore exists in cwd */
  hasGitignore: boolean;
  /** .env.local is listed in .gitignore */
  envLocalIgnored: boolean;
}

/**
 * Detect agent environments by checking for known files/directories in cwd.
 *
 * @param cwd - Working directory to scan (defaults to process.cwd())
 * @returns Detection results for each supported environment
 */
export function detectEnvironment(cwd: string = process.cwd()): DetectedEnvironment {
  const hasGitignore = existsSync(join(cwd, '.gitignore'));

  let envLocalIgnored = false;
  if (hasGitignore) {
    try {
      const gitignoreContent = readFileSync(join(cwd, '.gitignore'), 'utf-8');
      envLocalIgnored = gitignoreContent.split('\n').some((line) => line.trim() === '.env.local');
    } catch {
      // If we can't read .gitignore, treat as not ignored
    }
  }

  return {
    hasClaudeMd: existsSync(join(cwd, 'CLAUDE.md')),
    hasCursor: existsSync(join(cwd, '.cursor')),
    hasOpenHands: existsSync(join(cwd, '.openhands')),
    hasMcpJson: existsSync(join(cwd, '.mcp.json')),
    hasGitignore,
    envLocalIgnored,
  };
}
```

**Acceptance Criteria:**

- Exports `DetectedEnvironment` interface with 6 boolean fields
- `detectEnvironment()` accepts optional `cwd` parameter (defaults to `process.cwd()`)
- Checks for CLAUDE.md, .cursor/, .openhands/, .mcp.json, .gitignore
- Parses .gitignore to check if `.env.local` is listed
- All filesystem checks are synchronous

**Blocked by:** Task 1.4

---

### Task 2.3: Implement src/templates/ with inline string constants

**Subject:** `[connect-cli] [P2] Implement template modules with inline string constants`

Create template files that export string constants for all file content that the CLI writes. Content is sourced from `packages/loop-skill/templates/` but inlined as constants.

**Steps:**

1. Write `packages/loop-connect/src/templates/claude-md.ts`:

```ts
/** Sentinel comment used to detect if the Loop block has already been appended. */
export const CLAUDE_MD_SENTINEL = '<!-- loop-connect -->';

/** CLAUDE.md append block with Loop integration context. */
export const CLAUDE_MD_BLOCK = `
${CLAUDE_MD_SENTINEL}
## Loop Integration

This project uses [Loop](https://looped.me) as its autonomous improvement engine.
Loop manages issues, signals, projects, and prompt templates via a REST API.

- **Auth:** \`Authorization: Bearer $LOOP_API_KEY\` (stored in \`.env.local\`)
- **API URL:** Configured in \`.env.local\` as \`LOOP_API_URL\`
- **MCP Server:** Configured in \`.mcp.json\` — provides \`loop_get_next_task\`, \`loop_complete_task\`, and more
- **Docs:** https://www.looped.me/docs
- **Dashboard:** https://app.looped.me
`;
```

2. Write `packages/loop-connect/src/templates/mcp-config.ts`:

```ts
/**
 * Build the MCP server entry for .mcp.json.
 *
 * @param apiKey - Loop API key
 * @param apiUrl - Loop API base URL
 * @returns The mcpServers.loop object
 */
export function buildMcpServerEntry(apiKey: string, apiUrl: string) {
  return {
    command: 'npx',
    args: ['-y', '@dork-labs/loop-mcp'],
    env: {
      LOOP_API_KEY: apiKey,
      LOOP_API_URL: apiUrl,
    },
  };
}
```

3. Write `packages/loop-connect/src/templates/cursor-rules.ts` — inline the content from `packages/loop-skill/templates/loop.mdc` as a string constant:

```ts
/** Cursor rules file content for Loop integration. */
export const CURSOR_RULES_CONTENT = `---
description: >
  Use when working with Loop (looped.me), the autonomous improvement engine.
  Apply when: creating or updating issues via the Loop API, ingesting signals,
  fetching the next work item for an agent, managing projects or goals, or
  accessing prompt templates. Loop API base: https://app.looped.me/api.
alwaysApply: false
---

# Loop — Autonomous Improvement Engine

## Auth

\\\`\\\`\\\`bash
export LOOP_API_KEY=loop_...
\\\`\\\`\\\`

All \`/api/*\` endpoints: \`Authorization: Bearer $LOOP_API_KEY\`

## Common Operations

\\\`\\\`\\\`bash
# List open issues
curl -H "Authorization: Bearer $LOOP_API_KEY" \\\\
  "https://app.looped.me/api/issues?status=open"

# Create issue
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"title":"<title>","type":"bug|feature|task"}' \\\\
  https://app.looped.me/api/issues

# Ingest a signal
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"source":"custom","title":"<title>","data":{}}' \\\\
  https://app.looped.me/api/signals
\\\`\\\`\\\`

## Issue Types

\`signal\` | \`hypothesis\` | \`plan\` | \`task\` | \`monitor\`

## Status Values

\`triage\` | \`backlog\` | \`todo\` | \`in_progress\` | \`done\` | \`canceled\`

## Docs

Full API: https://www.looped.me/docs
Machine-readable: https://www.looped.me/llms.txt
`;
```

Note: When implementing, read the actual content from `packages/loop-skill/templates/loop.mdc` and `packages/loop-skill/templates/openhands-loop.md` at implementation time to get the exact current content for the string constants. The code blocks above are illustrative — use the real file content with proper escaping.

4. Write `packages/loop-connect/src/templates/openhands-microagent.ts` — inline the content from `packages/loop-skill/templates/openhands-loop.md`.

**Acceptance Criteria:**

- `claude-md.ts` exports `CLAUDE_MD_SENTINEL` and `CLAUDE_MD_BLOCK` constants
- `mcp-config.ts` exports `buildMcpServerEntry()` function
- `cursor-rules.ts` exports `CURSOR_RULES_CONTENT` constant matching `packages/loop-skill/templates/loop.mdc`
- `openhands-microagent.ts` exports `OPENHANDS_MICROAGENT_CONTENT` constant matching `packages/loop-skill/templates/openhands-loop.md`
- All templates are inline string constants (no file reads at runtime)

**Blocked by:** Task 1.4

---

### Task 2.4: Implement src/lib/writers.ts with all five file writers

**Subject:** `[connect-cli] [P2] Implement writers.ts with five idempotent file writers`

Create the file writers module with `WriteResult` type and five writer functions.

**Steps:**

1. Write `packages/loop-connect/src/lib/writers.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CLAUDE_MD_BLOCK, CLAUDE_MD_SENTINEL } from '../templates/claude-md.js';
import { buildMcpServerEntry } from '../templates/mcp-config.js';
import { CURSOR_RULES_CONTENT } from '../templates/cursor-rules.js';
import { OPENHANDS_MICROAGENT_CONTENT } from '../templates/openhands-microagent.js';

/** Result of a file write operation. */
export interface WriteResult {
  status: 'written' | 'skipped' | 'conflict';
  path: string;
  reason?: string;
}

/**
 * Write or update .env.local with LOOP_API_KEY and LOOP_API_URL.
 *
 * - Creates the file if it doesn't exist
 * - Appends missing keys at end of file
 * - Returns 'skipped' if both keys already match
 * - Returns 'conflict' if a key exists with a different value
 */
export function writeEnvLocal(
  apiKey: string,
  apiUrl: string,
  cwd: string = process.cwd()
): WriteResult {
  const filePath = join(cwd, '.env.local');
  const desired: Record<string, string> = {
    LOOP_API_KEY: apiKey,
    LOOP_API_URL: apiUrl,
  };

  let existing = '';
  if (existsSync(filePath)) {
    existing = readFileSync(filePath, 'utf-8');
  }

  // Parse existing env vars
  const existingVars = new Map<string, string>();
  for (const line of existing.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      existingVars.set(match[1], match[2]);
    }
  }

  // Check for conflicts
  for (const [key, value] of Object.entries(desired)) {
    const existingVal = existingVars.get(key);
    if (existingVal !== undefined && existingVal !== value) {
      return {
        status: 'conflict',
        path: filePath,
        reason: `${key} already set to a different value`,
      };
    }
  }

  // Check if all already present
  const allPresent = Object.entries(desired).every(
    ([key, value]) => existingVars.get(key) === value
  );
  if (allPresent) {
    return { status: 'skipped', path: filePath, reason: 'All keys already set' };
  }

  // Append missing keys
  const lines: string[] = [];
  for (const [key, value] of Object.entries(desired)) {
    if (!existingVars.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  writeFileSync(filePath, existing + separator + lines.join('\n') + '\n', 'utf-8');
  return { status: 'written', path: filePath };
}

/**
 * Write or merge .mcp.json with the Loop MCP server entry.
 *
 * - Creates the file if it doesn't exist
 * - Backs up malformed JSON to .mcp.json.bak
 * - Skips if mcpServers.loop already exists
 * - Preserves existing MCP server entries
 */
export function writeMcpJson(
  apiKey: string,
  apiUrl: string,
  cwd: string = process.cwd()
): WriteResult {
  const filePath = join(cwd, '.mcp.json');
  let config: Record<string, unknown> = {};

  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf-8');
    try {
      config = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Malformed JSON — back up and start fresh
      writeFileSync(join(cwd, '.mcp.json.bak'), raw, 'utf-8');
      config = {};
    }
  }

  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  if (servers.loop) {
    return { status: 'skipped', path: filePath, reason: 'mcpServers.loop already exists' };
  }

  servers.loop = buildMcpServerEntry(apiKey, apiUrl);
  config.mcpServers = servers;

  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return { status: 'written', path: filePath };
}

/**
 * Append the Loop context block to CLAUDE.md.
 *
 * - Checks for sentinel comment to prevent duplicate appends
 * - Skips if sentinel is already present
 */
export function writeClaudeMdBlock(cwd: string = process.cwd()): WriteResult {
  const filePath = join(cwd, 'CLAUDE.md');

  if (!existsSync(filePath)) {
    return { status: 'skipped', path: filePath, reason: 'CLAUDE.md does not exist' };
  }

  const content = readFileSync(filePath, 'utf-8');
  if (content.includes(CLAUDE_MD_SENTINEL)) {
    return { status: 'skipped', path: filePath, reason: 'Loop block already present' };
  }

  const separator = content.endsWith('\n') ? '' : '\n';
  writeFileSync(filePath, content + separator + CLAUDE_MD_BLOCK, 'utf-8');
  return { status: 'written', path: filePath };
}

/**
 * Write Cursor rules file for Loop integration.
 *
 * - Creates .cursor/rules/ directory recursively
 * - Skips if .cursor/rules/loop.mdc already exists
 */
export function writeCursorRules(cwd: string = process.cwd()): WriteResult {
  const filePath = join(cwd, '.cursor', 'rules', 'loop.mdc');

  if (existsSync(filePath)) {
    return { status: 'skipped', path: filePath, reason: 'File already exists' };
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, CURSOR_RULES_CONTENT, 'utf-8');
  return { status: 'written', path: filePath };
}

/**
 * Write OpenHands microagent file for Loop integration.
 *
 * - Creates .openhands/microagents/ directory recursively
 * - Skips if .openhands/microagents/loop.md already exists
 */
export function writeOpenHandsMicroagent(cwd: string = process.cwd()): WriteResult {
  const filePath = join(cwd, '.openhands', 'microagents', 'loop.md');

  if (existsSync(filePath)) {
    return { status: 'skipped', path: filePath, reason: 'File already exists' };
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, OPENHANDS_MICROAGENT_CONTENT, 'utf-8');
  return { status: 'written', path: filePath };
}
```

**Acceptance Criteria:**

- Exports `WriteResult` type with `status`, `path`, and optional `reason`
- `writeEnvLocal()` — creates/appends .env.local, detects conflicts, skips if matching
- `writeMcpJson()` — creates/merges .mcp.json, backs up malformed JSON, preserves existing servers
- `writeClaudeMdBlock()` — appends to CLAUDE.md with sentinel, skips if already present
- `writeCursorRules()` — writes .cursor/rules/loop.mdc, creates directories recursively
- `writeOpenHandsMicroagent()` — writes .openhands/microagents/loop.md, creates directories recursively
- All writers accept `cwd` parameter for testability
- All writers are idempotent — running twice produces same result

**Blocked by:** Task 2.3

---

## Phase 3: Interactive Flow

### Task 3.1: Implement src/index.ts interactive flow with clack prompts

**Subject:** `[connect-cli] [P3] Implement index.ts with full interactive clack prompts flow`

Replace the stub `index.ts` with the full interactive setup flow.

**Steps:**

1. Replace `packages/loop-connect/src/index.ts` with the interactive flow:

```ts
import * as p from '@clack/prompts';
import { AuthError, NetworkError, listProjects, createProject } from './lib/api.js';
import type { LoopProject } from './lib/api.js';
import { detectEnvironment } from './lib/detectors.js';
import {
  writeEnvLocal,
  writeMcpJson,
  writeClaudeMdBlock,
  writeCursorRules,
  writeOpenHandsMicroagent,
} from './lib/writers.js';
import type { WriteResult } from './lib/writers.js';

export interface RunOptions {
  nonInteractive: boolean;
  apiKey?: string;
  apiUrl: string;
}

/** Mask an API key for display: loop_***...{last 4 chars} */
function maskKey(key: string): string {
  if (key.length <= 8) return 'loop_***';
  return `loop_***...${key.slice(-4)}`;
}

/** Format sync validation for the API key password prompt. */
function validateKeyFormat(value: string): string | undefined {
  if (!value.startsWith('loop_')) return 'Key must start with loop_';
  if (value.length < 37) return 'Key is too short';
  return undefined;
}
```

2. Implement the `run()` function with:
   - `p.intro('Loop — Connect your project')`
   - Password prompt for API key with `validateKeyFormat`
   - Spinner to validate key via `listProjects()`
   - On 401 (`AuthError`) → `p.log.error()` + loop back to key prompt
   - On `NetworkError` → `p.log.warn()` + `p.confirm()` to continue without validation
   - `p.select()` for project selection with "Create new project" option
   - If "Create new" → `p.text()` for name → `createProject()`
   - `detectEnvironment()` to determine which files to write
   - Call writers based on detection results
   - `p.note()` with summary of written files (using checkmark/circle/warning symbols)
   - `p.outro('Connected! Visit https://app.looped.me/projects/<id>')`

3. Every prompt result must be checked with `p.isCancel()`. On cancel → `p.cancel('Setup cancelled.')` + `process.exit(0)`

4. Summary output format:

```
Files written:

  ✓ .env.local         — LOOP_API_KEY, LOOP_API_URL
  ✓ .mcp.json          — MCP server config
  ✓ CLAUDE.md          — Loop context block (appended)
  ○ .cursor/rules/     — Skipped (not detected)
  ○ .openhands/        — Skipped (not detected)

  ⚠ Add .env.local to .gitignore

Connected to project: My Project
```

**Acceptance Criteria:**

- Full interactive flow works end-to-end
- API key is never shown in full (masked in all output)
- `validateKeyFormat` checks `loop_` prefix and minimum length
- Auth errors trigger re-prompt loop (not crash)
- Network errors offer to continue without validation
- Project selection includes "Create new project" option
- Summary note shows status of each file write
- Warns about .env.local in .gitignore if needed

**Blocked by:** Tasks 2.1, 2.2, 2.3, 2.4

---

### Task 3.2: Implement --yes non-interactive mode

**Subject:** `[connect-cli] [P3] Implement --yes non-interactive mode`

Add the non-interactive code path to `run()` in `index.ts`.

**Steps:**

1. In `run()`, when `options.nonInteractive` is true:
   - Resolve API key: `options.apiKey` → `process.env.LOOP_API_KEY` → exit with error
   - Validate key via `listProjects()` — on failure, `process.exit(1)` with error message
   - Select first project from API response (no prompt)
   - Call `detectEnvironment()`, write all applicable files (no confirmation)
   - Print summary to stdout and exit

```ts
async function runNonInteractive(options: RunOptions): Promise<void> {
  const apiKey = options.apiKey ?? process.env.LOOP_API_KEY;
  if (!apiKey) {
    console.error('Error: No API key provided. Use --api-key or set LOOP_API_KEY.');
    process.exit(1);
  }

  let projects: LoopProject[];
  try {
    const response = await listProjects(options.apiUrl, apiKey);
    projects = response.data;
  } catch (err) {
    if (err instanceof AuthError) {
      console.error('Error: Invalid API key.');
    } else {
      console.error('Error: Could not reach Loop API.');
    }
    process.exit(1);
  }

  if (projects.length === 0) {
    console.error('Error: No projects found. Create one at https://app.looped.me');
    process.exit(1);
  }

  const project = projects[0];
  console.log(`Using project: ${project.name}`);

  const env = detectEnvironment();
  const results: WriteResult[] = [];

  results.push(writeEnvLocal(apiKey, options.apiUrl));
  if (env.hasMcpJson || env.hasClaudeMd) {
    results.push(writeMcpJson(apiKey, options.apiUrl));
  }
  if (env.hasClaudeMd) results.push(writeClaudeMdBlock());
  if (env.hasCursor) results.push(writeCursorRules());
  if (env.hasOpenHands) results.push(writeOpenHandsMicroagent());

  for (const r of results) {
    const icon = r.status === 'written' ? '✓' : '○';
    console.log(`  ${icon} ${r.path}${r.reason ? ` — ${r.reason}` : ''}`);
  }

  console.log(`\nConnected to project: ${project.name}`);
}
```

**Acceptance Criteria:**

- `--yes --api-key <key>` completes without any interactive prompts
- Falls back to `LOOP_API_KEY` env var if `--api-key` not provided
- Exits with code 1 and error message on missing key, auth failure, or network error
- Uses first project from API response
- Writes all applicable files based on environment detection
- Prints summary to stdout

**Blocked by:** Task 3.1

---

### Task 3.3: Handle cancellation at every prompt

**Subject:** `[connect-cli] [P3] Handle cancellation with isCancel() at every prompt point`

Ensure all prompt results are checked for cancellation.

**Steps:**

1. After every `p.password()`, `p.select()`, `p.text()`, and `p.confirm()` call in `index.ts`, add:

```ts
if (p.isCancel(result)) {
  p.cancel('Setup cancelled.');
  process.exit(0);
}
```

2. Verify this applies to:
   - API key password prompt
   - Project selection prompt
   - New project name text prompt
   - Network error continue confirmation
   - Any overwrite confirmation for conflicts

**Acceptance Criteria:**

- Pressing Ctrl+C or Escape at any prompt cleanly exits with "Setup cancelled."
- Exit code is 0 (not an error)
- No dangling spinners or partial output on cancellation

**Blocked by:** Task 3.1

---

## Phase 4: Testing

### Task 4.1: Unit tests for api.ts

**Subject:** `[connect-cli] [P4] Write unit tests for api.ts — mock fetch, test success/401/network`

**Steps:**

1. Write `packages/loop-connect/__tests__/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listProjects, createProject, AuthError, NetworkError, ApiError } from '../src/lib/api.js';

describe('api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listProjects', () => {
    it('returns project list on success', async () => {
      const mockResponse = {
        data: [{ id: '1', name: 'Test', status: 'active', description: null }],
        total: 1,
      };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const result = await listProjects(
        'https://app.looped.me',
        'loop_test_key_1234567890abcdefgh'
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Test');
    });

    it('throws AuthError on 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 })
      );

      await expect(listProjects('https://app.looped.me', 'loop_bad_key')).rejects.toThrow(
        AuthError
      );
    });

    it('throws NetworkError on fetch failure', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));

      await expect(listProjects('https://app.looped.me', 'loop_key')).rejects.toThrow(NetworkError);
    });

    it('throws ApiError on other HTTP errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Internal Server Error', { status: 500 })
      );

      await expect(listProjects('https://app.looped.me', 'loop_key')).rejects.toThrow(ApiError);
    });

    it('passes Authorization header', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ data: [], total: 0 }), { status: 200 }));

      await listProjects('https://api.test', 'loop_mykey123');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.test/api/projects',
        expect.objectContaining({
          headers: { Authorization: 'Bearer loop_mykey123' },
        })
      );
    });
  });

  describe('createProject', () => {
    it('returns created project on success', async () => {
      const mockProject = { id: '2', name: 'New', status: 'active', description: null };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify(mockProject), { status: 201 })
      );

      const result = await createProject(
        'https://app.looped.me',
        'loop_key_1234567890abcdefgh',
        'New'
      );
      expect(result.name).toBe('New');
    });

    it('sends project name in body', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(
            JSON.stringify({ id: '1', name: 'X', status: 'active', description: null }),
            { status: 201 }
          )
        );

      await createProject('https://api.test', 'loop_key', 'My Project');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.test/api/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My Project' }),
        })
      );
    });

    it('throws AuthError on 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 })
      );

      await expect(createProject('https://app.looped.me', 'bad', 'X')).rejects.toThrow(AuthError);
    });
  });
});
```

**Acceptance Criteria:**

- Tests mock `globalThis.fetch` (no real network calls)
- Tests cover: success, 401 (AuthError), network failure (NetworkError), 500 (ApiError)
- Tests verify correct URL construction and headers
- Tests verify POST body content for `createProject`
- All tests pass with `vitest run`

**Blocked by:** Task 2.1

---

### Task 4.2: Unit tests for detectors.ts

**Subject:** `[connect-cli] [P4] Write unit tests for detectors.ts — mock fs, test all combinations`

**Steps:**

1. Write `packages/loop-connect/__tests__/detectors.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectEnvironment } from '../src/lib/detectors.js';
import * as fs from 'node:fs';

vi.mock('node:fs');

describe('detectors', () => {
  const mockExistsSync = vi.mocked(fs.existsSync);
  const mockReadFileSync = vi.mocked(fs.readFileSync);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects all environments when all files exist', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('.env.local\nnode_modules\n');

    const result = detectEnvironment('/test');
    expect(result).toEqual({
      hasClaudeMd: true,
      hasCursor: true,
      hasOpenHands: true,
      hasMcpJson: true,
      hasGitignore: true,
      envLocalIgnored: true,
    });
  });

  it('detects no environments when no files exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = detectEnvironment('/test');
    expect(result).toEqual({
      hasClaudeMd: false,
      hasCursor: false,
      hasOpenHands: false,
      hasMcpJson: false,
      hasGitignore: false,
      envLocalIgnored: false,
    });
  });

  it('detects .gitignore without .env.local entry', () => {
    mockExistsSync.mockImplementation((path) => {
      if (String(path).endsWith('.gitignore')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('node_modules\ndist\n');

    const result = detectEnvironment('/test');
    expect(result.hasGitignore).toBe(true);
    expect(result.envLocalIgnored).toBe(false);
  });

  it('handles .gitignore read failure gracefully', () => {
    mockExistsSync.mockImplementation((path) => {
      if (String(path).endsWith('.gitignore')) return true;
      return false;
    });
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES');
    });

    const result = detectEnvironment('/test');
    expect(result.hasGitignore).toBe(true);
    expect(result.envLocalIgnored).toBe(false);
  });

  it('uses process.cwd() as default cwd', () => {
    mockExistsSync.mockReturnValue(false);
    detectEnvironment();
    expect(mockExistsSync).toHaveBeenCalled();
  });
});
```

**Acceptance Criteria:**

- Tests mock `node:fs` module (`existsSync`, `readFileSync`)
- Tests cover: all present, none present, partial presence
- Tests verify .gitignore parsing for `.env.local`
- Tests verify graceful handling of .gitignore read failure
- All tests pass with `vitest run`

**Blocked by:** Task 2.2

---

### Task 4.3: Unit tests for writers.ts

**Subject:** `[connect-cli] [P4] Write unit tests for writers.ts — mock fs, test idempotency`

**Steps:**

1. Write `packages/loop-connect/__tests__/writers.test.ts`:

Test scenarios for each writer:

**writeEnvLocal:**

- Creates new .env.local when none exists
- Appends missing keys to existing .env.local
- Returns 'skipped' when all keys already match
- Returns 'conflict' when a key exists with different value

**writeMcpJson:**

- Creates new .mcp.json when none exists
- Merges into existing .mcp.json preserving other servers
- Returns 'skipped' when mcpServers.loop already exists
- Backs up malformed JSON and starts fresh

**writeClaudeMdBlock:**

- Appends block to CLAUDE.md without sentinel
- Returns 'skipped' when sentinel already present
- Returns 'skipped' when CLAUDE.md doesn't exist

**writeCursorRules:**

- Creates file and directories when .cursor/ exists but no rules file
- Returns 'skipped' when file already exists

**writeOpenHandsMicroagent:**

- Creates file and directories when .openhands/ exists but no microagent
- Returns 'skipped' when file already exists

All tests should mock `node:fs` and verify:

- Correct file paths used
- Correct content written
- `WriteResult` has correct `status` and `path`
- Idempotency: calling twice produces same result (second call returns 'skipped')

**Acceptance Criteria:**

- Comprehensive tests for all five writers
- Mock `node:fs` — no real filesystem access
- Test write, skip, and conflict cases
- Verify idempotency behavior
- All tests pass with `vitest run`

**Blocked by:** Task 2.4

---

### Task 4.4: Integration test for the full flow

**Subject:** `[connect-cli] [P4] Write integration test for index.ts — mock api + fs, verify full flow`

**Steps:**

1. Write `packages/loop-connect/__tests__/index.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), success: vi.fn() },
  note: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  isCancel: vi.fn(() => false),
}));

// Mock fetch
vi.spyOn(globalThis, 'fetch');

// Mock fs
vi.mock('node:fs');
```

Test scenarios:

- Happy path: valid key → select project → write files → success outro
- Auth error: invalid key → re-prompt → valid key → success
- Network error: fetch fails → warn → confirm continue → write files
- Non-interactive: --yes mode completes without prompts
- Cancellation: user cancels at key prompt → clean exit

**Acceptance Criteria:**

- Tests mock `@clack/prompts`, `fetch`, and `node:fs`
- No real API calls or filesystem access
- Happy path test verifies full flow from intro to outro
- Auth error test verifies re-prompt behavior
- Network error test verifies graceful degradation
- Non-interactive test verifies --yes mode
- Cancellation test verifies clean exit
- All tests pass with `vitest run`

**Blocked by:** Tasks 3.1, 3.2, 3.3

---

## Phase 5: Monorepo Integration

### Task 5.1: Run npm install and verify package linking

**Subject:** `[connect-cli] [P5] Run npm install from root and verify package links correctly`

**Steps:**

1. Run `npm install` from monorepo root
2. Verify `node_modules/@dork-labs/loop-connect` is symlinked to `packages/loop-connect/`
3. Verify no dependency resolution errors

**Acceptance Criteria:**

- `npm install` completes without errors
- Package is linked in `node_modules`

**Blocked by:** All Phase 4 tasks

---

### Task 5.2: Run typecheck across the monorepo

**Subject:** `[connect-cli] [P5] Run npm run typecheck and fix any type errors`

**Steps:**

1. Run `npm run typecheck` from monorepo root
2. Fix any TypeScript errors in `packages/loop-connect/`
3. Verify no regressions in other packages

**Acceptance Criteria:**

- `npm run typecheck` passes with zero errors
- No regressions in existing packages

**Blocked by:** Task 5.1

---

### Task 5.3: Run lint and fix any issues

**Subject:** `[connect-cli] [P5] Run npm run lint and fix any lint issues`

**Steps:**

1. Run `npm run lint` from monorepo root
2. Fix any ESLint issues in `packages/loop-connect/`
3. Run `npm run format` to apply Prettier formatting
4. Run `npm run format:check` to verify

**Acceptance Criteria:**

- `npm run lint` passes with zero errors
- `npm run format:check` passes

**Blocked by:** Task 5.1

---

### Task 5.4: Run tests and verify all pass

**Subject:** `[connect-cli] [P5] Run npm test and verify all tests pass`

**Steps:**

1. Run `npm test` from monorepo root
2. Verify all tests in `packages/loop-connect/` pass
3. Verify no regressions in other packages

**Acceptance Criteria:**

- `npm test` passes with zero failures
- No regressions in existing test suites

**Blocked by:** Task 5.2, Task 5.3

---

### Task 5.5: Run build and verify package output

**Subject:** `[connect-cli] [P5] Run npm run build and verify package builds correctly`

**Steps:**

1. Run `npm run build` from monorepo root
2. Verify `packages/loop-connect/dist/bin.js` is produced
3. Verify `dist/bin.js` contains shebang
4. Run `npm pack --dry-run` from `packages/loop-connect/` and verify only `dist/` files
5. Verify `node packages/loop-connect/dist/bin.js --help` executes without error

**Acceptance Criteria:**

- `npm run build` completes without errors
- `dist/bin.js` exists with shebang header
- `npm pack --dry-run` shows only `dist/` contents
- Binary executes without crashing

**Blocked by:** Task 5.4

---

## Dependency Graph

```
Phase 1 (Sequential):
  1.1 → 1.2 → 1.3
                1.4 → 1.5

Phase 2 (Parallel after 1.4):
  1.4 → 2.1
  1.4 → 2.2
  1.4 → 2.3 → 2.4

Phase 3 (After Phase 2):
  2.1 + 2.2 + 2.3 + 2.4 → 3.1 → 3.2
                            3.1 → 3.3

Phase 4 (Parallel, after respective sources):
  2.1 → 4.1
  2.2 → 4.2
  2.4 → 4.3
  3.1 + 3.2 + 3.3 → 4.4

Phase 5 (Sequential, after Phase 4):
  4.* → 5.1 → 5.2
               5.3
         5.2 + 5.3 → 5.4 → 5.5
```

## Parallel Execution Opportunities

1. **Phase 2 (Tasks 2.1, 2.2, 2.3):** api.ts, detectors.ts, and templates can be built in parallel after Task 1.4
2. **Phase 4 (Tasks 4.1, 4.2, 4.3):** Unit tests for api, detectors, and writers can be written in parallel
3. **Phase 5 (Tasks 5.2, 5.3):** Typecheck and lint can run in parallel

## Summary

| Phase     | Tasks  | Description                                     |
| --------- | ------ | ----------------------------------------------- |
| 1         | 5      | Package scaffolding                             |
| 2         | 4      | Core logic (api, detectors, writers, templates) |
| 3         | 3      | Interactive flow + non-interactive mode         |
| 4         | 4      | Unit + integration tests                        |
| 5         | 5      | Monorepo integration checks                     |
| **Total** | **21** |                                                 |
