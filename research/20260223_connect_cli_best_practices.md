# Research: `npx @dork-labs/loop-connect` CLI — Best Practices

**Date:** 2026-02-23
**Feature:** connect-cli
**Research Mode:** Deep Research
**Searches performed:** 16

---

## Research Summary

`@clack/prompts` is the clear winner for this use case — it is the modern standard adopted by Astro, create-t3-app, and other contemporary scaffolding CLIs, with a beautiful opinionated design, small footprint (~240 kB installed), and a great async/spinner API. For npx publishing, the right structure is a single CJS bundle built with `tsup`, a shebang entry point, and a `files` whitelist. Idempotent file writes should follow a read-parse-write cycle that checks for existing keys before appending. Agent environment detection is best done via filesystem heuristics (config file presence) rather than environment variables, since no standard env var signals "I am Cursor" reliably across platforms.

---

## Key Findings

1. **@clack/prompts is the modern choice**: Created by an Astro core team member, adopted by create-t3-app (which explicitly migrated to it), ~2.5M weekly downloads. The API covers `text`, `select`, `confirm`, `multiselect`, `spinner`, `group`, `tasks`, `intro`, `outro`, `isCancel`, and `note`. It is actively maintained under the `bombshell-dev` org.

2. **npx publishing is straightforward with tsup**: Build a single CJS bundle with `tsup` (esbuild-powered, zero config), add a `#!/usr/bin/env node` shebang, declare `bin` in `package.json`, and whitelist only `dist/` in the `files` array.

3. **Non-interactive mode (`--yes`)**: create-t3-app uses a `-y, --default` flag that skips `p.group()` calls and falls through to a `defaultOptions` object. The pattern is: check the flag early, build the result object from flag values + defaults, skip all prompts.

4. **Idempotent env/config writes**: The canonical pattern is grep-before-append. For `.env.local`, read the existing file (if any), parse the keys that are already set, only write keys that are absent. For structured files like `.mcp.json` or `CLAUDE.md`, parse the existing content and merge rather than concatenate.

5. **Agent detection via filesystem**: There is no single reliable environment variable for each agent. The most robust approach is detecting config file presence: `.cursor/` directory or `.cursorignore` for Cursor, `CLAUDE.md` for Claude Code, `.openhands/` for OpenHands. `process.env.TERM_PROGRAM === 'vscode'` works for VS Code and Cursor in the integrated terminal, but is unreliable when run externally.

6. **API key security in CLIs**: Use `password()` from `@clack/prompts` to mask input. Never log the key. Write it to `.env.local` only. Validate via an HTTP call with a spinner showing progress. On failure, offer a retry prompt rather than hard-exiting.

---

## Detailed Analysis

### CLI Framework Comparison

#### @clack/prompts

The standout choice for 2025–2026. Created by Nate Moore (Astro core team), now maintained at `bombshell-dev/clack`. The opinionated pre-styled `@clack/prompts` package wraps `@clack/core` (unstyled primitives) and ships everything a setup CLI needs: structured prompt groups, async spinners, task runners, cancellation detection, and beautiful box-drawing output.

**API surface relevant to `loop-connect`:**

- `intro(msg)` / `outro(msg)` — frame the session visually
- `text({ message, placeholder, validate })` — text input with inline validation
- `password({ message, validate })` — masked input for API key entry
- `select({ message, options })` — single-choice list (for project selection)
- `confirm({ message })` — yes/no
- `spinner()` → `.start(msg)` / `.stop(msg)` — async operation feedback
- `group(prompts, { onCancel })` — chain prompts, pass prior results forward
- `isCancel(value)` — detect Ctrl+C after every prompt
- `cancel(msg)` — graceful exit message
- `note(msg, title)` — info box (good for showing what files were written)
- `tasks([{ title, task }])` — sequential async tasks with status

**The async validation gap**: `validate()` in `text()`/`password()` must return synchronously. For async API key validation, the recommended pattern is:

