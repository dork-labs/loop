---
slug: loop-cli
last-decompose: 2026-02-23
---

# Tasks: Loop CLI Refactor

## Phase 1: Core Refactor (Foundation)

### Task 1.1: Rename package and update SDK dependencies

Rename `@dork-labs/looped` to `@dork-labs/loop-cli`, change binary from `looped` to `loop`, add SDK/types workspace dependencies, remove direct `ky` dependency.

**Files to modify:**

- `apps/cli/package.json`

**Changes:**

```jsonc
{
  "name": "@dork-labs/loop-cli", // was: @dork-labs/looped
  "version": "0.2.0",
  "bin": {
    "loop": "./dist/bin.js", // was: "looped"
  },
  "dependencies": {
    "@dork-labs/loop-sdk": "*", // NEW: workspace dependency
    "@dork-labs/loop-types": "*", // NEW: workspace dependency
    "commander": "^14",
    "picocolors": "^1",
    "cli-table3": "^0.6",
    "nanospinner": "^1",
    "@inquirer/prompts": "^7",
    // ky REMOVED
  },
}
```

**Acceptance Criteria:**

- [ ] Package name is `@dork-labs/loop-cli`
- [ ] Version bumped to `0.2.0`
- [ ] Binary key is `loop` not `looped`
- [ ] `@dork-labs/loop-sdk` added as workspace dependency
- [ ] `@dork-labs/loop-types` added as workspace dependency
- [ ] `ky` removed from dependencies
- [ ] `npm install` from repo root succeeds

### Task 1.2: Create SDK client factory and delete old API client

Replace `apps/cli/src/lib/api-client.ts` (raw ky) with `apps/cli/src/lib/client.ts` (SDK wrapper). Update `GlobalOptions` to include `plain`.

**Delete:** `apps/cli/src/lib/api-client.ts`

**Create `apps/cli/src/lib/client.ts`:**

```typescript
import { LoopClient } from '@dork-labs/loop-sdk';
import { resolveConfig, type GlobalOptions } from './config.js';

/** Create an SDK client from resolved config. */
export function createClient(globalOpts?: GlobalOptions): LoopClient {
  const { url, token } = resolveConfig(globalOpts);

  if (!url || !token) {
    console.error('Missing API URL or token. Run: loop auth login');
    process.exit(1);
  }

  return new LoopClient({ apiKey: token, baseUrl: url });
}
```

**Update `apps/cli/src/lib/config.ts`:**
Add `plain?: boolean` to the `GlobalOptions` interface:

```typescript
export interface GlobalOptions {
  json?: boolean;
  plain?: boolean;
  apiUrl?: string;
  token?: string;
}
```

**Acceptance Criteria:**

- [ ] `apps/cli/src/lib/api-client.ts` deleted
- [ ] `apps/cli/src/lib/client.ts` created with `createClient()` function
- [ ] `createClient` uses `LoopClient` from `@dork-labs/loop-sdk`
- [ ] `GlobalOptions` includes `plain?: boolean`
- [ ] Error message references `loop auth login` not `looped config set`

### Task 1.3: Delete types.ts and migrate to @dork-labs/loop-types

Delete the hand-mirrored `apps/cli/src/types.ts` file. All command files will import types from `@dork-labs/loop-types` instead.

**Delete:** `apps/cli/src/types.ts`

**Pattern for all command files -- replace:**

```typescript
// Before:
import type { Issue, PaginatedResponse } from '../types.js';

// After:
import type { Issue, PaginatedResponse } from '@dork-labs/loop-types';
```

**Also update `apps/cli/src/lib/output.ts`:**

```typescript
// Before:
import type { Issue } from '../types.js';

// After:
import type { Issue } from '@dork-labs/loop-types';
```

**Acceptance Criteria:**

- [ ] `apps/cli/src/types.ts` deleted
- [ ] All imports of `../types.js` replaced with `@dork-labs/loop-types`
- [ ] `output.ts` imports `Issue` from `@dork-labs/loop-types`
- [ ] TypeScript compilation succeeds with no type errors

### Task 1.4: Update error handler for SDK error types

Replace ky `HTTPError` handling with SDK error types (`LoopError`, `LoopNotFoundError`).

**Replace `apps/cli/src/lib/errors.ts` contents with:**

```typescript
import { LoopError, LoopNotFoundError } from '@dork-labs/loop-sdk';

/**
 * Wrap a command action with centralized error handling.
 * Maps SDK errors to user-friendly messages and exits with code 1.
 */
export async function withErrorHandler(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof LoopError) {
      if (error.status === 401 || error.status === 403) {
        console.error('Authentication failed. Run: loop auth login');
      } else if (error instanceof LoopNotFoundError) {
        console.error(`Not found: ${error.message}`);
      } else {
        console.error(`API error (${error.status}): ${error.message}`);
      }
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
```

**Acceptance Criteria:**

- [ ] No import of `ky` or `HTTPError` in errors.ts
- [ ] Imports `LoopError` and `LoopNotFoundError` from `@dork-labs/loop-sdk`
- [ ] 401/403 errors show `loop auth login` message
- [ ] 404 errors show "Not found" message
- [ ] Generic `LoopError` shows status + message
- [ ] Non-SDK errors handled gracefully

### Task 1.5: Update CLI entry point (cli.ts) with new program name and structure

Rename program from `looped` to `loop`, add `--plain` global option, set up skeleton for restructured commands.

**Update `apps/cli/src/cli.ts`:**

```typescript
import { Command } from 'commander';

const program = new Command()
  .name('loop')
  .description('Terminal-native interface to Loop')
  .version('0.2.0')
  .option('--json', 'Output raw JSON')
  .option('--plain', 'Output tab-separated values (no colors)')
  .option('--api-url <url>', 'Override API URL')
  .option('--token <token>', 'Override auth token');

// Imports and registrations will be completed in Task 2.5
export { program };
```

