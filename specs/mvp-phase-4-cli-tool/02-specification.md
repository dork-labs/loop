---
slug: mvp-phase-4-cli-tool
number: 5
created: 2026-02-20
status: draft
---

# Specification: MVP Phase 4 — CLI Tool (`looped`)

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-20
**Ideation:** [01-ideation.md](./01-ideation.md)
**Research:** [research/20260220_mvp-phase-4-cli-tool.md](../../research/20260220_mvp-phase-4-cli-tool.md)

---

## 1. Overview

Build `looped`, a CLI tool that provides full command-line access to the Loop REST API. Loop is a DorkOS module ([dorkos.ai](https://www.dorkos.ai)). The CLI is a thin HTTP client — no direct database access. It covers issue management, signal submission, triage, projects/goals, prompt templates, dispatch, configuration, and system status.

Published as npm package `looped` with binary `looped`. Lives in `apps/cli/` in the Turborepo monorepo.

## 2. Background / Problem Statement

Loop's API (Phases 1-2) and dashboard (Phase 3) are complete. Developers and AI agents need a fast, scriptable interface to Loop that works in terminals, CI pipelines, and automation scripts. The CLI completes the MVP by providing the command-line interface described in the [Loop MVP spec](../../meta/loop-mvp.md#cli).

The CLI is the primary interface for:

- Agents (DorkOS) interacting with Loop programmatically
- Developers managing issues, signals, and triage from the terminal
- CI/CD pipelines submitting signals and checking status
- Debugging dispatch behavior and prompt template selection

## 3. Goals

- Expose all Loop API functionality via intuitive CLI commands
- Support both interactive (TTY) and scriptable (piped/CI) usage
- Provide formatted table output by default, raw JSON via `--json`
- Persist configuration across sessions in `~/.loop/config.json`
- Be installable via `npx looped` without global install
- Follow existing monorepo patterns (ESM, TypeScript, Vitest)

## 4. Non-Goals

- Interactive TUI (post-MVP)
- Shell completions / tab autocomplete (post-MVP)
- Plugin system (post-MVP)
- Auto-update mechanism
- Multi-user auth / OAuth flows
- Shared types package extraction (follow-up)
- Webhook management (webhooks are server-side only)
- Direct database access

## 5. Technical Dependencies

| Package             | Version          | Purpose                                               |
| ------------------- | ---------------- | ----------------------------------------------------- |
| `commander`         | `^14`            | CLI framework — subcommands, options, help generation |
| `ky`                | `^1.14`          | HTTP client (already in monorepo via `@loop/app`)     |
| `picocolors`        | `^1`             | Terminal colors (7KB, zero deps)                      |
| `cli-table3`        | `^0.6`           | Table output formatting                               |
| `nanospinner`       | `^1`             | Loading spinners (20KB)                               |
| `@inquirer/prompts` | `^7`             | Interactive prompts for TTY mode                      |
| `tsup`              | `^8` (dev)       | ESM bundling with shebang preservation                |
| `typescript`        | `^5` (dev)       | Type checking                                         |
| `@types/node`       | `^20` (dev)      | Node.js type definitions                              |
| `vitest`            | (workspace root) | Testing framework                                     |

## 6. Detailed Design

### 6.1 Project Structure

```
apps/cli/
├── package.json              # name: "looped", bin: { looped: ./dist/bin.js }
├── tsconfig.json             # extends root, target ES2022
├── tsup.config.ts            # ESM output, entry: src/bin.ts
├── vitest.config.ts          # test config
├── src/
│   ├── bin.ts                # #!/usr/bin/env node — entry point
│   ├── cli.ts                # Root Commander program + global options
│   ├── commands/
│   │   ├── config.ts         # config set / get / list
│   │   ├── issues.ts         # list, show, create
│   │   ├── comment.ts        # comment on issue
│   │   ├── signal.ts         # signal submission
│   │   ├── triage.ts         # triage queue, accept, decline
│   │   ├── projects.ts       # projects list
│   │   ├── goals.ts          # goals list
│   │   ├── templates.ts      # templates list, show, promote
│   │   ├── dispatch.ts       # next, dispatch (force-claim)
│   │   └── status.ts         # system health
│   ├── lib/
│   │   ├── api-client.ts     # ky instance factory
│   │   ├── config.ts         # ~/.loop/config.json read/write
│   │   ├── output.ts         # Table rendering + JSON helpers
│   │   └── errors.ts         # Error handler (HTTPError → message)
│   └── types.ts              # Manual API response types
└── __tests__/
    ├── lib/
    │   ├── config.test.ts
    │   ├── api-client.test.ts
    │   └── output.test.ts
    └── commands/
        ├── issues.test.ts
        ├── signal.test.ts
        ├── triage.test.ts
        └── config.test.ts
```

### 6.2 Package Configuration

**`package.json`:**

```json
{
  "name": "looped",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "looped": "./dist/bin.js"
  },
  "files": ["dist"],
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@inquirer/prompts": "^7",
    "cli-table3": "^0.6",
    "commander": "^14",
    "ky": "^1.14",
    "nanospinner": "^1",
    "picocolors": "^1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "tsup": "^8",
    "typescript": "^5"
  }
}
```

Note: `"private"` is intentionally omitted — this package is publishable to npm.

**`tsup.config.ts`:**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  sourcemap: true,
  dts: false,
});
```

**`tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