1. Collect the key via `password()` with a format-only sync validate (prefix check, length check)
2. After the prompt completes, use `spinner()` to call the API
3. On failure, re-prompt using a loop

**Installed size:** ~240 kB (npm install size including all deps). No heavy transitive dependencies.

**Used by:** create-t3-app, Astro, ElizaOS, and 4,000+ npm packages.

**Maintenance:** Active — v1.0.1 published February 2026 (8 days before this research).

---

#### @inquirer/prompts (Inquirer.js rewrite)

The official rewrite of the classic `inquirer` package. Modular — install only the prompt types you need (`@inquirer/input`, `@inquirer/select`, etc.) or install `@inquirer/prompts` for all of them. Bundle size: ~23.4 kB minified (much smaller than old inquirer). Actively maintained by SBoudrias. Supports async validate functions natively.

The DX is more verbose than clack — no built-in `intro`/`outro`/`spinner` abstraction. You'd compose with `ora` for spinners. The output is functional but less visually polished than clack by default.

**Best for:** CLIs that need async validation inside the prompt (e.g., validate a key before moving to the next question without re-prompting). For `loop-connect`, this is a minor advantage since the post-prompt spinner pattern is equally clean.

---

#### enquirer

Last published 3 years ago (v2.4.1). Still used by ~3,800 packages (ESLint, webpack historically). Feature-rich with autocomplete, fuzzy search, multiselect. But effectively unmaintained. **Do not use for new projects.**

---

#### ink (React for CLIs)

React component model rendered to terminal. Used by Gatsby, Shopify. High startup overhead due to React dependency. DX is excellent for complex interactive UIs (live-updating dashboards, multi-pane CLIs) but overkill for a linear setup wizard. Cold-start via `npx` is noticeably slower due to React's module graph. **Not recommended for a setup CLI meant to run once.**

---

#### prompts

Lightweight, promise-based, simple API. Last major update 2020. The `onCancel` handling is awkward (returns `{}` instead of throwing). Not aesthetically as polished as clack. No active maintenance signals. **Skip.**

---

#### commander + inquirer (classic combo)

Proven, widely understood, massive ecosystem. `commander` for argument parsing + old `inquirer` for prompts. Old `inquirer` is now in maintenance mode — the new `@inquirer/prompts` is the recommended path. This combo is fine but produces more boilerplate and less polished output than clack. Choose this if the team is more familiar with it or needs maximum compatibility.

---

### npx Publishing Best Practices

#### package.json structure

```json
{
  "name": "@dork-labs/loop-connect",
  "version": "1.0.0",
  "description": "Connect your project to Loop in one command",
  "bin": {
    "loop-connect": "./dist/index.js"
  },
  "main": "./dist/index.js",
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs --no-splitting --clean",
    "prepublishOnly": "npm run build"
  },
  "engines": {
    "node": ">=18"
  }
}
```

Key decisions:

- `bin` maps the command name to the CJS bundle entry point
- `files: ["dist"]` whitelists only built output — no source, no tests
- `prepublishOnly` ensures the build always runs before `npm publish`
- Single CJS format (not dual ESM/CJS) is correct for CLIs — you don't need ESM for a Node script

#### Entry point (src/index.ts)

```typescript
#!/usr/bin/env node
// ^ This MUST be the first line, before any imports or comments
import { run } from './cli';
run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

The shebang makes the file directly executable on Unix. On Windows, npm wraps it in a `.cmd` shim automatically. Without the shebang, Node is not invoked on Unix.

#### tsup config

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  clean: true,
  minify: false, // Keep readable for debugging; minify adds no real benefit for CLIs
  shims: true, // Polyfills __dirname/__filename for ESM compat
  banner: {
    js: '#!/usr/bin/env node', // tsup can inject shebang automatically
  },
});
```

Note: if using `banner` to inject the shebang, do NOT also put it in the source file — that creates `#!/usr/bin/env node\n#!/usr/bin/env node`.