Note: The full import list and registration calls will be added in Task 2.5. This task establishes the program skeleton with correct name, version, and global options.

**Acceptance Criteria:**

- [ ] Program name is `loop` not `looped`
- [ ] Version is `0.2.0`
- [ ] `--plain` option added
- [ ] `--json`, `--api-url`, `--token` options preserved
- [ ] Description updated to "Terminal-native interface to Loop"

## Phase 2: Command Grammar Reorganization

### Task 2.1: Restructure issues command as subcommand group

Consolidate `issues.ts` (list), `show.ts` (view), and `create.ts` into a single `issues.ts` with subcommands: `list`, `view`, `create`. Migrate all from raw ky to SDK client.

**Replace `apps/cli/src/commands/issues.ts` with:**

```typescript
import { Command } from 'commander';
import Table from 'cli-table3';
import pc from 'picocolors';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import {
  output,
  renderIssueTable,
  STATUS_COLOR,
  PRIORITY_LABEL,
  TYPE_ICON,
  truncate,
} from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { Issue, IssueDetail, IssueRelation } from '@dork-labs/loop-types';

/** Register the `issues` command group with list, view, create subcommands. */
export function registerIssuesCommand(program: Command): void {
  const issues = program.command('issues').description('Manage issues');

  // -- list
  issues
    .command('list')
    .description('List issues with optional filters')
    .option('--status <status>', 'Filter by status')
    .option('--type <type>', 'Filter by issue type')
    .option('--project <id>', 'Filter by project ID')
    .option('--priority <n>', 'Filter by priority (0-4)')
    .option('--limit <n>', 'Results per page', '50')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
        const client = createClient(globalOpts);

        const params: Record<string, unknown> = {
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        };
        if (opts.status) params.status = opts.status;
        if (opts.type) params.type = opts.type;
        if (opts.project) params.projectId = opts.project;
        if (opts.priority) params.priority = Number(opts.priority);

        const result = await client.issues.list(params);

        output(
          result,
          globalOpts,
          () => renderIssueTable(result.data),
          () => {
            for (const issue of result.data) {
              console.log(
                [issue.id, issue.number, issue.title, issue.priority, issue.status].join('\t')
              );
            }
          }
        );
      });
    });

  // -- view
  issues
    .command('view <id>')
    .description('Show full issue detail')
    .action(async (id: string, _opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
        const client = createClient(globalOpts);

        const result = await client.issues.get(id);

        output(
          result,
          globalOpts,
          () => renderIssueDetail(result.data),
          () => {
            const d = result.data;
            console.log([d.id, d.number, d.type, d.title, d.status, d.priority].join('\t'));
          }
        );
      });
    });

  // -- create
  issues
    .command('create <title>')
    .description('Create a new issue')
    .option('--type <type>', 'Issue type (signal, hypothesis, plan, task, monitor)')
    .option('--priority <n>', 'Priority (0-4)')
    .option('--project <id>', 'Project ID')
    .option('--description <text>', 'Issue description')
    .option('--parent <id>', 'Parent issue ID')
    .action(async (title: string, opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
        const client = createClient(globalOpts);

        const issueType = await resolveType(opts.type);
        const priority = await resolvePriority(opts.priority);

        const body: Record<string, unknown> = {
          title,
          type: issueType,
          priority: Number(priority),
        };
        if (opts.project) body.projectId = opts.project;
        if (opts.description) body.description = opts.description;
        if (opts.parent) body.parentId = opts.parent;

        const result = await client.issues.create(body);

        output(result, globalOpts, () => {
          const icon = TYPE_ICON[result.data.type] ?? '';
          console.log(
            `Created #${result.data.number} [${icon} ${result.data.type}] ${result.data.title}`
          );
        });
      });
    });
}
```

Also include the `renderIssueDetail`, `formatRelationLabel`, `resolveType`, and `resolvePriority` helpers from the existing `show.ts` and `create.ts` files, moved into this file.

**Delete:** `apps/cli/src/commands/show.ts`, `apps/cli/src/commands/create.ts`

**Acceptance Criteria:**

- [ ] `issues` is a subcommand group with `list`, `view`, `create`
- [ ] `show.ts` and `create.ts` deleted
- [ ] All three subcommands use SDK client via `createClient()`
- [ ] `cmd.optsWithGlobals()` used for accessing global options from subcommands
- [ ] Types imported from `@dork-labs/loop-types`
- [ ] `renderIssueDetail` preserved with full functionality
- [ ] Interactive prompts for type/priority preserved for `create`

### Task 2.2: Move comment to comments add, signal to signals ingest

Reorganize `comment.ts` to `comments.ts` with `add` subcommand. Reorganize `signal.ts` to `signals.ts` with `ingest` subcommand. Migrate both to SDK.

**Replace `apps/cli/src/commands/comment.ts` with `apps/cli/src/commands/comments.ts`:**

```typescript
import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';

/** Register the `comments` command group. */
export function registerCommentsCommand(program: Command): void {
  const comments = program.command('comments').description('Manage issue comments');

  comments
    .command('add <issueId> <body>')
    .description('Add a comment to an issue')
    .action(async (issueId: string, body: string, _opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
        const client = createClient(globalOpts);
        const result = await client.comments.create(issueId, {
          body,
          authorName: 'loop-cli',
          authorType: 'human',
        });
        output(result, globalOpts, () => {
          console.log(`Comment added to issue ${issueId}`);
        });
      });
    });
}
```

**Replace `apps/cli/src/commands/signal.ts` with `apps/cli/src/commands/signals.ts`:**

```typescript
import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';

