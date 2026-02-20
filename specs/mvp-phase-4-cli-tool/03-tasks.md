---
slug: mvp-phase-4-cli-tool
decomposed: 2026-02-20
mode: full
---

# Tasks: MVP Phase 4 — CLI Tool (`looped`)

**Last Decompose: 2026-02-20**
**Spec:** [02-specification.md](./02-specification.md)

---

## Phase 1: Foundation

### Task 1.1: Scaffold CLI project and build infrastructure

**Objective:** Create the `apps/cli/` directory with all project configuration files, install dependencies, and verify the CLI builds and runs `looped --help`.

**Files to create:**

1. **`apps/cli/package.json`:**
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

2. **`apps/cli/tsconfig.json`:**
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

3. **`apps/cli/tsup.config.ts`:**
```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  sourcemap: true,
  dts: false,
})
```

4. **`apps/cli/vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

5. **`apps/cli/src/bin.ts`:**
```typescript
#!/usr/bin/env node
import { program } from './cli.js'
program.parseAsync()
```

6. **`apps/cli/src/cli.ts`** (initial stub with config command only):
```typescript
import { Command } from 'commander'
import { registerConfigCommand } from './commands/config.js'

export const program = new Command()

program
  .name('looped')
  .description('CLI for the Loop autonomous improvement engine')
  .version('0.1.0')
  .option('--json', 'Output raw JSON instead of formatted tables')
  .option('--api-url <url>', 'Override API URL for this invocation')
  .option('--token <token>', 'Override auth token for this invocation')

registerConfigCommand(program)
```

7. Update `vitest.workspace.ts` at repo root to include `apps/cli`.

8. Run `npm install` from repo root to install all dependencies.

**Acceptance criteria:**
- `apps/cli/` directory exists with all config files
- `npm run build` in `apps/cli/` succeeds
- `node dist/bin.js --help` shows help text with `looped` name and version
- `npm test` at root includes `apps/cli` workspace
- TypeScript compiles without errors (`npm run typecheck`)

---

### Task 1.2: Implement types module

**Objective:** Create `apps/cli/src/types.ts` with all manual API response type definitions.

**File: `apps/cli/src/types.ts`:**
```typescript
// Core enums
export type IssueStatus = 'triage' | 'todo' | 'backlog' | 'in_progress' | 'done' | 'canceled'
export type IssueType = 'signal' | 'hypothesis' | 'plan' | 'task' | 'monitor'
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low'
export type ProjectStatus = 'backlog' | 'planned' | 'active' | 'on_hold' | 'completed'
export type ProjectHealth = 'on_track' | 'at_risk' | 'off_track'
export type GoalStatus = 'active' | 'achieved' | 'abandoned'
export type VersionStatus = 'active' | 'draft' | 'retired'

// Response wrappers
export interface PaginatedResponse<T> {
  data: T[]
  total: number
}

export interface SingleResponse<T> {
  data: T
}