#### Test before publishing

```bash
npm pack --dry-run    # Preview exactly what files will be published
node dist/index.js    # Smoke test the bundle directly
npm link              # Test the bin command locally
npx .                 # Test npx invocation from the package directory
```

#### Version and publishing

Use `npm version patch|minor|major` (updates package.json + creates a git tag), then `npm publish --access public` for scoped packages.

---

### Environment Detection Patterns

There is no universally reliable single env var that identifies each agent. The best strategy is a layered filesystem + env var check:

#### Detection matrix

| Agent                        | Best detection signal                            | Fallback                                                       |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| **Claude Code**              | `CLAUDE.md` exists in project root               | `process.env.ANTHROPIC_API_KEY` is set                         |
| **Cursor**                   | `.cursor/` directory exists in project root      | `process.env.CURSOR_CLI` is set (in Cursor terminal)           |
| **Windsurf**                 | `.windsurfrules` file or `.windsurf/` dir exists | `process.env.TERM_PROGRAM === 'vscode'` (also matches VS Code) |
| **OpenHands**                | `.openhands/` directory exists                   | `process.env.RUNTIME === 'local'`                              |
| **Generic VS Code**          | `process.env.TERM_PROGRAM === 'vscode'`          | Extensions installed                                           |
| **CI (GitHub Actions etc.)** | `process.env.CI === 'true'`                      | `process.env.GITHUB_ACTIONS` etc.                              |

#### Implementation pattern

```typescript
interface DetectedAgents {
  claudeCode: boolean;
  cursor: boolean;
  openHands: boolean;
  windsurf: boolean;
  ci: boolean;
}

import fs from 'node:fs';
import path from 'node:path';

function detectAgentEnvironments(cwd: string): DetectedAgents {
  const exists = (p: string) => fs.existsSync(path.join(cwd, p));
  return {
    claudeCode: exists('CLAUDE.md') || exists('AGENTS.md'),
    cursor: exists('.cursor') || !!process.env.CURSOR_CLI,
    openHands: exists('.openhands'),
    windsurf: exists('.windsurfrules') || exists('.windsurf'),
    ci: process.env.CI === 'true' || !!process.env.CI,
  };
}
```

#### What to write per agent

| Agent detected | File to write                                  | Content                                             |
| -------------- | ---------------------------------------------- | --------------------------------------------------- |
| Claude Code    | `CLAUDE.md`                                    | Append section with `LOOP_API_URL` and project slug |
| Cursor         | `.cursor/mcp.json` OR `.cursor/rules/loop.mdc` | MCP server config block                             |
| OpenHands      | `.openhands/microagents/loop.md`               | Agent capability description                        |
| All            | `.env.local`                                   | `LOOP_API_KEY=...`, `LOOP_PROJECT_ID=...`           |

#### Note on `AGENTS.md` vs `CLAUDE.md`

As of early 2026, if both `AGENTS.md` and `CLAUDE.md` exist in a project, Claude Code uses only `AGENTS.md`. The repo already has `AGENTS.md` (based on the recent commit). Write to `AGENTS.md` when detected, not `CLAUDE.md`.

---

### Idempotent File Write Patterns

#### For `.env.local` — upsert pattern

```typescript
import fs from 'node:fs';
import path from 'node:path';

interface EnvVars {
  [key: string]: string;
}

function upsertEnvFile(filePath: string, vars: EnvVars): void {
  let existing = '';
  if (fs.existsSync(filePath)) {
    existing = fs.readFileSync(filePath, 'utf-8');
  }

  // Parse existing keys
  const existingKeys = new Set<string>();
  for (const line of existing.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (match) existingKeys.add(match[1]);
  }

  // Build lines to append (only missing keys)
  const toAppend = Object.entries(vars)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');

  if (!toAppend) return; // Nothing new to write

  // Ensure existing file ends with a newline before appending
  const separator = existing && !existing.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(filePath, existing + separator + toAppend + '\n');
}
```