### 6.3 Entry Point & Root Command

**`src/bin.ts`:**

```typescript
#!/usr/bin/env node
import { program } from './cli.js';
program.parseAsync();
```

**`src/cli.ts`** — Root Commander program:

```typescript
import { Command } from 'commander';
// Import all command modules
import { registerConfigCommand } from './commands/config.js';
import { registerIssuesCommand } from './commands/issues.js';
// ... etc

export const program = new Command();

program
  .name('looped')
  .description('CLI for the Loop autonomous improvement engine')
  .version('0.1.0')
  .option('--json', 'Output raw JSON instead of formatted tables')
  .option('--api-url <url>', 'Override API URL for this invocation')
  .option('--token <token>', 'Override auth token for this invocation');

// Register all subcommands
registerConfigCommand(program);
registerIssuesCommand(program);
// ... etc
```

Global options (`--json`, `--api-url`, `--token`) are accessible in every command via `program.opts()`.

### 6.4 Configuration (`lib/config.ts`)

Config file: `~/.loop/config.json`

**Schema:**

```typescript
interface LoopConfig {
  url?: string; // API base URL (e.g., "https://api.looped.me")
  token?: string; // Bearer token for authentication
}
```

**Resolution order** (highest priority first):

1. CLI flags (`--api-url`, `--token`)
2. Environment variables (`LOOP_API_URL`, `LOOP_API_TOKEN`)
3. Config file (`~/.loop/config.json`)

**Implementation:**

- Read: `JSON.parse(fs.readFileSync(configPath, 'utf-8'))` with graceful fallback to `{}`
- Write: `fs.mkdirSync(dir, { recursive: true })` then `fs.writeFileSync(configPath, JSON.stringify(config, null, 2))` with mode `0o600`
- Config path: `path.join(os.homedir(), '.loop', 'config.json')`

**`config set` masks token in confirmation output** (shows first 4 + last 4 chars).

### 6.5 API Client (`lib/api-client.ts`)

Factory function that creates a configured ky instance:

```typescript
import ky from 'ky';
import { resolveConfig } from './config.js';

export function createApiClient(globalOpts?: GlobalOptions): typeof ky {
  const { url, token } = resolveConfig(globalOpts);

  if (!url) {
    console.error('No API URL configured. Run: looped config set url <url>');
    process.exit(1);
  }
  if (!token) {
    console.error('No auth token configured. Run: looped config set token <token>');
    process.exit(1);
  }

  return ky.create({
    prefixUrl: url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    retry: {
      limit: 2,
      statusCodes: [429, 500, 503],
    },
  });
}
```

### 6.6 Error Handling (`lib/errors.ts`)

Centralized error handler wrapping every command action:

```typescript
export async function withErrorHandler(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof HTTPError) {
      const status = error.response.status;
      const body = await error.response.json().catch(() => null);
      const message = body?.error ?? error.message;

      if (status === 401 || status === 403) {
        console.error('Authentication failed. Run: looped config set token <your-token>');
      } else if (status === 404) {
        console.error(`Not found: ${message}`);
      } else {
        console.error(`API error (${status}): ${message}`);
      }
    } else {
      console.error(`Error: ${(error as Error).message}`);
    }
    process.exit(1);
  }
}
```

**Exit codes:** 0 = success, 1 = runtime error, 2 = usage error (Commander auto-handles)

### 6.7 Output Formatting (`lib/output.ts`)

**Table rendering** with cli-table3 + picocolors:

```typescript
import Table from 'cli-table3';
import pc from 'picocolors';

// Color maps
const STATUS_COLOR: Record<string, (s: string) => string> = {
  triage: pc.yellow,
  todo: pc.cyan,
  backlog: pc.dim,
  in_progress: pc.blue,
  done: pc.green,
  canceled: pc.red,
};

const PRIORITY_LABEL: Record<number, string> = {
  0: pc.dim('none'),
  1: pc.red('urgent'),
  2: pc.yellow('high'),
  3: pc.white('medium'),
  4: pc.dim('low'),
};

const TYPE_ICON: Record<string, string> = {
  signal: '⚡',
  hypothesis: '🔬',
  plan: '📋',
  task: '🔧',
  monitor: '👁',
};
```

**JSON mode:** When `--json` is set, write raw JSON to stdout via `JSON.stringify(data, null, 2)`. No colors, no table formatting.

**Pattern for every command:**

```typescript
if (opts.json) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else {
  renderIssueTable(result.data);
}
```

### 6.8 Types (`types.ts`)

Manual type definitions matching API response shapes. These are the CLI's view of the API — not shared with the API package.

```typescript
// Core enums
export type IssueStatus = 'triage' | 'todo' | 'backlog' | 'in_progress' | 'done' | 'canceled';
export type IssueType = 'signal' | 'hypothesis' | 'plan' | 'task' | 'monitor';
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ProjectStatus = 'backlog' | 'planned' | 'active' | 'on_hold' | 'completed';
export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track';
export type GoalStatus = 'active' | 'achieved' | 'abandoned';
export type VersionStatus = 'active' | 'draft' | 'retired';

// Response wrappers
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export interface SingleResponse<T> {
  data: T;
}

// Entities
export interface Issue {
  id: string;
  number: number;
  title: string;
  description?: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: number;
  parentId?: string | null;
  projectId?: string | null;
  signalSource?: string | null;
  signalPayload?: Record<string, unknown> | null;
  hypothesis?: HypothesisData | null;
  agentSessionId?: string | null;
  agentSummary?: string | null;
  commits?: unknown[] | null;
  pullRequests?: unknown[] | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueDetail extends Issue {
  parent?: Issue | null;
  children: Issue[];
  labels: Label[];
  relations: IssueRelation[];
}

export interface HypothesisData {
  statement: string;
  confidence: number;
  evidence: string[];
  validationCriteria: string;
  prediction?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  goalId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string | null;
  metric?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  status: GoalStatus;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface IssueRelation {
  id: string;
  issueId: string;
  relatedIssueId: string;
  type: string;
  createdAt: string;
}

export interface Signal {
  id: string;
  source: string;
  sourceId?: string | null;
  type: string;
  severity: SignalSeverity;
  payload: Record<string, unknown>;
  issueId: string;
  createdAt: string;
}

export interface PromptTemplate {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  conditions: Record<string, unknown>;
  specificity: number;
  activeVersionId?: string | null;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  version: number;
  content: string;
  changelog?: string | null;
  authorType: string;
  authorName: string;
  status: VersionStatus;
  reviewScore?: number | null;
  usageCount: number;
  completionRate?: number | null;
  createdAt: string;
}

export interface DashboardStats {
  issues: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  goals: {
    total: number;
    active: number;
    achieved: number;
  };
  dispatch: {
    queueDepth: number;
    activeCount: number;
    completedLast24h: number;
  };
}

export interface DispatchQueueItem {
  issue: Issue;
  score: number;
  breakdown: {
    priorityWeight: number;
    goalBonus: number;
    ageBonus: number;
    typeBonus: number;
  };
}
```

## 7. Command Reference

### 7.1 `looped config`

| Command                           | API Call     | Description                                   |
| --------------------------------- | ------------ | --------------------------------------------- |
| `looped config set <key> <value>` | None (local) | Set `url` or `token` in `~/.loop/config.json` |
| `looped config get <key>`         | None (local) | Print config value                            |
| `looped config list`              | None (local) | Print all config (token masked)               |

`config set token` masks output: `Token set: tok_****abcd`

### 7.2 `looped list`

List issues with filtering and pagination.

| Option           | Maps to API Query Param | Description                   |
| ---------------- | ----------------------- | ----------------------------- |
| `--status <s>`   | `?status=<s>`           | Filter by status              |
| `--type <t>`     | `?type=<t>`             | Filter by issue type          |
| `--project <id>` | `?projectId=<id>`       | Filter by project             |
| `--priority <n>` | `?priority=<n>`         | Filter by priority (0-4)      |
| `--limit <n>`    | `?limit=<n>`            | Results per page (default 50) |
| `--offset <n>`   | `?offset=<n>`           | Pagination offset             |

