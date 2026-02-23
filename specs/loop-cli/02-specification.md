---
slug: loop-cli
---

# Specification: Loop CLI — Terminal-Native Interface with `loop next`

## 1. Title

Loop CLI — Refactor `@dork-labs/looped` into `@dork-labs/loop-cli` with SDK migration, `gh`-style grammar, and three-tier output

## 2. Status

Draft

## 3. Authors

- Claude Code — 2026-02-23

## 4. Overview

Refactor the existing DorkOS CLI at `apps/cli/` (published as `@dork-labs/looped`) into the Loop CLI — a terminal-native interface to Loop with `loop next` as the signature command. The refactor renames the package to `@dork-labs/loop-cli` with binary `loop`, migrates HTTP internals from raw ky to the TypeScript SDK (`@dork-labs/loop-sdk`), reorganizes commands to `gh`-style grammar, adds new commands (`auth`, `issues start/done`), a `--plain` output tier, and shell completions.

## 5. Background / Problem Statement

The existing CLI (`@dork-labs/looped`, binary `looped`) was built as the DorkOS CLI during MVP. It works but has several issues that block it from being the standalone Loop CLI product:

1. **Wrong identity** — Named `looped` (DorkOS branding), not `loop` (Loop product branding). Users who install Loop shouldn't need to know about DorkOS.
2. **Duplicated HTTP logic** — Each command manually creates a ky client with auth/retry config. The TypeScript SDK (Feature 4) consolidates this into a single client with proper error types and retry logic.
3. **Duplicated types** — `apps/cli/src/types.ts` mirrors API types by hand. The shared types package (`@dork-labs/loop-types`) provides the canonical source of truth.
4. **Flat command grammar** — Commands like `looped issues`, `looped show <id>`, `looped create` don't follow the `gh`-style resource-action pattern. `loop issues view <id>` is more discoverable and consistent.
5. **Missing output tier** — Only `--json` exists. No `--plain` mode for shell scripting (`grep`, `awk`, `cut` piping).
6. **No auth flow** — Users must manually run `looped config set token <key>`. No `loop auth login` with validation.
7. **Missing workflow commands** — No `loop issues start <id>` (claim + print instructions) or `loop issues done <id> --outcome "..."` (complete + record outcome).

## 6. Goals

- Rename package to `@dork-labs/loop-cli` with binary `loop`
- Migrate all HTTP calls from raw ky to `@dork-labs/loop-sdk`
- Replace hand-mirrored types with `@dork-labs/loop-types`
- Reorganize commands to `loop <resource> <action> [flags]` grammar
- Add `--plain` global output tier (tab-separated, no colors, no spinners)
- Add `loop auth login/logout/status` commands
- Add `loop issues start <id>` and `loop issues done <id> --outcome "..."`
- Add shell completions for bash, zsh, fish
- Preserve all existing command functionality (nothing removed)

## 7. Non-Goals

- Interactive TUI with panels/vim navigation
- MCP server (Feature 2, already built)
- Wrapping every REST endpoint (agent-intent commands only)
- Running a local Loop server
- Plugin/extension system
- Python/Go CLIs
- OAuth/session auth (API key only for now)
- XDG-compliant config path migration (keep `~/.loop/config.json`)
- `--jq` filter on `--json` output (future enhancement)

## 8. Technical Dependencies

| Dependency              | Version         | Purpose                                     |
| ----------------------- | --------------- | ------------------------------------------- |
| `@dork-labs/loop-sdk`   | `*` (workspace) | HTTP client, typed API methods, retry logic |
| `@dork-labs/loop-types` | `*` (workspace) | Shared Zod schemas, entity types, enums     |
| `commander`             | `^14`           | CLI framework (ADR 0015)                    |
| `picocolors`            | `^1`            | Terminal colors                             |
| `cli-table3`            | `^0.6`          | Table rendering                             |
| `nanospinner`           | `^1`            | Loading spinners                            |
| `@inquirer/prompts`     | `^7`            | Interactive prompts (auth login)            |
| `tsup`                  | `^8`            | ESM bundler                                 |
| `typescript`            | `^5`            | Type checking                               |
| `vitest`                | (workspace)     | Testing                                     |

**Prerequisite:** The TypeScript SDK (Feature 4, `@dork-labs/loop-sdk` + `@dork-labs/loop-types`) must be built before this CLI refactor. The CLI is a thin command layer over SDK methods.

## 9. Detailed Design