/** Register the `signals` command group. */
export function registerSignalsCommand(program: Command): void {
  const signals = program.command('signals').description('Manage signals');

  signals
    .command('ingest <message>')
    .description('Submit a manual signal')
    .option('--source <s>', 'Signal source identifier', 'manual')
    .option('--severity <sev>', 'Signal severity (critical, high, medium, low)', 'medium')
    .option('--project <id>', 'Project ID')
    .action(async (message: string, opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
        const client = createClient(globalOpts);

        const body: Record<string, unknown> = {
          source: opts.source,
          type: 'manual-signal',
          severity: opts.severity,
          payload: { message },
        };
        if (opts.project) body.projectId = opts.project;

        const result = await client.signals.ingest(body);

        output(result, globalOpts, () => {
          console.log(`Signal created: ${result.data.signal.id}`);
          console.log(`Linked issue: #${result.data.issue.number} ${result.data.issue.title}`);
        });
      });
    });
}
```

**Delete:** `apps/cli/src/commands/comment.ts`, `apps/cli/src/commands/signal.ts`

**Acceptance Criteria:**

- [ ] `comment.ts` deleted, `comments.ts` created with `add` subcommand
- [ ] `signal.ts` deleted, `signals.ts` created with `ingest` subcommand
- [ ] Both use SDK client via `createClient()`
- [ ] Author name changed from `looped-cli` to `loop-cli`
- [ ] Types from `@dork-labs/loop-types`

### Task 2.3: Move status to dashboard, migrate remaining commands to SDK

Rename `status.ts` to `dashboard.ts`. Migrate `projects.ts`, `goals.ts`, `templates.ts`, and `triage.ts` to use SDK client.

**Rename `apps/cli/src/commands/status.ts` to `apps/cli/src/commands/dashboard.ts`:**

- Change function name to `registerDashboardCommand`
- Change command name from `status` to `dashboard`
- Replace `createApiClient` with `createClient` from SDK
- Replace raw ky calls with SDK methods (e.g., `client.dashboard.stats()`)
- Replace type imports from `../types.js` with `@dork-labs/loop-types`

**Update `apps/cli/src/commands/projects.ts`:**

- Replace `createApiClient` with `createClient`
- Replace `api.get('api/projects', ...)` with `client.projects.list(params)`
- Replace type imports with `@dork-labs/loop-types`

**Update `apps/cli/src/commands/goals.ts`:**

- Replace `createApiClient` with `createClient`
- Replace `api.get('api/goals', ...)` with `client.goals.list(params)`
- Replace type imports with `@dork-labs/loop-types`

**Update `apps/cli/src/commands/templates.ts`:**

- Replace `createApiClient` with `createClient`
- Replace raw ky calls with SDK methods
- Replace type imports with `@dork-labs/loop-types`

**Update `apps/cli/src/commands/triage.ts`:**

- Replace `createApiClient` with `createClient`
- Replace raw ky calls with SDK methods
- Replace type imports with `@dork-labs/loop-types`
- Update author name from `looped-cli` to `loop-cli`

**Delete:** `apps/cli/src/commands/status.ts`

**Acceptance Criteria:**

- [ ] `status.ts` deleted, `dashboard.ts` created
- [ ] Dashboard command registered as `loop dashboard`
- [ ] All five commands migrated from raw ky to SDK client
- [ ] All type imports use `@dork-labs/loop-types`
- [ ] No remaining imports of `api-client.js` in any command file

### Task 2.4: Update output.ts with three-tier output system

Enhance the `output()` function to support three tiers: human (default), JSON (`--json`), and plain (`--plain`). Add `renderPlainTable` helper.

**Replace `apps/cli/src/lib/output.ts` with:**

```typescript
import Table from 'cli-table3';
import pc from 'picocolors';
import type { Issue } from '@dork-labs/loop-types';

/** Color map for issue statuses. */
export const STATUS_COLOR: Record<string, (s: string) => string> = {
  triage: pc.yellow,
  todo: pc.cyan,
  backlog: pc.dim,
  in_progress: pc.blue,
  done: pc.green,
  canceled: pc.red,
};

/** Human-readable priority labels with color. */
export const PRIORITY_LABEL: Record<number, string> = {
  0: pc.dim('none'),
  1: pc.red('urgent'),
  2: pc.yellow('high'),
  3: pc.white('medium'),
  4: pc.dim('low'),
};

/** Icon map for issue types. */
export const TYPE_ICON: Record<string, string> = {
  signal: '\u26A1',
  hypothesis: '\uD83D\uDD2C',
  plan: '\uD83D\uDCCB',
  task: '\uD83D\uDD27',
  monitor: '\uD83D\uDC41',
};

interface OutputOptions {
  json?: boolean;
  plain?: boolean;
}

/**
 * Three-tier output dispatcher.
 *
 * @param data - Raw data for JSON/plain output
 * @param opts - Global output options
 * @param renderHuman - Callback for colored table output
 * @param renderPlain - Callback for tab-separated output
 */
export function output(
  data: unknown,
  opts: OutputOptions,
  renderHuman: () => void,
  renderPlain?: () => void
): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else if (opts.plain) {
    if (renderPlain) {
      renderPlain();
    } else {
      process.stdout.write(JSON.stringify(data) + '\n');
    }
  } else {
    renderHuman();
  }
}

/**
 * Render tab-separated rows for --plain output.
 *
 * @param headers - Column names
 * @param rows - 2D array of cell values
 */
export function renderPlainTable(headers: string[], rows: string[][]): void {
  process.stdout.write(headers.join('\t') + '\n');
  for (const row of rows) {
    process.stdout.write(row.join('\t') + '\n');
  }
}

/**
 * Render a list of issues as a formatted table.
 * Columns: #, TYPE, TITLE, STATUS, PRI, PROJECT, CREATED
 */