If you want to **update** an existing key (not just append if missing), replace the line in-place:

```typescript
function setEnvVar(filePath: string, key: string, value: string): void {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';

  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const newLine = `${key}=${value}`;

  if (pattern.test(content)) {
    content = content.replace(pattern, newLine); // Update existing
  } else {
    content += (content.endsWith('\n') ? '' : '\n') + newLine + '\n'; // Append
  }

  fs.writeFileSync(filePath, content);
}
```

#### For `.mcp.json` / Cursor config — JSON merge

```typescript
function upsertJsonConfig(filePath: string, merge: object): void {
  let existing = {};
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      // Malformed JSON — back up and overwrite
      fs.copyFileSync(filePath, filePath + '.bak');
    }
  }

  // Deep merge — don't clobber existing mcpServers entries
  const merged = deepMerge(existing, merge);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2) + '\n');
}
```

#### For `CLAUDE.md` / `AGENTS.md` — section guard

```typescript
const LOOP_SECTION_MARKER = '<!-- loop-connect -->';

function upsertMarkdownSection(filePath: string, section: string): void {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes(LOOP_SECTION_MARKER)) {
      return; // Already present, skip
    }
  }

  const toAppend = `\n${LOOP_SECTION_MARKER}\n${section}\n`;
  fs.appendFileSync(filePath, toAppend);
}
```

---

### API Key Validation UX

#### The problem with `validate()` in clack prompts

The `validate` function in `text()`/`password()` is synchronous — you cannot `await` inside it. This means you cannot hit the API from inside the prompt. The correct pattern is two-phase:

**Phase 1**: Synchronous format validation in `validate()` (prefix check, length, character set)
**Phase 2**: Async network validation via `spinner()` after the prompt

#### Full pattern for `loop-connect`

```typescript
import { password, spinner, isCancel, cancel, log, note } from '@clack/prompts';

async function collectAndValidateApiKey(): Promise<string> {
  let apiKey: string | undefined;

  while (true) {
    const raw = await password({
      message: 'Paste your Loop API key:',
      validate: (value) => {
        if (!value) return 'API key is required';
        if (!value.startsWith('loop_')) return 'Loop API keys start with loop_';
        if (value.length < 20) return 'That key looks too short';
      },
    });

    if (isCancel(raw)) {
      cancel('Setup cancelled.');
      process.exit(0);
    }

    const s = spinner();
    s.start('Validating API key...');

    try {
      const res = await fetch('https://api.looped.me/api/projects', {
        headers: { Authorization: `Bearer ${raw}` },
      });

      if (res.ok) {
        s.stop('API key is valid.');
        apiKey = raw as string;
        break;
      } else if (res.status === 401) {
        s.stop('API key rejected (401 Unauthorized).');
        log.error('That key was not accepted. Check it and try again.');
        // Loop continues — prompts again
      } else {
        s.stop(`Unexpected response: ${res.status}`);
        log.warn('Could not reach the Loop API. Check your connection.');
        break; // Don't retry on network errors
      }
    } catch (err) {
      s.stop('Network error.');
      log.warn('Could not reach the Loop API. Continuing without validation.');
      apiKey = raw as string;
      break;
    }
  }

  return apiKey!;
}
```

Key UX decisions:

- **Retry on 401** (bad key) — don't exit, let them try again
- **Don't retry on network error** — assume offline/firewall and proceed
- **Show what went wrong** with `log.error()` before re-prompting
- **`password()`** rather than `text()` — masks the key in terminal history

---

### Non-Interactive Mode Patterns

#### The `--yes` / `--default` flag pattern (from create-t3-app)

```typescript
import { parseArgs } from 'node:util'; // Node 18+ built-in

const { values: flags } = parseArgs({
  options: {
    yes: { type: 'boolean', short: 'y', default: false },
    apiKey: { type: 'string' },
    projectId: { type: 'string' },
  },
  strict: false,
  allowPositionals: true,
});

const isCI = flags.yes || process.env.CI === 'true';
```