**API:** `GET /api/issues`

**Table columns:** `#`, `TYPE`, `TITLE`, `STATUS`, `PRI`, `PROJECT`, `CREATED`

### 7.3 `looped show <id>`

Show issue detail including parent, children, labels, and relations.

**API:** `GET /api/issues/:id`

**Output sections:**

- Header: `#42 [🔧 task] Fix login timeout`
- Metadata: status, priority, project, labels
- Description (if present)
- Parent issue (if child)
- Children (if parent, as table)
- Relations (blocking/blocked by)
- Agent results (if present): summary, commits, PRs

### 7.4 `looped create <title>`

Create a new issue.

| Flag                   | Default (non-TTY) | Description       |
| ---------------------- | ----------------- | ----------------- |
| `--type <t>`           | `task`            | Issue type        |
| `--priority <n>`       | `3`               | Priority (0-4)    |
| `--project <id>`       | none              | Project ID        |
| `--description <text>` | none              | Issue description |
| `--parent <id>`        | none              | Parent issue ID   |

**TTY mode:** If `--type` or `--priority` not provided and `process.stdout.isTTY`, prompt interactively:

1. Select type (signal/hypothesis/plan/task/monitor)
2. Select priority (0-4 with labels)
3. Optionally select project (fetches project list from API)

**API:** `POST /api/issues`

### 7.5 `looped comment <issueId> <body>`

Add a comment to an issue.

**API:** `POST /api/issues/:id/comments`

Request body: `{ body, authorName: "looped-cli", authorType: "human" }`

### 7.6 `looped signal <message>`

Submit a manual signal, which creates a Signal record and a linked triage Issue.

| Flag               | Default    | Description                 |
| ------------------ | ---------- | --------------------------- |
| `--source <s>`     | `"manual"` | Signal source identifier    |
| `--severity <sev>` | `"medium"` | critical, high, medium, low |
| `--project <id>`   | none       | Project ID                  |

**API:** `POST /api/signals`

Request body:

```json
{
  "source": "manual",
  "type": "manual-signal",
  "severity": "medium",
  "payload": { "message": "<user message>" },
  "projectId": "<optional>"
}
```

**Output:** Shows created signal ID and linked triage issue number.

### 7.7 `looped triage`

| Command                               | API Call                                                                           | Description                |
| ------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------- |
| `looped triage`                       | `GET /api/issues?status=triage`                                                    | Show triage queue as table |
| `looped triage accept <id>`           | `PATCH /api/issues/:id` `{ status: "backlog" }`                                    | Accept into backlog        |
| `looped triage decline <id> [reason]` | `PATCH /api/issues/:id` `{ status: "canceled" }` + `POST /api/issues/:id/comments` | Cancel with reason         |

`decline` without a reason: sets status to canceled only.
`decline` with a reason: also posts a comment with `authorName: "looped-cli"`, `authorType: "human"`.

### 7.8 `looped projects`

List all projects.

**API:** `GET /api/projects`

**Table columns:** `ID`, `NAME`, `STATUS`, `HEALTH`, `CREATED`

### 7.9 `looped goals`

List all goals with progress indicators.

**API:** `GET /api/goals`

**Table columns:** `ID`, `TITLE`, `STATUS`, `PROGRESS` (formatted as `currentValue/targetValue unit`), `PROJECT`

### 7.10 `looped templates`

| Command                                | API Call                                                      | Description                |
| -------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| `looped templates`                     | `GET /api/templates`                                          | List templates             |
| `looped templates show <id>`           | `GET /api/templates/:id` + `GET /api/templates/:id/versions`  | Template detail + versions |
| `looped templates promote <versionId>` | `POST /api/templates/:templateId/versions/:versionId/promote` | Promote version to active  |

**List table columns:** `ID`, `SLUG`, `NAME`, `ACTIVE VERSION`, `REVIEW SCORE`, `USAGE`

**Show output:** Template metadata + version history table + review score summary.

**Promote:** Requires the template ID. The CLI resolves this by first fetching the version to get its `templateId`, then calling the promote endpoint.

### 7.11 `looped next`

Preview the dispatch queue without claiming any issues.

**API:** `GET /api/dispatch/queue`

**Table columns:** `#`, `TYPE`, `TITLE`, `PRI`, `SCORE`, `BREAKDOWN`

Score breakdown shows: `pri:75 + goal:20 + age:3 + type:20 = 118`