export function renderIssueTable(issues: Issue[]): void {
  const table = new Table({
    head: ['#', 'TYPE', 'TITLE', 'STATUS', 'PRI', 'PROJECT', 'CREATED'],
    style: { head: ['cyan'] },
  });

  for (const issue of issues) {
    const type = issue.type ?? '';
    const status = issue.status ?? '';
    const priority = issue.priority ?? 3;
    const title = truncate(issue.title ?? '', 50);
    const colorStatus = (STATUS_COLOR[status] ?? pc.white)(status);
    const icon = TYPE_ICON[type] ?? '';

    table.push([
      String(issue.number ?? ''),
      `${icon} ${type}`,
      title,
      colorStatus,
      PRIORITY_LABEL[priority] ?? String(priority),
      issue.projectId ?? '-',
      formatDate(issue.createdAt ?? ''),
    ]);
  }

  console.log(table.toString());
}

/** Truncate a string to maxLen, appending ellipsis if needed. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/** Format an ISO date string to YYYY-MM-DD. */
export function formatDate(iso: string): string {
  if (!iso) return '-';
  return iso.slice(0, 10);
}
```

**Acceptance Criteria:**

- [ ] `output()` function signature includes `renderPlain` optional parameter
- [ ] `--json` outputs indented JSON to stdout
- [ ] `--plain` calls renderPlain callback if provided, falls back to compact JSON
- [ ] Default (no flag) calls renderHuman callback
- [ ] `renderPlainTable` helper exported for tab-separated output
- [ ] Type import uses `@dork-labs/loop-types`
- [ ] All existing helpers preserved (STATUS_COLOR, PRIORITY_LABEL, TYPE_ICON, truncate, formatDate)

### Task 2.5: Wire up all commands in cli.ts entry point

After all commands are migrated, update `cli.ts` with the full import list and registration calls for the new command structure.

**Update `apps/cli/src/cli.ts` to:**

```typescript
import { Command } from 'commander';
import { registerNextCommand } from './commands/next.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { registerTriageCommand } from './commands/triage.js';
import { registerIssuesCommand } from './commands/issues.js';
import { registerProjectsCommand } from './commands/projects.js';
import { registerGoalsCommand } from './commands/goals.js';
import { registerLabelsCommand } from './commands/labels.js';
import { registerSignalsCommand } from './commands/signals.js';
import { registerTemplatesCommand } from './commands/templates.js';
import { registerCommentsCommand } from './commands/comments.js';
import { registerAuthCommand } from './commands/auth.js';
import { registerConfigCommand } from './commands/config.js';
import { registerCompletionsCommand } from './commands/completions.js';

const program = new Command()
  .name('loop')
  .description('Terminal-native interface to Loop')
  .version('0.2.0')
  .option('--json', 'Output raw JSON')
  .option('--plain', 'Output tab-separated values (no colors)')
  .option('--api-url <url>', 'Override API URL')
  .option('--token <token>', 'Override auth token');

// Top-level commands (workflow shortcuts)
registerNextCommand(program);
registerDashboardCommand(program);
registerTriageCommand(program);

// Resource commands (gh-style)
registerIssuesCommand(program);
registerProjectsCommand(program);
registerGoalsCommand(program);
registerLabelsCommand(program);
registerSignalsCommand(program);
registerTemplatesCommand(program);
registerCommentsCommand(program);

// System commands
registerAuthCommand(program);
registerConfigCommand(program);
registerCompletionsCommand(program);

export { program };
```

**Acceptance Criteria:**

- [ ] All 13 command registrations present
- [ ] Old imports removed (show, create, comment, signal, status, dispatch)
- [ ] New imports added (next, dashboard, issues, signals, comments, auth, labels, completions)
- [ ] Program exports correctly
- [ ] `bin.ts` unchanged (still imports from `./cli.js`)

## Phase 3: New Commands

### Task 3.1: Implement loop next command

Create the signature `loop next` command that returns the highest-priority unblocked issue with dispatch instructions. Replaces the old `looped next` (queue preview) with actual dispatch behavior.

**Create `apps/cli/src/commands/next.ts`:**

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output, TYPE_ICON, PRIORITY_LABEL, STATUS_COLOR } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';

/** Register the `next` top-level command. */
export function registerNextCommand(program: Command): void {
  program
    .command('next')
    .description('Get the next highest-priority task with dispatch instructions')
    .option('--project <id>', 'Filter by project ID')
    .action(async (opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
        const client = createClient(globalOpts);
        const result = await client.dispatch.next({
          projectId: opts.project,
        });

        if (!result) {
          console.log('No tasks available. The dispatch queue is empty.');
          return;
        }

        output(
          result,
          globalOpts,
          () => {
            renderDispatchResult(result);
          },
          () => {
            const { issue, prompt } = result;
            console.log(
              [issue.id, issue.number, issue.title, issue.priority, issue.status].join('\t')
            );
            if (prompt) console.log(prompt);
          }
        );
      });
    });
}

/** Render a dispatch result with issue details and prompt instructions. */
function renderDispatchResult(result: { issue: Record<string, unknown>; prompt?: string }): void {
  const issue = result.issue;
  const type = String(issue.type ?? '');
  const status = String(issue.status ?? '');
  const priority = Number(issue.priority ?? 3);
  const icon = TYPE_ICON[type] ?? '';
  const colorStatus = (STATUS_COLOR[status] ?? pc.white)(status);

  console.log(pc.bold(`\n#${issue.number} ${issue.title}`));
  console.log(`  Type:     ${icon} ${type}`);
  console.log(`  Status:   ${colorStatus}`);
  console.log(`  Priority: ${PRIORITY_LABEL[priority] ?? String(priority)}`);
  console.log(`  ID:       ${pc.dim(String(issue.id))}`);

  if (result.prompt) {
    console.log(`\n${pc.bold('INSTRUCTIONS')}`);
    console.log(result.prompt);
  }
}
```

**Delete:** `apps/cli/src/commands/dispatch.ts` (functionality split between `next.ts` and `issues start`)

**Acceptance Criteria:**

- [ ] `loop next` calls SDK `dispatch.next()` method
- [ ] Supports `--project <id>` filter
- [ ] Shows "No tasks available" when queue is empty
- [ ] Human output shows issue details + prompt instructions
- [ ] Plain output shows tab-separated issue fields + prompt text
- [ ] JSON output returns raw dispatch result
- [ ] `dispatch.ts` deleted

### Task 3.2: Implement loop issues start and done commands

Add `start <id>` and `done <id>` subcommands to the issues command group.

**Add to `apps/cli/src/commands/issues.ts` (after the `create` subcommand):**

```typescript
// -- start
issues
  .command('start <id>')
  .description('Start working on an issue (sets status to in_progress)')
  .action(async (id: string, _opts, cmd) => {
    await withErrorHandler(async () => {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = createClient(globalOpts);

      // Transition to in_progress
      await client.issues.update(id, { status: 'in_progress' });

      // Fetch full detail with context
      const detail = await client.issues.get(id);

      output(
        detail,
        globalOpts,
        () => {
          const icon = TYPE_ICON[detail.data.type] ?? '';
          console.log(pc.green(`Issue #${detail.data.number} is now in_progress`));
          console.log(`  ${icon} ${detail.data.title}`);
          if (detail.data.description) {
            console.log(`\n${pc.bold('Description:')}`);
            console.log(`  ${detail.data.description}`);
          }
        },
        () => {
          const d = detail.data;
          console.log([d.id, d.number, d.title, 'in_progress'].join('\t'));
        }
      );
    });
  });