// Entities
export interface Issue {
  id: string
  number: number
  title: string
  description?: string | null
  type: IssueType
  status: IssueStatus
  priority: number
  parentId?: string | null
  projectId?: string | null
  signalSource?: string | null
  signalPayload?: Record<string, unknown> | null
  hypothesis?: HypothesisData | null
  agentSessionId?: string | null
  agentSummary?: string | null
  commits?: unknown[] | null
  pullRequests?: unknown[] | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface IssueDetail extends Issue {
  parent?: Issue | null
  children: Issue[]
  labels: Label[]
  relations: IssueRelation[]
}

export interface HypothesisData {
  statement: string
  confidence: number
  evidence: string[]
  validationCriteria: string
  prediction?: string
}

export interface Project {
  id: string
  name: string
  description?: string | null
  status: ProjectStatus
  health: ProjectHealth
  goalId?: string | null
  createdAt: string
  updatedAt: string
}

export interface Goal {
  id: string
  title: string
  description?: string | null
  metric?: string | null
  targetValue?: number | null
  currentValue?: number | null
  unit?: string | null
  status: GoalStatus
  projectId?: string | null
  createdAt: string
  updatedAt: string
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface IssueRelation {
  id: string
  issueId: string
  relatedIssueId: string
  type: string
  createdAt: string
}

export interface Signal {
  id: string
  source: string
  sourceId?: string | null
  type: string
  severity: SignalSeverity
  payload: Record<string, unknown>
  issueId: string
  createdAt: string
}

export interface PromptTemplate {
  id: string
  slug: string
  name: string
  description?: string | null
  conditions: Record<string, unknown>
  specificity: number
  activeVersionId?: string | null
  projectId?: string | null
  createdAt: string
  updatedAt: string
}

export interface PromptVersion {
  id: string
  templateId: string
  version: number
  content: string
  changelog?: string | null
  authorType: string
  authorName: string
  status: VersionStatus
  reviewScore?: number | null
  usageCount: number
  completionRate?: number | null
  createdAt: string
}

export interface DashboardStats {
  issues: {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
  }
  goals: {
    total: number
    active: number
    achieved: number
  }
  dispatch: {
    queueDepth: number
    activeCount: number
    completedLast24h: number
  }
}

export interface DispatchQueueItem {
  issue: Issue
  score: number
  breakdown: {
    priorityWeight: number
    goalBonus: number
    ageBonus: number
    typeBonus: number
  }
}
```

**Acceptance criteria:**
- File compiles without errors
- All types match the API response shapes documented in spec section 6.8
- Types are importable from other modules

---

### Task 1.3: Implement config module and config command

**Objective:** Implement `lib/config.ts` for reading/writing `~/.loop/config.json` and `commands/config.ts` for the `looped config set/get/list` subcommands.

**File: `apps/cli/src/lib/config.ts`:**

```typescript
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface LoopConfig {
  url?: string
  token?: string
}

export interface GlobalOptions {
  json?: boolean
  apiUrl?: string
  token?: string
}

const CONFIG_DIR = path.join(os.homedir(), '.loop')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

/** Read config from ~/.loop/config.json, returning {} if missing. */
export function readConfig(): LoopConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

/** Write config to ~/.loop/config.json with mode 0o600. */
export function writeConfig(config: LoopConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 })
}

/**
 * Resolve config with priority: CLI flags > env vars > config file.
 */
export function resolveConfig(globalOpts?: GlobalOptions): { url?: string; token?: string } {
  const file = readConfig()
  return {
    url: globalOpts?.apiUrl ?? process.env.LOOP_API_URL ?? file.url,
    token: globalOpts?.token ?? process.env.LOOP_API_TOKEN ?? file.token,
  }
}

/** Mask a token string showing first 4 + last 4 chars. */
export function maskToken(token: string): string {
  if (token.length <= 8) return '****'
  return `${token.slice(0, 4)}****${token.slice(-4)}`
}
```

**File: `apps/cli/src/commands/config.ts`:**

```typescript
import { Command } from 'commander'
import { readConfig, writeConfig, maskToken } from '../lib/config.js'

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('Manage CLI configuration')

  config
    .command('set <key> <value>')
    .description('Set a config value (url or token)')
    .action((key: string, value: string) => {
      const cfg = readConfig()
      if (key === 'url') {
        cfg.url = value
        writeConfig(cfg)
        console.log(`URL set: ${value}`)
      } else if (key === 'token') {
        cfg.token = value
        writeConfig(cfg)
        console.log(`Token set: ${maskToken(value)}`)
      } else {
        console.error(`Unknown config key: ${key}. Valid keys: url, token`)
        process.exit(1)
      }
    })

  config
    .command('get <key>')
    .description('Get a config value')
    .action((key: string) => {
      const cfg = readConfig()
      if (key === 'url') {
        console.log(cfg.url ?? '(not set)')
      } else if (key === 'token') {
        console.log(cfg.token ? maskToken(cfg.token) : '(not set)')
      } else {
        console.error(`Unknown config key: ${key}. Valid keys: url, token`)
        process.exit(1)
      }
    })

  config
    .command('list')
    .description('List all config values')
    .action(() => {
      const cfg = readConfig()
      console.log(`url:   ${cfg.url ?? '(not set)'}`)
      console.log(`token: ${cfg.token ? maskToken(cfg.token) : '(not set)'}`)
    })
}
```

**Tests: `apps/cli/__tests__/lib/config.test.ts`:**
- Reads config from file, returns empty object when missing
- Writes config with correct permissions (0o600)
- Creates `~/.loop/` directory if it doesn't exist
- Resolution order: CLI flags > env vars > config file
- Masks token in output (shows first 4 + last 4 chars)
- `maskToken` returns `****` for tokens <= 8 chars

**Tests: `apps/cli/__tests__/commands/config.test.ts`:**
- `config set url <value>` writes url to config file
- `config set token <value>` writes token and prints masked value
- `config set <invalid>` exits with error
- `config get url` prints url value
- `config get token` prints masked token
- `config list` prints all values with token masked

**Acceptance criteria:**
- `looped config set url https://api.looped.me` persists to `~/.loop/config.json`
- `looped config set token tok_secret123` prints `Token set: tok_****t123`
- `looped config list` shows url and masked token
- Config file has mode 0o600
- All unit tests pass