### 7.12 `looped dispatch <id>`

Force-claim a specific issue by setting its status to `in_progress`.

**API:** `PATCH /api/issues/:id` with body `{ "status": "in_progress" }`

**Output:** Confirmation message with issue number and title.

### 7.13 `looped status`

Show system health overview.

**API:** `GET /api/dashboard/stats`

**Output (formatted):**

```
Loop Status
───────────────────────────
Issues:     42 total
  Triage:    3   Todo:     8   In Progress:  2
  Backlog:  15   Done:    12   Canceled:     2

Dispatch:
  Queue:     8   Active:   2   Done (24h):   5

Goals:
  Active:    2   Achieved: 1   Total:        3
```

## 8. User Experience

### 8.1 First-Time Setup

```bash
# Install globally (or use npx)
npm install -g looped

# Configure API endpoint and auth token
looped config set url https://api.looped.me
looped config set token tok_your_api_key_here

# Verify connection
looped status
```

### 8.2 Typical Workflows

**Developer checking the queue:**

```bash
looped list --status todo          # What's ready to work on?
looped show abc123                 # Get details on an issue
looped triage                      # Check triage queue
looped triage accept def456        # Accept a signal into backlog
```

**Agent/CI submitting a signal:**

```bash
LOOP_API_URL=https://api.looped.me \
LOOP_API_TOKEN=tok_... \
looped signal --severity high "Checkout error rate spike: 5.2% → 12.1%"
```

**Scripting with JSON output:**

```bash
looped list --status in_progress --json | jq '.[].title'
```

### 8.3 Interactive vs Non-Interactive

| Context        | Behavior                                                        |
| -------------- | --------------------------------------------------------------- |
| TTY (terminal) | Colored output, interactive prompts, spinners                   |
| Piped / CI     | Plain JSON-safe output, no prompts (uses defaults), no spinners |

Detection: `process.stdout.isTTY` for output, `process.stdin.isTTY` for input prompts.

## 9. Testing Strategy

### 9.1 Unit Tests (`lib/`)

**`config.test.ts`:**

- Reads config from file, returns empty object when missing
- Writes config with correct permissions (0o600)
- Creates `~/.loop/` directory if it doesn't exist
- Resolution order: CLI flags > env vars > config file
- Masks token in output

**`api-client.test.ts`:**

- Creates ky instance with correct prefixUrl and Authorization header
- Exits with error when url/token missing
- Uses global options when provided

**`output.test.ts`:**

- Renders issue table with correct columns and colors
- JSON mode outputs valid JSON to stdout
- Handles empty data arrays gracefully
- Truncates long titles in table mode

### 9.2 Command Tests (`commands/`)

Each command test mocks `createApiClient()` and verifies:

1. Correct HTTP method and path called
2. Correct query parameters passed
3. Correct request body sent
4. Output formatted correctly (table or JSON)

**Example test structure:**

```typescript
import { vi, describe, it, expect } from 'vitest';

// Mock the api-client module
vi.mock('../lib/api-client.js', () => ({
  createApiClient: vi.fn(() => ({
    get: vi.fn().mockReturnValue({ json: () => mockResponse }),
    post: vi.fn().mockReturnValue({ json: () => mockResponse }),
    patch: vi.fn().mockReturnValue({ json: () => mockResponse }),
  })),
}));
```

**Key command tests:**

- `issues.test.ts`: list with filters, show by ID, create with flags vs interactive
- `signal.test.ts`: submit signal with defaults, with all flags
- `triage.test.ts`: list triage queue, accept (patches to backlog), decline with reason (patches + comment)
- `config.test.ts`: set/get/list operations, token masking

### 9.3 Testing Interactive Prompts

For TTY-dependent behavior, tests should:

- Mock `process.stdout.isTTY` and `process.stdin.isTTY`
- Mock `@inquirer/prompts` to return predefined answers
- Verify non-TTY mode uses defaults without prompting

### 9.4 Test Infrastructure

- Use Vitest (consistent with monorepo workspace)
- No real API calls — all HTTP mocked
- Tests run via `npm test` in `apps/cli/` or `npm test` at root (Turborepo)

## 10. Performance Considerations

- **Cold start:** Commander + ky + picocolors is lightweight (~500KB total). No heavy framework overhead.
- **Bundle:** tsup bundles to a single ESM file, avoiding module resolution at startup.
- **Network:** ky retries 2x on 429/500/503 with exponential backoff. Timeout defaults to 10 seconds.
- **Large lists:** All list commands support `--limit` and `--offset` for pagination. Default limit is 50.