### 9.1 Package Configuration

**`apps/cli/package.json` changes:**

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
    "commander": "^14", // kept
    "picocolors": "^1", // kept
    "cli-table3": "^0.6", // kept
    "nanospinner": "^1", // kept
    "@inquirer/prompts": "^7", // kept
    // ky REMOVED — SDK handles HTTP
  },
}
```

### 9.2 Command Grammar Reorganization

**Current → New mapping:**

| Current (`looped`)           | New (`loop`)                    | Change Type                  |
| ---------------------------- | ------------------------------- | ---------------------------- |
| `looped next`                | `loop next`                     | Rename binary only           |
| `looped dispatch <id>`       | `loop issues start <id>`        | Moved + enhanced             |
| `looped issues`              | `loop issues list`              | Added explicit `list` action |
| `looped show <id>`           | `loop issues view <id>`         | Moved under `issues`         |
| `looped create`              | `loop issues create`            | Moved under `issues`         |
| N/A                          | `loop issues done <id>`         | **NEW**                      |
| `looped comment`             | `loop comments add`             | Moved to `comments` resource |
| `looped signal`              | `loop signals ingest`           | Renamed to match API         |
| `looped triage`              | `loop triage`                   | Kept (top-level, workflow)   |
| `looped projects`            | `loop projects list`            | Added explicit `list` action |
| `looped goals`               | `loop goals list`               | Added explicit `list` action |
| `looped templates`           | `loop templates list`           | Added explicit `list` action |
| `looped status`              | `loop dashboard`                | Renamed                      |
| `looped config set/get/list` | `loop config set/get/list`      | Kept                         |
| N/A                          | `loop auth login/logout/status` | **NEW**                      |
| N/A                          | `loop completions`              | **NEW**                      |

### 9.3 CLI Entry Point

**`apps/cli/src/cli.ts` — Root program:**

```typescript
import { Command } from 'commander';
// Import all command registrations

const program = new Command()
  .name('loop')
  .description('Terminal-native interface to Loop')
  .version(/* from package.json */)
  .option('--json', 'Output raw JSON')
  .option('--plain', 'Output tab-separated values (no colors)')
  .option('--api-url <url>', 'Override API URL')
  .option('--token <token>', 'Override auth token');

// Top-level commands (workflow shortcuts)
registerNextCommand(program); // loop next
registerDashboardCommand(program); // loop dashboard
registerTriageCommand(program); // loop triage

// Resource commands (gh-style)
registerIssuesCommand(program); // loop issues <action>
registerProjectsCommand(program); // loop projects <action>
registerGoalsCommand(program); // loop goals <action>
registerLabelsCommand(program); // loop labels <action>
registerSignalsCommand(program); // loop signals <action>
registerTemplatesCommand(program); // loop templates <action>
registerCommentsCommand(program); // loop comments <action>

// System commands
registerAuthCommand(program); // loop auth <action>
registerConfigCommand(program); // loop config <action>
registerCompletionsCommand(program); // loop completions

export { program };
```

### 9.4 SDK Client Factory

**`apps/cli/src/lib/client.ts` — Replaces `api-client.ts`:**

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

### 9.5 Three-Tier Output System

**`apps/cli/src/lib/output.ts` — Enhanced output dispatcher:**

```typescript
import type { GlobalOptions } from './config.js';

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
      // Fallback: JSON without indentation
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
```

### 9.6 Error Handling (SDK-aware)

**`apps/cli/src/lib/errors.ts` — Updated for SDK error types:**

```typescript
import { LoopError, LoopNotFoundError, LoopAuthError } from '@dork-labs/loop-sdk';