---

### Task 1.4: Implement API client and error handler

**Objective:** Implement `lib/api-client.ts` (ky instance factory) and `lib/errors.ts` (centralized error handler).

**File: `apps/cli/src/lib/api-client.ts`:**

```typescript
import ky from 'ky'
import { resolveConfig, type GlobalOptions } from './config.js'

/**
 * Create a configured ky instance for API calls.
 * Exits with error if url or token are not configured.
 */
export function createApiClient(globalOpts?: GlobalOptions): typeof ky {
  const { url, token } = resolveConfig(globalOpts)

  if (!url) {
    console.error('No API URL configured. Run: looped config set url <url>')
    process.exit(1)
  }
  if (!token) {
    console.error('No auth token configured. Run: looped config set token <token>')
    process.exit(1)
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
  })
}
```

**File: `apps/cli/src/lib/errors.ts`:**

```typescript
import { HTTPError } from 'ky'

/**
 * Wrap a command action with centralized error handling.
 * Maps HTTP errors to user-friendly messages and exits with code 1.
 */
export async function withErrorHandler(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (error instanceof HTTPError) {
      const status = error.response.status
      const body = await error.response.json().catch(() => null)
      const message = (body as Record<string, string> | null)?.error ?? error.message

      if (status === 401 || status === 403) {
        console.error('Authentication failed. Run: looped config set token <your-token>')
      } else if (status === 404) {
        console.error(`Not found: ${message}`)
      } else {
        console.error(`API error (${status}): ${message}`)
      }
    } else {
      console.error(`Error: ${(error as Error).message}`)
    }
    process.exit(1)
  }
}
```

**Exit codes:** 0 = success, 1 = runtime error, 2 = usage error (Commander auto-handles).

**Tests: `apps/cli/__tests__/lib/api-client.test.ts`:**
- Creates ky instance with correct prefixUrl and Authorization header
- Exits with error message when url is missing
- Exits with error message when token is missing
- Uses global options (--api-url, --token) when provided, overriding config file
- Uses env vars when CLI flags not provided

**Tests for errors (inline or separate):**
- 401/403 prints auth failure message
- 404 prints "Not found" message
- Other HTTP errors print status code and message
- Non-HTTP errors print error message
- All errors exit with code 1

**Acceptance criteria:**
- `createApiClient()` returns a configured ky instance
- Missing url/token prints helpful setup instructions and exits
- `withErrorHandler` catches HTTPError and maps status codes to messages
- All unit tests pass

---

### Task 1.5: Implement output formatting module

**Objective:** Implement `lib/output.ts` with table rendering helpers and JSON output mode.

**File: `apps/cli/src/lib/output.ts`:**