## 11. Security Considerations

- **Token storage:** Config file created with mode `0o600` (owner read/write only)
- **Token display:** `config list` and `config set token` mask the token (show first 4 + last 4 chars)
- **CLI flags:** `--token` flag value may appear in shell history. Document that env vars (`LOOP_API_TOKEN`) are preferred for CI.
- **No secrets in stdout:** Error messages never include the full token
- **HTTPS:** The CLI does not enforce HTTPS, but documentation recommends it for production

## 12. Documentation

After implementation, update:

1. **`CLAUDE.md`:** Add CLI section with commands and setup instructions
2. **`README.md`:** Add CLI installation and quickstart
3. **`apps/cli/README.md`:** Create with full command reference
4. **`meta/loop-mvp.md`:** Mark Phase 4 CLI as complete

## 13. Implementation Phases

### Phase 1: Foundation (infrastructure)

Set up the CLI project and core libraries.

**Files:**

- `apps/cli/package.json`
- `apps/cli/tsconfig.json`
- `apps/cli/tsup.config.ts`
- `apps/cli/vitest.config.ts`
- `apps/cli/src/bin.ts`
- `apps/cli/src/cli.ts`
- `apps/cli/src/types.ts`
- `apps/cli/src/lib/config.ts`
- `apps/cli/src/lib/api-client.ts`
- `apps/cli/src/lib/output.ts`
- `apps/cli/src/lib/errors.ts`
- `apps/cli/src/commands/config.ts`

**Deliverables:**

- CLI scaffolding builds and runs (`npx looped --help`)
- `looped config set/get/list` works
- API client connects and authenticates
- Table and JSON output helpers work
- Error handling covers all HTTP error cases
- Unit tests for all `lib/` modules

### Phase 2: Core Commands (issues, signals, triage)

The most-used commands for daily workflow.

**Files:**

- `apps/cli/src/commands/issues.ts`
- `apps/cli/src/commands/comment.ts`
- `apps/cli/src/commands/signal.ts`
- `apps/cli/src/commands/triage.ts`

**Deliverables:**

- `looped list` with all filters and `--json`
- `looped show <id>` with full detail output
- `looped create <title>` with interactive and flag modes
- `looped comment <id> <body>`
- `looped signal <message>` with all flags
- `looped triage` / `looped triage accept` / `looped triage decline`
- Tests for all commands

### Phase 3: Remaining Commands (projects, goals, templates, dispatch, status)

Complete the command surface.

**Files:**

- `apps/cli/src/commands/projects.ts`
- `apps/cli/src/commands/goals.ts`
- `apps/cli/src/commands/templates.ts`
- `apps/cli/src/commands/dispatch.ts`
- `apps/cli/src/commands/status.ts`

**Deliverables:**

- `looped projects`, `looped goals`
- `looped templates` / `looped templates show` / `looped templates promote`
- `looped next`, `looped dispatch <id>`
- `looped status`
- Tests for all commands
- All 10 acceptance criteria verified

## 14. Open Questions

No open questions remain — all clarifications were resolved during ideation.

## 15. Related ADRs

| ADR  | Title                       | Relevance                                                                 |
| ---- | --------------------------- | ------------------------------------------------------------------------- |
| 0001 | Use Hono over Express       | API framework the CLI calls                                               |
| 0005 | Use CUID2 text primary keys | All entity IDs are 24-char CUID2 strings                                  |
| 0006 | Use soft delete             | CLI never sees hard-deleted records; `deletedAt` filtering is server-side |
| 0013 | Use ky over Axios           | CLI uses same HTTP client as `@loop/app` for consistency                  |

## 16. References

- [Loop MVP Spec — CLI section](../../meta/loop-mvp.md#cli)
- [Loop Litepaper](../../meta/loop-litepaper.md)
- [MVP Build Plan — Phase 4](../../specs/mvp-build-plan.md#phase-4-cli)
- [Ideation document](./01-ideation.md)
- [Research: CLI frameworks](../../research/20260220_mvp-phase-4-cli-tool.md)
- [Commander.js docs](https://github.com/tj/commander.js)
- [ky docs](https://github.com/sindresorhus/ky)
- [cli-table3 docs](https://github.com/cli-table/cli-table3)
- [picocolors docs](https://github.com/alexeyraspopov/picocolors)
- [@inquirer/prompts docs](https://github.com/SBoudrias/Inquirer.js)
- [tsup docs](https://tsup.egoist.dev/)