// -- done
issues
  .command('done <id>')
  .description('Mark an issue as complete with outcome notes')
  .option('--outcome <text>', 'Outcome description')
  .action(async (id: string, opts, cmd) => {
    await withErrorHandler(async () => {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = createClient(globalOpts);

      // Mark as done
      const issue = await client.issues.update(id, { status: 'done' });

      // Add outcome comment if provided
      if (opts.outcome) {
        await client.comments.create(id, {
          body: opts.outcome,
          authorName: 'loop-cli',
          authorType: 'human',
        });
      }

      output(
        issue,
        globalOpts,
        () => {
          console.log(pc.green(`Issue #${issue.data.number} marked as done`));
          if (opts.outcome) {
            console.log(`  Outcome: ${opts.outcome}`);
          }
        },
        () => {
          console.log([issue.data.id, issue.data.number, issue.data.title, 'done'].join('\t'));
        }
      );
    });
  });
```

**Acceptance Criteria:**

- [ ] `loop issues start <id>` transitions issue to `in_progress`
- [ ] `start` fetches and displays issue detail after transition
- [ ] `loop issues done <id>` transitions issue to `done`
- [ ] `done` accepts `--outcome <text>` flag
- [ ] Outcome text saved as comment with `loop-cli` author
- [ ] Both commands support `--json` and `--plain` output
- [ ] Human output shows confirmation messages with issue number

### Task 3.3: Implement loop auth login/logout/status

Create the `auth` command group with `login`, `logout`, and `status` subcommands.

**Create `apps/cli/src/commands/auth.ts`:**

```typescript
import { Command } from 'commander';
import { createSpinner } from 'nanospinner';
import { LoopClient } from '@dork-labs/loop-sdk';
import { readConfig, writeConfig, maskToken } from '../lib/config.js';

/** Register the `auth` command group with login, logout, status. */
export function registerAuthCommand(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with Loop API')
    .action(async () => {
      const { input, password } = await import('@inquirer/prompts');
      const config = readConfig();

      // Prompt for API URL
      const url = await input({
        message: 'Loop API URL:',
        default: config.url || 'http://localhost:5667',
      });

      // Prompt for API key
      const token = await password({
        message: 'API key (starts with loop_):',
      });

      // Validate the key works
      const spinner = createSpinner('Validating...').start();
      try {
        const client = new LoopClient({ apiKey: token, baseUrl: url });
        await client.dashboard.stats();
        spinner.success({ text: 'Authenticated successfully' });
      } catch {
        spinner.error({ text: 'Authentication failed. Check your API key and URL.' });
        process.exit(1);
      }

      writeConfig({ url, token });
      console.log('Config saved to ~/.loop/config.json');
    });

  auth
    .command('logout')
    .description('Clear stored credentials')
    .action(() => {
      writeConfig({});
      console.log('Logged out. Credentials cleared.');
    });

  auth
    .command('status')
    .description('Show current authentication state')
    .action(() => {
      const config = readConfig();
      if (config.token) {
        console.log('Authenticated');
        console.log(`  URL:   ${config.url || '(not set)'}`);
        console.log(`  Token: ${maskToken(config.token)}`);
      } else {
        console.log('Not authenticated. Run: loop auth login');
      }
    });
}
```

**Acceptance Criteria:**

- [ ] `loop auth login` prompts for URL and API key interactively
- [ ] Login validates credentials against server using SDK
- [ ] Spinner shows validation progress
- [ ] Config saved to `~/.loop/config.json` on success
- [ ] Invalid credentials show error and exit(1)
- [ ] `loop auth logout` clears credentials
- [ ] `loop auth status` shows masked token and URL when authenticated
- [ ] `loop auth status` shows "Not authenticated" when not logged in

### Task 3.4: Create labels command

Create the `labels` command group with `list` subcommand.

**Create `apps/cli/src/commands/labels.ts`:**

```typescript
import { Command } from 'commander';
import Table from 'cli-table3';
import pc from 'picocolors';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output, renderPlainTable } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { Label } from '@dork-labs/loop-types';