```typescript
import Table from 'cli-table3'
import pc from 'picocolors'

/** Color map for issue statuses. */
export const STATUS_COLOR: Record<string, (s: string) => string> = {
  triage: pc.yellow,
  todo: pc.cyan,
  backlog: pc.dim,
  in_progress: pc.blue,
  done: pc.green,
  canceled: pc.red,
}

/** Human-readable priority labels with color. */
export const PRIORITY_LABEL: Record<number, string> = {
  0: pc.dim('none'),
  1: pc.red('urgent'),
  2: pc.yellow('high'),
  3: pc.white('medium'),
  4: pc.dim('low'),
}

/** Icon map for issue types. */
export const TYPE_ICON: Record<string, string> = {
  signal: '⚡',
  hypothesis: '🔬',
  plan: '📋',
  task: '🔧',
  monitor: '👁',
}

/**
 * Output data as JSON (for --json mode) or render using the provided table function.
 */
export function output(data: unknown, opts: { json?: boolean }, renderFn: (d: unknown) => void): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
  } else {
    renderFn(data)
  }
}

/**
 * Render a list of issues as a formatted table.
 * Columns: #, TYPE, TITLE, STATUS, PRI, PROJECT, CREATED
 */
export function renderIssueTable(issues: Array<Record<string, unknown>>): void {
  const table = new Table({
    head: ['#', 'TYPE', 'TITLE', 'STATUS', 'PRI', 'PROJECT', 'CREATED'],
    style: { head: ['cyan'] },
  })

  for (const issue of issues) {
    const type = String(issue.type ?? '')
    const status = String(issue.status ?? '')
    const priority = Number(issue.priority ?? 3)
    const title = truncate(String(issue.title ?? ''), 50)
    const colorStatus = (STATUS_COLOR[status] ?? pc.white)(status)
    const icon = TYPE_ICON[type] ?? ''

    table.push([
      issue.number ?? '',
      `${icon} ${type}`,
      title,
      colorStatus,
      PRIORITY_LABEL[priority] ?? String(priority),
      issue.projectId ?? '-',
      formatDate(String(issue.createdAt ?? '')),
    ])
  }

  console.log(table.toString())
}

/** Truncate a string to maxLen, appending ellipsis if needed. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/** Format an ISO date string to YYYY-MM-DD. */
export function formatDate(iso: string): string {
  if (!iso) return '-'
  return iso.slice(0, 10)
}
```

**Tests: `apps/cli/__tests__/lib/output.test.ts`:**
- JSON mode outputs valid JSON to stdout (capture process.stdout.write)
- `renderIssueTable` produces table output with correct columns
- Handles empty data arrays gracefully (renders empty table)
- `truncate` truncates long strings and appends ellipsis
- `truncate` returns short strings unchanged
- `formatDate` formats ISO dates to YYYY-MM-DD
- `formatDate` returns '-' for empty strings

**Acceptance criteria:**
- `--json` mode writes valid JSON to stdout
- Table mode renders colored, formatted tables
- Empty arrays render without errors
- Long titles are truncated
- All unit tests pass

---

## Phase 2: Core Commands

### Task 2.1: Implement `looped list` command (issues list)

**Objective:** Implement `commands/issues.ts` with the `list` subcommand registered as a top-level `looped list` command.

**Command:** `looped list [options]`

**Options:**
| Option | Maps to API Query Param | Description |
|--------|------------------------|-------------|
| `--status <s>` | `?status=<s>` | Filter by status |
| `--type <t>` | `?type=<t>` | Filter by issue type |
| `--project <id>` | `?projectId=<id>` | Filter by project |
| `--priority <n>` | `?priority=<n>` | Filter by priority (0-4) |
| `--limit <n>` | `?limit=<n>` | Results per page (default 50) |
| `--offset <n>` | `?offset=<n>` | Pagination offset |

**API:** `GET /api/issues`

**Table columns:** `#`, `TYPE`, `TITLE`, `STATUS`, `PRI`, `PROJECT`, `CREATED`