#### Default values for `--yes` mode

When `--yes` is passed, skip all prompts and use:

- `--api-key` flag value OR `LOOP_API_KEY` env var (required — error if missing)
- `--project-id` flag value OR first project returned by the API
- Skip agent environment detection writes (or write all detected ones)
- Skip the "does this look right?" confirm step

```typescript
async function run() {
  if (isCI) {
    const apiKey = flags.apiKey ?? process.env.LOOP_API_KEY;
    if (!apiKey) {
      console.error('--api-key or LOOP_API_KEY env var is required in --yes mode');
      process.exit(1);
    }
    // Proceed without any prompts
    await performSetup({ apiKey, projectId: flags.projectId });
    return;
  }

  // Interactive path
  intro('Loop Connect — connect your project to Loop');
  // ... prompts
}
```

#### Exit codes

- `0` — success
- `1` — general error (user-facing message already printed)
- `2` — usage error (missing required flag in CI mode)

---

### Security Considerations

- **Never log the API key**. The `password()` prompt masks it. After collection, never pass it to `console.log`, `log.info`, or similar.
- **Write to `.env.local`, not `.env`**. `.env.local` is gitignored by default in Vite, Next.js, and most modern frameworks. `.env` is often committed by mistake.
- **Check `.gitignore` and warn** if `.env.local` is not ignored (low-effort safety check).
- **Do not echo the key in the success message.** The `note()` at the end should show `LOOP_API_KEY=loop_***...` (masked).
- **Transmit via HTTPS only.** The validation call must go to `https://`, never `http://`.
- **No key persistence outside of the env file.** Don't store in a config file, home directory dot file, or OS keychain (over-engineered for a one-time setup tool).
- **Minimal permissions request.** The validation call should be to a low-risk endpoint (e.g., `GET /api/projects`) that confirms the key is valid without performing any mutations.

---

### Research Gaps and Limitations