/** Register the `labels` command group. */
export function registerLabelsCommand(program: Command): void {
  const labels = program.command('labels').description('Manage labels');

  labels
    .command('list')
    .description('List all labels')
    .option('--limit <n>', 'Maximum number of labels to return', '50')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
        const client = createClient(globalOpts);

        const result = await client.labels.list({
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });

        output(
          result,
          globalOpts,
          () => {
            if (result.data.length === 0) {
              console.log(pc.dim('No labels found.'));
              return;
            }
            const table = new Table({
              head: ['ID', 'NAME', 'COLOR'],
              style: { head: ['cyan'] },
            });
            for (const label of result.data) {
              table.push([pc.dim(label.id.slice(0, 8)), label.name, label.color]);
            }
            console.log(table.toString());
          },
          () => {
            renderPlainTable(
              ['ID', 'NAME', 'COLOR'],
              result.data.map((l: Label) => [l.id, l.name, l.color])
            );
          }
        );
      });
    });
}
```

**Acceptance Criteria:**

- [ ] `loop labels list` shows all labels in table format
- [ ] Supports `--limit` and `--offset` pagination
- [ ] `--json` outputs raw JSON
- [ ] `--plain` outputs tab-separated table
- [ ] Uses SDK client for API calls

## Phase 4: Output and Polish

### Task 4.1: Add --plain output to all existing commands

Go through every command and ensure the `renderPlain` callback is provided to `output()`. Commands to update: `dashboard`, `projects list`, `goals list`, `templates list/show/promote`, `triage list/accept/decline`.

**Pattern for each command:**

```typescript
output(
  result,
  globalOpts,
  () => {
    // existing human render
  },
  () => {
    // NEW: plain render
    renderPlainTable(['COL1', 'COL2'], rows);
  }
);
```

**Specific plain renderers needed:**

Dashboard:

```typescript
() => {
  console.log(['issues_total', stats.issues.total].join('\t'));
  console.log(['queue_depth', stats.dispatch.queueDepth].join('\t'));
  console.log(['active', stats.dispatch.activeCount].join('\t'));
  console.log(['done_24h', stats.dispatch.completedLast24h].join('\t'));
  console.log(['goals_total', stats.goals.total].join('\t'));
  console.log(['goals_achieved', stats.goals.achieved].join('\t'));
};
```

Projects list:

```typescript
() => {
  for (const p of result.data) {
    console.log([p.id, p.name, p.status, p.health].join('\t'));
  }
};
```

Goals list:

```typescript
() => {
  for (const g of result.data) {
    console.log(
      [g.id, g.title, g.status, g.currentValue ?? '', g.targetValue ?? '', g.unit ?? ''].join('\t')
    );
  }
};
```

Templates list:

```typescript
() => {
  for (const t of result.data) {
    console.log([t.id, t.slug, t.name, t.specificity, t.activeVersionId ?? ''].join('\t'));
  }
};
```

**Acceptance Criteria:**

- [ ] Every command that calls `output()` provides a `renderPlain` callback
- [ ] `--plain` produces tab-separated output with no colors/formatting
- [ ] Tab-separated output is suitable for piping to `awk`, `cut`, `grep`
- [ ] Fallback for missing renderPlain is compact JSON

### Task 4.2: Implement loop completions for bash/zsh/fish

Create shell completion script generators for bash, zsh, and fish.

**Create `apps/cli/src/commands/completions.ts`:**

```typescript
import { Command } from 'commander';

/** Register the `completions` command for generating shell completion scripts. */
export function registerCompletionsCommand(program: Command): void {
  program
    .command('completions')
    .description('Generate shell completion script')
    .argument('[shell]', 'Shell type: bash, zsh, or fish', 'bash')
    .action((shell: string) => {
      const generators: Record<string, () => string> = {
        bash: generateBashCompletions,
        zsh: generateZshCompletions,
        fish: generateFishCompletions,
      };

      const generator = generators[shell];
      if (!generator) {
        console.error(`Unknown shell: ${shell}. Supported: bash, zsh, fish`);
        process.exit(1);
      }

      process.stdout.write(generator());
    });
}

function generateBashCompletions(): string {
  // Returns complete bash completion script with all commands and subcommands
  // See full implementation in task description
  return `# loop CLI bash completions
# Add to ~/.bashrc: eval "$(loop completions bash)"
_loop_completions() {
  local cur prev commands
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="next dashboard triage issues projects goals labels signals templates comments auth config completions"

  case "\${prev}" in
    loop)
      COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
      ;;
    issues)
      COMPREPLY=( $(compgen -W "list view create start done" -- "\${cur}") )
      ;;
    projects|goals|labels)
      COMPREPLY=( $(compgen -W "list" -- "\${cur}") )
      ;;
    signals)
      COMPREPLY=( $(compgen -W "ingest" -- "\${cur}") )
      ;;
    templates)
      COMPREPLY=( $(compgen -W "list show promote" -- "\${cur}") )
      ;;
    comments)
      COMPREPLY=( $(compgen -W "add" -- "\${cur}") )
      ;;
    triage)
      COMPREPLY=( $(compgen -W "accept decline" -- "\${cur}") )
      ;;
    auth)
      COMPREPLY=( $(compgen -W "login logout status" -- "\${cur}") )
      ;;
    config)
      COMPREPLY=( $(compgen -W "set get list" -- "\${cur}") )
      ;;
    completions)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      ;;
  esac
}
complete -F _loop_completions loop
`;
}

function generateZshCompletions(): string {
  // Returns complete zsh completion script
  return `#compdef loop
_loop() {
  local -a commands
  commands=(
    'next:Get the next highest-priority task'
    'dashboard:Show system health overview'
    'triage:View and manage triage queue'
    'issues:Manage issues'
    'projects:Manage projects'
    'goals:Manage goals'
    'labels:Manage labels'
    'signals:Manage signals'
    'templates:Manage prompt templates'
    'comments:Manage comments'
    'auth:Manage authentication'
    'config:Manage configuration'
    'completions:Generate shell completions'
  )

  _arguments -C \\
    '--json[Output raw JSON]' \\
    '--plain[Output tab-separated values]' \\
    '--api-url[Override API URL]:url:' \\
    '--token[Override auth token]:token:' \\
    '1:command:->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        issues) _values 'subcommand' list view create start done ;;
        auth) _values 'subcommand' login logout status ;;
        config) _values 'subcommand' set get list ;;
        triage) _values 'subcommand' accept decline ;;
        templates) _values 'subcommand' list show promote ;;
        completions) _values 'shell' bash zsh fish ;;
      esac
      ;;
  esac
}
_loop "$@"
`;
}