**Implementation pattern:**
```typescript
import { Command } from 'commander'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output, renderIssueTable } from '../lib/output.js'
import type { PaginatedResponse, Issue } from '../types.js'

export function registerIssuesCommand(program: Command): void {
  program
    .command('list')
    .description('List issues with optional filters')
    .option('--status <status>', 'Filter by status')
    .option('--type <type>', 'Filter by issue type')
    .option('--project <id>', 'Filter by project ID')
    .option('--priority <n>', 'Filter by priority (0-4)')
    .option('--limit <n>', 'Results per page', '50')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const searchParams: Record<string, string> = {
          limit: opts.limit,
          offset: opts.offset,
        }
        if (opts.status) searchParams.status = opts.status
        if (opts.type) searchParams.type = opts.type
        if (opts.project) searchParams.projectId = opts.project
        if (opts.priority) searchParams.priority = opts.priority

        const result = await api.get('api/issues', { searchParams }).json<PaginatedResponse<Issue>>()

        output(result, globalOpts, () => renderIssueTable(result.data))
      })
    })
}
```

Register in `cli.ts` by adding `import { registerIssuesCommand } from './commands/issues.js'` and calling `registerIssuesCommand(program)`.

**Tests: `apps/cli/__tests__/commands/issues.test.ts` (list portion):**
- Calls `GET /api/issues` with default limit=50, offset=0
- Passes --status filter as query param
- Passes --type filter as query param
- Passes --project filter as projectId query param
- Passes --priority filter as query param
- Renders issue table in default mode
- Outputs raw JSON when --json flag is set

**Acceptance criteria:**
- `looped list` fetches and displays issues in a table
- All filter options map to correct API query parameters
- `--json` outputs raw JSON
- Tests verify correct API calls and output

---

### Task 2.2: Implement `looped show` command (issue detail)

**Objective:** Implement the `show <id>` subcommand displaying full issue detail.

**Command:** `looped show <id>`

**API:** `GET /api/issues/:id`

**Output sections:**
- Header: `#42 [🔧 task] Fix login timeout`
- Metadata: status, priority, project, labels
- Description (if present)
- Parent issue (if child)
- Children (if parent, as table)
- Relations (blocking/blocked by)
- Agent results (if present): summary, commits, PRs

**Implementation:** Register as `program.command('show <id>')`. In the action, call `api.get('api/issues/${id}').json<SingleResponse<IssueDetail>>()`. Format the output with sections using picocolors for headers and cli-table3 for children/relations tables. In JSON mode, output the raw response.

**Render function should display:**
```
#42 [🔧 task] Fix login timeout
Status: in_progress   Priority: high   Project: proj_abc
Labels: bug, backend

Description:
  The login endpoint times out after 30s under load...

Parent: #38 [📋 plan] Improve auth performance

Children:
  #  TYPE    TITLE              STATUS
  43 🔧 task Fix connection pool todo
  44 🔧 task Add retry logic     todo

Relations:
  blocks #45 "Deploy auth hotfix"
  blocked by #37 "Load test baseline"

Agent:
  Summary: Fixed connection pool sizing...
  Commits: abc1234, def5678
  PRs: #12, #15
```

**Tests:**
- Calls `GET /api/issues/:id` with correct ID
- Renders header with issue number, type icon, and title
- Shows labels, parent, children, relations when present
- Handles missing optional fields gracefully
- Outputs JSON in --json mode

**Acceptance criteria:**
- `looped show <id>` displays full issue detail with all sections
- Optional sections only shown when data is present
- `--json` outputs raw JSON
- Tests pass

---

### Task 2.3: Implement `looped create` command (issue creation)

**Objective:** Implement `create <title>` with both flag-based and interactive TTY modes.

**Command:** `looped create <title> [options]`

**Options:**
| Flag | Default (non-TTY) | Description |
|------|-------------------|-------------|
| `--type <t>` | `task` | Issue type |
| `--priority <n>` | `3` | Priority (0-4) |
| `--project <id>` | none | Project ID |
| `--description <text>` | none | Issue description |
| `--parent <id>` | none | Parent issue ID |