- **OpenHands env var detection**: No documented environment variable that reliably signals "this code is running inside an OpenHands agent session". Filesystem presence of `.openhands/` is the best available signal.
- **Windsurf detection**: No public documentation of Windsurf-specific env vars. `.windsurfrules` file presence is an indirect signal.
- **Bundle size of clack v1.0.1**: The npm install size reported is ~240 kB, but the actual minified bundle size for a CJS build with tsup will be smaller. No reliable bundlephobia data was available at time of research (the tool's dynamic rendering prevented extraction).
- **Cursor `CURSOR_CLI` var reliability**: The `CURSOR_CLI` env var is set in Cursor's integrated terminal but NOT when Claude Code or the user runs the setup script from an external terminal. Filesystem detection is more reliable for the setup CLI use case.

---

## Recommendation

### CLI Framework: @clack/prompts

**Rationale**: Actively maintained, beautiful out-of-the-box, adopted by the exact category of tools this is (create-t3-app, Astro setup CLI). The `group`, `tasks`, and `spinner` APIs map directly to the `loop-connect` flow. The ~240 kB installed size is negligible for an npx tool (users download it once, then it's cached). Its synchronous-only `validate` is a minor inconvenience solved cleanly with the two-phase pattern described above.

**Do not use ink** — too heavy for a linear wizard, slow cold-start.
**Do not use enquirer** — unmaintained.
**Consider @inquirer/prompts as alternative** if async validation inside the prompt is essential and the two-phase approach feels awkward to the team.

---

### Package Structure

```
packages/connect-cli/          (or publish from root as separate package)
├── src/
│   ├── index.ts               # #!/usr/bin/env node entry point
│   ├── cli.ts                 # main run() function, prompt flow
│   ├── detect.ts              # detectAgentEnvironments()
│   ├── env.ts                 # upsertEnvFile(), setEnvVar()
│   ├── config.ts              # upsertJsonConfig(), upsertMarkdownSection()
│   └── api.ts                 # validateApiKey(), fetchProjects()
├── package.json
│   ├── "name": "@dork-labs/loop-connect"
│   ├── "bin": { "loop-connect": "./dist/index.js" }
│   ├── "files": ["dist"]
│   └── "engines": { "node": ">=18" }
└── tsup.config.ts
```

**Build**: `tsup` with CJS output, `shims: true`, shebang via `banner`.

**Dependencies** (runtime only, not devDependencies):

- `@clack/prompts` — prompts
- No others needed; use Node 18+ built-ins (`fetch`, `parseArgs`, `fs`, `path`)

---

### File Write Strategy

1. **`.env.local`**: Upsert pattern — read, parse existing keys, append only missing ones. Never overwrite existing values without confirmation.
2. **`.mcp.json` / JSON configs**: Deep merge pattern — parse, merge, write formatted JSON. Backup malformed files before overwriting.
3. **`CLAUDE.md` / `AGENTS.md`**: Section guard pattern — check for marker comment, append section only if absent.
4. **New files** (e.g., `.cursor/rules/loop.mdc` if `.cursor/` directory doesn't exist): Create parent directories with `fs.mkdirSync(..., { recursive: true })` before writing.

---

### Caveats

- **`loop-connect` as a package name**: The npm scoped name `@dork-labs/loop-connect` should be checked for availability before publishing. The `bin` command `loop-connect` will be what users run via `npx @dork-labs/loop-connect`.
- **Node 18 minimum**: Using the built-in `fetch` and `parseArgs` requires Node 18+. This is a reasonable floor for 2026 but should be documented clearly.
- **`--yes` mode needs the API key**: In CI, the key must come from `--api-key` flag or `LOOP_API_KEY` env var. Failing silently here is worse than erroring loudly.
- **The two-phase validation UX adds a small delay**: After entering the key, users see a spinner for ~500ms. This is intentional and reassuring, not a bug.
- **Re-running is safe**: With the upsert patterns described, running `npx @dork-labs/loop-connect` in an already-configured project will detect existing keys and skip re-writing them. Inform the user with `log.info('Already configured — nothing to change.')` if all keys already exist.

---

## Sources Consulted

- [@clack/prompts npm package](https://www.npmjs.com/package/@clack/prompts)
- [clack README on GitHub](https://github.com/bombshell-dev/clack/blob/main/packages/prompts/README.md)
- [create-t3-app CLI Usage & Options — DeepWiki](https://deepwiki.com/t3-oss/create-t3-app/2.2-cli-usage-and-options)
- [Publishing an npx command to npm — Sandro Maglione](https://www.sandromaglione.com/articles/build-and-publish-an-npx-command-to-npm-with-typescript)
- [Enquirer npm page](https://www.npmjs.com/package/enquirer)
- [Inquirer.js GitHub](https://github.com/SBoudrias/Inquirer.js)
- [ink GitHub](https://github.com/vadimdemedes/ink)
- [Claude Code issue #1279: IDE detection](https://github.com/anthropics/claude-code/issues/1279)
- [CURSOR_CLI env var gist](https://gist.github.com/johnlindquist/9a90c5f1aedef0477c60d0de4171da3f)
- [TERM_PROGRAM vscode detection — VS Code docs](https://code.visualstudio.com/docs/terminal/shell-integration)
- [tsup npm package](https://www.npmjs.com/package/tsup)
- [TypeScript ESM/CJS publishing 2025 — Liran Tal](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing)
- [npm files field best practices](https://github.com/npm/cli/wiki/Files-&-Ignores)
- [bashup/dotenv — idempotent env editing](https://github.com/bashup/dotenv)
- [Snyk npm package best practices](https://snyk.io/blog/best-practices-create-modern-npm-package/)
- [Convex CLI docs](https://docs.convex.dev/cli)