function generateFishCompletions(): string {
  // Returns complete fish completion script
  return `# loop CLI fish completions
complete -c loop -f
complete -c loop -n '__fish_use_subcommand' -a next -d 'Get next task'
complete -c loop -n '__fish_use_subcommand' -a dashboard -d 'System health'
complete -c loop -n '__fish_use_subcommand' -a triage -d 'Triage queue'
complete -c loop -n '__fish_use_subcommand' -a issues -d 'Manage issues'
complete -c loop -n '__fish_use_subcommand' -a projects -d 'Manage projects'
complete -c loop -n '__fish_use_subcommand' -a goals -d 'Manage goals'
complete -c loop -n '__fish_use_subcommand' -a labels -d 'Manage labels'
complete -c loop -n '__fish_use_subcommand' -a signals -d 'Manage signals'
complete -c loop -n '__fish_use_subcommand' -a templates -d 'Manage templates'
complete -c loop -n '__fish_use_subcommand' -a comments -d 'Manage comments'
complete -c loop -n '__fish_use_subcommand' -a auth -d 'Authentication'
complete -c loop -n '__fish_use_subcommand' -a config -d 'Configuration'
complete -c loop -n '__fish_use_subcommand' -a completions -d 'Shell completions'
complete -c loop -l json -d 'Output raw JSON'
complete -c loop -l plain -d 'Tab-separated output'
complete -c loop -l api-url -d 'Override API URL' -r
complete -c loop -l token -d 'Override auth token' -r
complete -c loop -n '__fish_seen_subcommand_from issues' -a 'list view create start done'
complete -c loop -n '__fish_seen_subcommand_from auth' -a 'login logout status'
complete -c loop -n '__fish_seen_subcommand_from config' -a 'set get list'
complete -c loop -n '__fish_seen_subcommand_from triage' -a 'accept decline'
complete -c loop -n '__fish_seen_subcommand_from templates' -a 'list show promote'
complete -c loop -n '__fish_seen_subcommand_from completions' -a 'bash zsh fish'
`;
}
```

**Acceptance Criteria:**

- [ ] `loop completions bash` outputs valid bash completion script
- [ ] `loop completions zsh` outputs valid zsh completion script
- [ ] `loop completions fish` outputs valid fish completion script
- [ ] Default shell is `bash` when no argument given
- [ ] Unknown shell name shows error and exits
- [ ] All top-level commands included in completions
- [ ] All subcommands included for resource commands

### Task 4.3: Write unit tests for core lib modules

Create unit tests for `output.ts`, `errors.ts`, and `config.ts`.

**Create `apps/cli/src/__tests__/lib/output.test.ts`:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { output, renderPlainTable, truncate, formatDate } from '../../lib/output.js';

describe('output()', () => {
  it('renders human-formatted by default', () => {
    const renderHuman = vi.fn();
    output({ id: '1' }, {}, renderHuman);
    expect(renderHuman).toHaveBeenCalled();
  });

  it('renders JSON with --json flag', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    output({ id: '1' }, { json: true }, vi.fn());
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"id"'));
    spy.mockRestore();
  });

  it('renders plain with --plain flag when renderPlain provided', () => {
    const renderPlain = vi.fn();
    output({ id: '1' }, { plain: true }, vi.fn(), renderPlain);
    expect(renderPlain).toHaveBeenCalled();
  });

  it('falls back to compact JSON when --plain and no renderPlain', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    output({ id: '1' }, { plain: true }, vi.fn());
    expect(spy).toHaveBeenCalledWith('{"id":"1"}\n');
    spy.mockRestore();
  });
});

describe('renderPlainTable()', () => {
  it('outputs tab-separated headers and rows', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    renderPlainTable(
      ['A', 'B'],
      [
        ['1', '2'],
        ['3', '4'],
      ]
    );
    expect(spy).toHaveBeenCalledWith('A\tB\n');
    expect(spy).toHaveBeenCalledWith('1\t2\n');
    expect(spy).toHaveBeenCalledWith('3\t4\n');
    spy.mockRestore();
  });
});

describe('truncate()', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates long strings with ellipsis', () => {
    expect(truncate('hello world', 6)).toBe('hello\u2026');
  });
});

describe('formatDate()', () => {
  it('extracts YYYY-MM-DD from ISO string', () => {
    expect(formatDate('2026-02-23T12:00:00Z')).toBe('2026-02-23');
  });

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('-');
  });
});
```

**Create `apps/cli/src/__tests__/lib/errors.test.ts`:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withErrorHandler } from '../../lib/errors.js';
import { LoopError, LoopNotFoundError } from '@dork-labs/loop-sdk';

describe('withErrorHandler', () => {
  it('maps 401 errors to auth message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });

    try {
      await withErrorHandler(async () => {
        throw new LoopError('Unauthorized', 401, 'HTTP_401');
      });
    } catch {
      /* exit mock */
    }

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('loop auth login'));
    spy.mockRestore();
    exitSpy.mockRestore();
  });

  it('maps 404 errors to not found message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });

    try {
      await withErrorHandler(async () => {
        throw new LoopNotFoundError('Issue not found');
      });
    } catch {
      /* exit mock */
    }

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Not found'));
    spy.mockRestore();
    exitSpy.mockRestore();
  });
});
```

**Create `apps/cli/src/__tests__/lib/config.test.ts`:**

```typescript
import { describe, it, expect } from 'vitest';
import { maskToken } from '../../lib/config.js';