**TTY mode:** If `--type` or `--priority` not provided and `process.stdout.isTTY`, prompt interactively using `@inquirer/prompts`:
1. Select type (signal/hypothesis/plan/task/monitor)
2. Select priority (0-4 with labels)
3. Optionally select project (fetches project list from API)

**Non-TTY mode:** Use defaults (type=task, priority=3) without prompting.

**API:** `POST /api/issues`

**Request body:** `{ title, type, priority, projectId?, description?, parentId? }`

**Output:** Show created issue number, type, and title.

**Tests:**
- Creates issue with all flags provided (no prompts)
- Uses defaults in non-TTY mode when flags omitted
- Sends correct POST body to API
- Mock `@inquirer/prompts` for TTY mode testing
- Outputs JSON in --json mode

**Acceptance criteria:**
- `looped create "Fix bug" --type task --priority 2` creates issue without prompting
- In TTY mode without flags, prompts for type and priority
- Non-TTY mode uses sensible defaults
- Tests pass

---

### Task 2.4: Implement `looped comment` command

**Objective:** Implement `comment <issueId> <body>` to add a comment to an issue.

**Command:** `looped comment <issueId> <body>`

**API:** `POST /api/issues/:id/comments`

**Request body:** `{ body, authorName: "looped-cli", authorType: "human" }`

**Output:** Confirmation message: `Comment added to issue #<number>`

**Implementation:**
```typescript
export function registerCommentCommand(program: Command): void {
  program
    .command('comment <issueId> <body>')
    .description('Add a comment to an issue')
    .action(async (issueId: string, body: string) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)
        const result = await api.post(`api/issues/${issueId}/comments`, {
          json: { body, authorName: 'looped-cli', authorType: 'human' },
        }).json()
        output(result, globalOpts, () => {
          console.log(`Comment added to issue ${issueId}`)
        })
      })
    })
}
```

**Tests:**
- Sends POST to correct endpoint with issue ID
- Request body includes body, authorName, authorType
- Outputs confirmation message
- Outputs JSON in --json mode

**Acceptance criteria:**
- `looped comment abc123 "This needs review"` posts comment
- Comment has authorName "looped-cli" and authorType "human"
- Tests pass

---

### Task 2.5: Implement `looped signal` command

**Objective:** Implement `signal <message>` to submit a manual signal.

**Command:** `looped signal <message> [options]`

**Options:**
| Flag | Default | Description |
|------|---------|-------------|
| `--source <s>` | `"manual"` | Signal source identifier |
| `--severity <sev>` | `"medium"` | critical, high, medium, low |
| `--project <id>` | none | Project ID |

**API:** `POST /api/signals`

**Request body:**
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

**Tests: `apps/cli/__tests__/commands/signal.test.ts`:**
- Sends POST to `/api/signals` with correct body
- Default source is "manual", default severity is "medium"
- --source and --severity flags override defaults
- --project passes projectId in body
- Outputs signal ID and issue number
- JSON mode outputs raw response

**Acceptance criteria:**
- `looped signal "Error rate spike"` submits signal with defaults
- `looped signal --severity high --source ci "Build failed"` uses provided flags
- Output shows signal ID and linked issue
- Tests pass

---

### Task 2.6: Implement `looped triage` command

**Objective:** Implement triage queue viewing, accept, and decline subcommands.

**Commands:**
| Command | API Call | Description |
|---------|----------|-------------|
| `looped triage` | `GET /api/issues?status=triage` | Show triage queue as table |
| `looped triage accept <id>` | `PATCH /api/issues/:id` `{ status: "backlog" }` | Accept into backlog |
| `looped triage decline <id> [reason]` | `PATCH /api/issues/:id` `{ status: "canceled" }` + optionally `POST /api/issues/:id/comments` | Cancel with optional reason |

**Behavior:**
- `looped triage` (no subcommand): Lists issues with status=triage using the same table format as `looped list`
- `looped triage accept <id>`: PATCHes issue status to "backlog", prints confirmation
- `looped triage decline <id>`: PATCHes issue status to "canceled"
- `looped triage decline <id> "Not actionable"`: Also posts a comment with the reason, using `authorName: "looped-cli"`, `authorType: "human"`