export async function withErrorHandler(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof LoopAuthError) {
      console.error('Authentication failed. Run: loop auth login');
    } else if (error instanceof LoopNotFoundError) {
      console.error(`Not found: ${error.message}`);
    } else if (error instanceof LoopError) {
      console.error(`API error (${error.status}): ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error('An unexpected error occurred');
    }
    process.exit(1);
  }
}
```

### 9.7 New Commands

#### 9.7.1 `loop next` — Signature Command

The most important command. Returns the highest-priority unblocked issue with dispatch instructions.

```typescript
export function registerNextCommand(program: Command): void {
  program
    .command('next')
    .description('Get the next highest-priority task with dispatch instructions')
    .option('--project <id>', 'Filter by project ID')
    .action(async (opts) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts<GlobalOptions>();
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
            // Human-formatted: issue summary + prompt instructions
            renderDispatchResult(result);
          },
          () => {
            // Plain: issue ID + title + priority
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
```

#### 9.7.2 `loop issues start <id>`

Transitions issue to `in_progress` and prints dispatch instructions.

```typescript
issues
  .command('start <id>')
  .description('Start working on an issue (sets status to in_progress)')
  .action(async (id: string, _opts, cmd) => {
    await withErrorHandler(async () => {
      const globalOpts = cmd.optsWithGlobals<GlobalOptions>();
      const client = createClient(globalOpts);

      // Transition to in_progress
      const issue = await client.issues.update(id, { status: 'in_progress' });

      // Fetch full detail with dispatch context
      const detail = await client.issues.get(id);

      output(detail, globalOpts, () => {
        renderIssueStarted(detail);
      });
    });
  });
```

#### 9.7.3 `loop issues done <id>`

Marks issue complete with outcome notes.

```typescript
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
        await client.comments.create(id, { body: opts.outcome });
      }

      output(issue, globalOpts, () => {
        renderIssueDone(issue, opts.outcome);
      });
    });
  });
```

#### 9.7.4 `loop auth login/logout/status`

```typescript
export function registerAuthCommand(program: Command): void {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Authenticate with Loop API')
    .action(async () => {
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
      console.log(`Config saved to ~/.loop/config.json`);
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
        console.log(`Authenticated`);
        console.log(`  URL:   ${config.url || '(not set)'}`);
        console.log(`  Token: ${maskToken(config.token)}`);
      } else {
        console.log('Not authenticated. Run: loop auth login');
      }
    });
}
```

#### 9.7.5 `loop completions`

```typescript
export function registerCompletionsCommand(program: Command): void {
  program
    .command('completions')
    .description('Generate shell completion script')
    .argument('[shell]', 'Shell type: bash, zsh, or fish', 'bash')
    .action((shell: string) => {
      const completionScripts: Record<string, string> = {
        bash: generateBashCompletions(),
        zsh: generateZshCompletions(),
        fish: generateFishCompletions(),
      };

      const script = completionScripts[shell];
      if (!script) {
        console.error(`Unknown shell: ${shell}. Supported: bash, zsh, fish`);
        process.exit(1);
      }

      process.stdout.write(script);
    });
}
```

Shell completion scripts output static completion definitions that users pipe to the appropriate config file:

- **bash:** `loop completions bash >> ~/.bashrc`
- **zsh:** `loop completions zsh >> ~/.zshrc`
- **fish:** `loop completions fish > ~/.config/fish/completions/loop.fish`

### 9.8 Command File Organization

After refactoring, `apps/cli/src/commands/` contains:

| File             | Commands                                  |
| ---------------- | ----------------------------------------- |
| `next.ts`        | `loop next` — signature command           |
| `issues.ts`      | `loop issues list/view/create/start/done` |
| `projects.ts`    | `loop projects list`                      |
| `goals.ts`       | `loop goals list`                         |
| `labels.ts`      | `loop labels list`                        |
| `signals.ts`     | `loop signals ingest`                     |
| `templates.ts`   | `loop templates list/view/promote`        |
| `triage.ts`      | `loop triage [list/accept/decline]`       |
| `comments.ts`    | `loop comments add`                       |
| `dashboard.ts`   | `loop dashboard`                          |
| `auth.ts`        | `loop auth login/logout/status`           |
| `config.ts`      | `loop config set/get/list`                |
| `completions.ts` | `loop completions [bash/zsh/fish]`        |

### 9.9 Types Migration

**Delete:** `apps/cli/src/types.ts`

**Replace with imports from SDK/types packages:**

```typescript
// Before (in each command file):
import type { Issue, PaginatedResponse } from '../types.js';

// After:
import type { Issue, PaginatedResponse } from '@dork-labs/loop-types';
```

### 9.10 Build Configuration

**`apps/cli/tsup.config.ts` — No changes needed:**

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

The SDK is bundled as an external dependency (not inlined), resolved at runtime via node_modules.

## 10. User Experience

### Installation

```bash
# Global install
npm install -g @dork-labs/loop-cli

# Or use directly
npx @dork-labs/loop-cli next
```

### First-Time Setup

```bash
$ loop auth login
? Loop API URL: http://localhost:5667
? API key (starts with loop_): ****
✔ Authenticated successfully
Config saved to ~/.loop/config.json
```

### Core Workflow

```bash
# Get next task
$ loop next
┌─────────────────────────────────────────────┐
│ 🔧 #42 — Fix OAuth redirect blank screen   │
│ Priority: high    Status: in_progress       │
│ Project: Authentication                     │
├─────────────────────────────────────────────┤
│ INSTRUCTIONS                                │
│                                             │
│ You are fixing an OAuth redirect issue...   │
│ [full dispatch instructions here]           │
└─────────────────────────────────────────────┘

# Start working
$ loop issues start iss_abc123
✔ Issue #42 is now in_progress

# Report completion
$ loop issues done iss_abc123 --outcome "Added loading spinner to OAuth redirect page"
✔ Issue #42 marked as done

# Check system health
$ loop dashboard
Issues: 12 open, 8 done, 3 triage
Goals:  2/5 achieved
```

### Scripting with --plain

```bash
# Get issue IDs for scripting
$ loop issues list --status in_progress --plain
iss_abc123	42	Fix OAuth redirect	high	in_progress
iss_def456	43	Add rate limiting	medium	in_progress

# Pipe to other tools
$ loop issues list --plain | awk -F'\t' '{print $1}' | xargs -I {} loop issues done {} --outcome "batch complete"
```

### JSON for Machine Consumption

```bash
$ loop next --json
{
  "issue": {
    "id": "iss_abc123",
    "number": 42,
    "title": "Fix OAuth redirect blank screen",
    ...
  },
  "prompt": "You are fixing an OAuth redirect issue...",
  "meta": { "templateId": "tpl_1" }
}
```

## 11. Testing Strategy

### Unit Tests

**Command handler tests** — Mock the SDK client, verify correct SDK method calls and output formatting:

```typescript
// __tests__/commands/next.test.ts
describe('loop next', () => {
  it('calls dispatch.next() and renders result', async () => {
    // Mock SDK client
    const mockClient = {
      dispatch: {
        next: vi.fn().mockResolvedValue({
          issue: { id: 'iss_1', number: 42, title: 'Test' },
          prompt: 'Instructions here',
        }),
      },
    };

    // Execute command
    // Verify SDK called correctly
    // Verify output rendered
  });

  it('shows empty message when queue is empty', async () => {
    const mockClient = {
      dispatch: { next: vi.fn().mockResolvedValue(null) },
    };
    // Verify empty queue message
  });
});
```

**Output tier tests** — Verify each output mode produces correct format:

```typescript
describe('output()', () => {
  it('renders human-formatted by default', () => {
    const renderHuman = vi.fn();
    output(data, {}, renderHuman);
    expect(renderHuman).toHaveBeenCalled();
  });

  it('renders JSON with --json flag', () => {
    const spy = vi.spyOn(process.stdout, 'write');
    output(data, { json: true }, vi.fn());
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"id"'));
  });

  it('renders plain with --plain flag', () => {
    const renderPlain = vi.fn();
    output(data, { plain: true }, vi.fn(), renderPlain);
    expect(renderPlain).toHaveBeenCalled();
  });
});
```

**Config tests** — Verify config resolution priority:

```typescript
describe('resolveConfig', () => {
  it('prefers CLI flags over env vars', () => {
    process.env.LOOP_API_URL = 'http://env-url';
    const result = resolveConfig({ apiUrl: 'http://flag-url' });
    expect(result.url).toBe('http://flag-url');
  });
});
```

**Error handling tests** — Verify SDK errors map to user-friendly messages:

```typescript
describe('withErrorHandler', () => {
  it('maps LoopAuthError to auth message', async () => {
    const spy = vi.spyOn(console, 'error');
    await withErrorHandler(async () => {
      throw new LoopAuthError('Invalid token');
    });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('loop auth login'));
  });
});
```

### Integration Tests

**Full command execution** — Use `execa` to run the built CLI binary with a mock API server:

```typescript
describe('CLI integration', () => {
  it('loop --version prints version', async () => {
    const { stdout } = await execa('./dist/bin.js', ['--version']);
    expect(stdout).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('loop --help shows command groups', async () => {
    const { stdout } = await execa('./dist/bin.js', ['--help']);
    expect(stdout).toContain('next');
    expect(stdout).toContain('issues');
    expect(stdout).toContain('auth');
  });
});
```

### Mocking Strategy

- **SDK mocking:** Mock `@dork-labs/loop-sdk` at the module level using `vi.mock()`. Each command test provides its own mock client responses.
- **Config mocking:** Mock `readConfig()` and `writeConfig()` to avoid touching `~/.loop/config.json` during tests.
- **stdout capture:** Use `vi.spyOn(process.stdout, 'write')` to capture output for assertion.

## 12. Performance Considerations

- **Startup time:** Commander.js adds ~40ms startup overhead. No change from current CLI. The SDK import is lazy (only loaded when a command runs, not at parse time).
- **Bundle size:** Removing ky as a direct dependency (SDK handles it) should reduce bundle slightly. Adding SDK as a dependency adds ~50KB but replaces duplicated logic.
- **No runtime impact on output:** `--plain` mode is faster than human mode (no color processing, no table rendering).

## 13. Security Considerations

- **Token storage:** `~/.loop/config.json` with file mode `0o600` (owner-readable only). No change from current behavior.
- **Token masking:** `loop auth status` shows first 4 + last 4 characters only. `loop config list` does the same.
- **No token in args warning:** If `--token` is passed as a CLI flag, it appears in shell history. Consider adding a warning in docs, but do not prevent usage (needed for CI).
- **Auth validation:** `loop auth login` validates the API key against the server before storing it. Invalid keys are rejected immediately.

## 14. Documentation

Documentation updates needed (tracked separately in Feature 7):

- **CLI reference page** — Full command reference with examples for every command
- **Getting started guide** — Updated quickstart with `loop auth login` and `loop next`
- **Migration guide** — For existing `looped` users: install `@dork-labs/loop-cli`, config is compatible
- **Shell completions setup** — Instructions for bash, zsh, fish
- **README.md** in `apps/cli/` — Update package name and examples

## 15. Implementation Phases

### Phase 1: Core Refactor

- Rename package to `@dork-labs/loop-cli`, binary to `loop`
- Add SDK dependency (`@dork-labs/loop-sdk`, `@dork-labs/loop-types`)
- Create SDK client factory (`src/lib/client.ts`)
- Delete `src/types.ts`, replace with `@dork-labs/loop-types` imports
- Delete `src/lib/api-client.ts` (replaced by SDK client)
- Update error handler for SDK error types
- Update `src/cli.ts` program name and version

### Phase 2: Command Grammar Reorganization

- Restructure `issues` as subcommand group (`list`, `view`, `create`)
- Move `show <id>` → `issues view <id>`
- Move `create` → `issues create`
- Move `comment` → `comments add`
- Move `signal` → `signals ingest`
- Move `status` → `dashboard`
- Add explicit `list` action to `projects`, `goals`, `labels`
- Migrate each command handler from raw ky to SDK calls

### Phase 3: New Commands

- Implement `loop next` (refactored from `dispatch next` to use SDK `dispatch.next()`)
- Implement `loop issues start <id>` (new)
- Implement `loop issues done <id> --outcome` (new)
- Implement `loop auth login/logout/status` (new)

### Phase 4: Output & Polish

- Add `--plain` global option to program
- Update `output()` function to support three tiers
- Add `renderPlain` callbacks to all commands
- Implement `loop completions` for bash/zsh/fish
- Update all tests for new grammar and SDK mocking
- Verify `npx @dork-labs/loop-cli` works end-to-end

## 16. Open Questions

None — all decisions resolved during ideation.

## 17. Related ADRs

| ADR  | Title                              | Relevance                                                            |
| ---- | ---------------------------------- | -------------------------------------------------------------------- |
| 0015 | Use Commander.js for CLI           | Framework decision — kept                                            |
| 0031 | Hand-Written SDK Over Generation   | SDK approach — CLI consumes hand-written SDK                         |
| 0032 | Shared Types Package for API Types | Types source of truth — CLI uses `@dork-labs/loop-types`             |
| 0033 | Use ky for SDK HTTP Layer          | HTTP client — SDK uses ky internally, CLI no longer uses ky directly |

## 18. References

- `specs/loop-cli/01-ideation.md` — Full ideation with codebase map and decisions
- `specs/typescript-sdk/02-specification.md` — SDK specification (prerequisite)
- `specs/agent-integration-strategy.md` — Feature 6 in the agent integration roadmap
- `research/20260223_loop_cli_best_practices.md` — CLI framework comparison, output patterns
- `research/20260222_sdk_cli_api_interaction_layers.md` — SDK/CLI patterns from gh, Linear
- `decisions/0015-use-commander-for-cli.md` — Commander.js framework decision