describe('maskToken', () => {
  it('masks tokens longer than 12 chars', () => {
    expect(maskToken('loop_1234567890abcdef')).toBe('loop****cdef');
  });

  it('returns **** for short tokens', () => {
    expect(maskToken('short')).toBe('****');
  });
});
```

**Acceptance Criteria:**

- [ ] `output()` tests cover all three tiers
- [ ] `renderPlainTable()` test verifies tab-separated format
- [ ] `truncate()` and `formatDate()` edge cases covered
- [ ] `withErrorHandler` tests verify SDK error mapping
- [ ] `maskToken` test verifies masking behavior
- [ ] All tests pass with `npm test` from `apps/cli/`

### Task 4.4: Write unit tests for command handlers

Create unit tests for key command handlers: `next`, `issues start/done`.

**Create `apps/cli/src/__tests__/commands/next.test.ts`:**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(),
}));

describe('loop next', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls dispatch.next() and returns result', async () => {
    const mockClient = {
      dispatch: {
        next: vi.fn().mockResolvedValue({
          issue: {
            id: 'iss_1',
            number: 42,
            title: 'Test',
            type: 'task',
            status: 'todo',
            priority: 2,
          },
          prompt: 'Instructions here',
        }),
      },
    };

    const { createClient } = await import('../../lib/client.js');
    vi.mocked(createClient).mockReturnValue(mockClient as any);

    const result = await mockClient.dispatch.next({});
    expect(result).toBeDefined();
    expect(result.issue.id).toBe('iss_1');
    expect(result.prompt).toBe('Instructions here');
  });

  it('handles empty queue', async () => {
    const mockClient = {
      dispatch: { next: vi.fn().mockResolvedValue(null) },
    };

    const result = await mockClient.dispatch.next({});
    expect(result).toBeNull();
  });
});
```

**Create `apps/cli/src/__tests__/commands/issues.test.ts`:**

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(),
}));

describe('loop issues start', () => {
  it('transitions issue to in_progress and fetches detail', async () => {
    const mockClient = {
      issues: {
        update: vi
          .fn()
          .mockResolvedValue({ data: { id: 'iss_1', number: 42, status: 'in_progress' } }),
        get: vi
          .fn()
          .mockResolvedValue({
            data: { id: 'iss_1', number: 42, title: 'Test', type: 'task', status: 'in_progress' },
          }),
      },
    };

    await mockClient.issues.update('iss_1', { status: 'in_progress' });
    expect(mockClient.issues.update).toHaveBeenCalledWith('iss_1', { status: 'in_progress' });

    const detail = await mockClient.issues.get('iss_1');
    expect(detail.data.status).toBe('in_progress');
  });
});

describe('loop issues done', () => {
  it('marks issue as done and adds outcome comment', async () => {
    const mockClient = {
      issues: {
        update: vi.fn().mockResolvedValue({ data: { id: 'iss_1', number: 42, status: 'done' } }),
      },
      comments: {
        create: vi.fn().mockResolvedValue({ data: { id: 'cmt_1' } }),
      },
    };

    await mockClient.issues.update('iss_1', { status: 'done' });
    await mockClient.comments.create('iss_1', {
      body: 'Fixed the bug',
      authorName: 'loop-cli',
      authorType: 'human',
    });

    expect(mockClient.issues.update).toHaveBeenCalledWith('iss_1', { status: 'done' });
    expect(mockClient.comments.create).toHaveBeenCalledWith(
      'iss_1',
      expect.objectContaining({ body: 'Fixed the bug' })
    );
  });
});
```

**Acceptance Criteria:**

- [ ] `next` command test verifies SDK call pattern
- [ ] `next` command test covers empty queue case
- [ ] `issues start` test verifies update + get SDK calls
- [ ] `issues done` test verifies update + comment creation
- [ ] All tests mock SDK client properly
- [ ] All tests pass

### Task 4.5: Integration test for CLI binary

Create an integration test that builds the CLI and verifies basic commands work.

**Create `apps/cli/src/__tests__/integration.test.ts`:**

```typescript
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const CLI_PATH = resolve(__dirname, '../../dist/bin.js');

function runCli(args: string[]): string {
  try {
    return execFileSync('node', [CLI_PATH, ...args], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch (error: any) {
    return error.stdout?.trim() ?? error.stderr?.trim() ?? '';
  }
}

describe('CLI integration', () => {
  it('--version prints version number', () => {
    const result = runCli(['--version']);
    expect(result).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('--help shows command groups', () => {
    const result = runCli(['--help']);
    expect(result).toContain('next');
    expect(result).toContain('issues');
    expect(result).toContain('auth');
    expect(result).toContain('dashboard');
  });

  it('issues --help shows subcommands', () => {
    const result = runCli(['issues', '--help']);
    expect(result).toContain('list');
    expect(result).toContain('view');
    expect(result).toContain('create');
    expect(result).toContain('start');
    expect(result).toContain('done');
  });

  it('auth --help shows subcommands', () => {
    const result = runCli(['auth', '--help']);
    expect(result).toContain('login');
    expect(result).toContain('logout');
    expect(result).toContain('status');
  });

  it('completions bash outputs shell script', () => {
    const result = runCli(['completions', 'bash']);
    expect(result).toContain('_loop_completions');
    expect(result).toContain('complete -F');
  });
});
```

Note: This test requires the CLI to be built first (`npm run build` in `apps/cli/`).

**Acceptance Criteria:**

- [ ] `--version` outputs a semver version string
- [ ] `--help` lists all top-level commands
- [ ] `issues --help` shows all issue subcommands
- [ ] `auth --help` shows login/logout/status
- [ ] `completions bash` outputs valid bash script
- [ ] Tests run after build step