**Tests: `apps/cli/__tests__/commands/triage.test.ts`:**
- `triage` lists issues with status=triage filter
- `triage accept` PATCHes status to backlog
- `triage decline` PATCHes status to canceled
- `triage decline` with reason also POSTs comment
- All support --json mode

**Acceptance criteria:**
- `looped triage` shows triage queue
- `looped triage accept <id>` moves to backlog
- `looped triage decline <id> "reason"` cancels and posts reason comment
- Tests pass

---

## Phase 3: Remaining Commands

### Task 3.1: Implement `looped projects` command

**Objective:** Implement `projects` command to list all projects.

**Command:** `looped projects`

**API:** `GET /api/projects`

**Table columns:** `ID`, `NAME`, `STATUS`, `HEALTH`, `CREATED`

**Implementation:** Register as `program.command('projects')`. Fetch from `api/projects`, render table or JSON.

Add color for project health:
- `on_track`: green
- `at_risk`: yellow
- `off_track`: red

**Tests:**
- Calls GET /api/projects
- Renders table with correct columns
- JSON mode outputs raw response

**Acceptance criteria:**
- `looped projects` displays project list in table
- Health values are color-coded
- --json outputs raw JSON
- Tests pass

---

### Task 3.2: Implement `looped goals` command

**Objective:** Implement `goals` command to list all goals with progress.

**Command:** `looped goals`

**API:** `GET /api/goals`

**Table columns:** `ID`, `TITLE`, `STATUS`, `PROGRESS`, `PROJECT`

Progress format: `currentValue/targetValue unit` (e.g., `75/100 %`). If no target, show `-`.

**Tests:**
- Calls GET /api/goals
- Renders progress as currentValue/targetValue unit
- Handles missing targetValue gracefully
- JSON mode works

**Acceptance criteria:**
- `looped goals` displays goals with progress indicators
- Missing progress fields handled gracefully
- Tests pass

---

### Task 3.3: Implement `looped templates` command

**Objective:** Implement templates list, show, and promote subcommands.

**Commands:**
| Command | API Call | Description |
|---------|----------|-------------|
| `looped templates` | `GET /api/templates` | List templates |
| `looped templates show <id>` | `GET /api/templates/:id` + `GET /api/templates/:id/versions` | Template detail + versions |
| `looped templates promote <versionId>` | `POST /api/templates/:templateId/versions/:versionId/promote` | Promote version to active |

**List table columns:** `ID`, `SLUG`, `NAME`, `ACTIVE VERSION`, `REVIEW SCORE`, `USAGE`

**Show output:** Template metadata + version history table + review score summary.

**Promote:** The CLI must first fetch the version to get its `templateId`, then call the promote endpoint. (The version endpoint may need to be derived — look up the version from the template's versions list.)

**Tests:**
- `templates` lists all templates
- `templates show <id>` shows template detail and version history
- `templates promote <versionId>` calls promote endpoint
- All support --json mode

**Acceptance criteria:**
- `looped templates` lists templates in table
- `looped templates show <id>` shows detail with versions
- `looped templates promote <versionId>` promotes version
- Tests pass

---

### Task 3.4: Implement `looped next` and `looped dispatch` commands

**Objective:** Implement dispatch queue preview and force-claim commands.

**Commands:**

**`looped next`:**
- **API:** `GET /api/dispatch/queue`
- **Table columns:** `#`, `TYPE`, `TITLE`, `PRI`, `SCORE`, `BREAKDOWN`
- Score breakdown shows: `pri:75 + goal:20 + age:3 + type:20 = 118`

**`looped dispatch <id>`:**
- **API:** `PATCH /api/issues/:id` with body `{ "status": "in_progress" }`
- **Output:** Confirmation message with issue number and title

**Tests:**
- `next` calls GET /api/dispatch/queue
- `next` renders score breakdown in table
- `dispatch <id>` PATCHes status to in_progress
- Both support --json mode

**Acceptance criteria:**
- `looped next` shows dispatch queue with score breakdowns
- `looped dispatch <id>` claims an issue
- Tests pass

---

### Task 3.5: Implement `looped status` command

**Objective:** Implement system health overview command.

**Command:** `looped status`

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

**Implementation:** Fetch from `api/dashboard/stats`, format as above using picocolors for section headers. In JSON mode, output raw stats.

**Tests:**
- Calls GET /api/dashboard/stats
- Renders formatted status output with all sections
- JSON mode outputs raw response

**Acceptance criteria:**
- `looped status` shows formatted system overview
- All sections rendered correctly
- --json outputs raw JSON
- Tests pass

---

### Task 3.6: Register all commands in cli.ts and final integration

**Objective:** Wire up all remaining commands in `cli.ts`, ensure `looped --help` lists all commands, and verify the full CLI builds and runs.

**Update `apps/cli/src/cli.ts`:**
```typescript
import { Command } from 'commander'
import { registerConfigCommand } from './commands/config.js'
import { registerIssuesCommand } from './commands/issues.js'
import { registerCommentCommand } from './commands/comment.js'
import { registerSignalCommand } from './commands/signal.js'
import { registerTriageCommand } from './commands/triage.js'
import { registerProjectsCommand } from './commands/projects.js'
import { registerGoalsCommand } from './commands/goals.js'
import { registerTemplatesCommand } from './commands/templates.js'
import { registerDispatchCommand } from './commands/dispatch.js'
import { registerStatusCommand } from './commands/status.js'

export const program = new Command()

program
  .name('looped')
  .description('CLI for the Loop autonomous improvement engine')
  .version('0.1.0')
  .option('--json', 'Output raw JSON instead of formatted tables')
  .option('--api-url <url>', 'Override API URL for this invocation')
  .option('--token <token>', 'Override auth token for this invocation')

registerConfigCommand(program)
registerIssuesCommand(program)
registerCommentCommand(program)
registerSignalCommand(program)
registerTriageCommand(program)
registerProjectsCommand(program)
registerGoalsCommand(program)
registerTemplatesCommand(program)
registerDispatchCommand(program)
registerStatusCommand(program)
```

**Also update CLAUDE.md** to add CLI section with commands and setup instructions.

**Acceptance criteria:**
- `looped --help` lists all commands: config, list, show, create, comment, signal, triage, projects, goals, templates, next, dispatch, status
- All commands are accessible and functional
- Full build succeeds
- All tests pass (`npm test` in apps/cli)
- TypeScript compiles without errors

---

## Dependency Graph

```
Task 1.1 (scaffold)
  └── Task 1.2 (types) — depends on 1.1
  └── Task 1.3 (config) — depends on 1.1
  └── Task 1.4 (api-client + errors) — depends on 1.1, 1.3
  └── Task 1.5 (output) — depends on 1.1, 1.2

Task 2.1 (list) — depends on 1.4, 1.5
Task 2.2 (show) — depends on 1.4, 1.5
Task 2.3 (create) — depends on 1.4, 1.5
Task 2.4 (comment) — depends on 1.4, 1.5
Task 2.5 (signal) — depends on 1.4, 1.5
Task 2.6 (triage) — depends on 1.4, 1.5

Task 3.1 (projects) — depends on 1.4, 1.5
Task 3.2 (goals) — depends on 1.4, 1.5
Task 3.3 (templates) — depends on 1.4, 1.5
Task 3.4 (dispatch) — depends on 1.4, 1.5
Task 3.5 (status) — depends on 1.4, 1.5
Task 3.6 (integration) — depends on all above
```

## Parallel Execution Opportunities

- **Phase 1:** Tasks 1.2, 1.3 can run in parallel after 1.1. Task 1.5 can start after 1.2.
- **Phase 2:** All tasks (2.1-2.6) can run in parallel since they all depend on the same Phase 1 foundations.
- **Phase 3:** Tasks 3.1-3.5 can run in parallel. Task 3.6 must wait for all others.
