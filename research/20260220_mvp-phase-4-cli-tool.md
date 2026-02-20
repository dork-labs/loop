# Research: MVP Phase 4 - CLI Tool

**Date:** 2026-02-20
**Feature Slug:** mvp-phase-4-cli-tool
**Research Mode:** Deep Research

---

## Research Summary

Commander.js is the clear choice for this CLI's framework — it dominates the ecosystem with 238M weekly downloads, has excellent TypeScript support, and is the right weight for a REST API wrapper CLI. The stack is rounded out with `picocolors` for colors, `cli-table3` for tables, `@inquirer/prompts` for interactive input, `ky` for HTTP (already in the monorepo), `conf` for config management, and `tsup` for bundling. This combination minimizes dependencies, maximizes TypeScript fidelity, and keeps the CLI publishable via `npx @loop/cli`.

---

## Key Findings

### 1. CLI Framework: Commander.js wins for this use case

Commander.js leads the ecosystem by a massive margin (238M weekly downloads vs. oclif's 173K). For a REST API wrapper CLI with a fixed, known set of subcommands, Commander's lightweight approach is ideal. Oclif is built for plugin-extensible, Salesforce-scale CLIs and brings unnecessary overhead. Clipanion (Yarn's framework) and citty (UnJS) are viable modern alternatives but have smaller communities.

Key data points:
- Commander.js: 238,701,876 weekly downloads, 27,770 GitHub stars, v14.x
- Oclif: 173,236 weekly downloads — 1,380x fewer than Commander
- Yargs: 138M weekly downloads but higher dependency count
- Citty: 0.2.1, ~1.1K stars, zero dependencies, built on Node's native `util.parseArgs`
- Clipanion: Used by Yarn Berry, fully class-based, type-safe, but unfamiliar API shape

**Verdict:** Commander.js v14 with TypeScript. The `commander` package includes its TypeScript definition file. The v14 `extra-typings` import gives full type inference on parsed options.

### 2. Output Libraries: Lean stack wins

**Colors:** `picocolors` over `chalk`.
- picocolors: 7 KB, single file, no dependencies, 14x smaller than chalk, 2x faster
- chalk: 101 KB, ESM-only since v5, feature-rich (RGB, chaining), but overkill for status/priority coloring
- kleur: 21 KB, drop-in chalk replacement, maintained but less popular
- For this CLI's use case (coloring status strings, priority labels), picocolors covers all needed cases

**Tables:** `cli-table3` over `console-table-printer`.
- cli-table3: 3,952 dependent packages, supports cell spanning, custom per-cell styles, word wrapping, vertical alignment
- console-table-printer: Lighter, simpler API, built-in color support, but less adopted
- `tty-table`: Responsive to terminal width, but less maintained
- cli-table3 is the safe choice with the largest community surface area

**Spinners:** `nanospinner` over `ora`.
- nanospinner: 20 KB total, single dependency (picocolors), TypeScript declarations included, CJS + ESM
- ora: 280 KB including sub-dependencies — 14x larger
- For a CLI that primarily wraps API calls, spinner needs are minimal; nanospinner is sufficient

**Interactive Prompts:** `@inquirer/prompts` (the modern Inquirer rewrite).
- The legacy `inquirer` package is no longer actively developed
- `@inquirer/prompts` is the official successor: rewritten from scratch, reduced size, modern API
- `prompts`: Lightweight, promise-based, "most accurate type declarations" per community consensus, actively maintained — a strong alternative
- **Recommendation:** `@inquirer/prompts` for familiarity (Inquirer is the most widely known); fall back to `prompts` if bundle size becomes a concern

### 3. HTTP Client: Use `ky` — already in the monorepo

The `apps/app` package already depends on `ky@^1.14.3`. Choosing `ky` for the CLI maintains consistency and avoids introducing a new HTTP dependency.

- `ky`: Lightweight fetch wrapper (~6 KB), universal (Node + browser), TypeScript-first, convenience methods (`.get()`, `.post()`), automatic JSON parsing, retry support, interceptors via hooks
- `ofetch` (UnJS): Feature-equivalent to ky, adds smart destr-based JSON parsing, built-in retry on 5xx/429, works in Node + browser + workers — equally good, but not yet in the monorepo
- Plain `fetch`: Node 18+ stable, zero deps, but requires manual error handling, JSON parsing, and retry logic
- `undici`: Raw performance (3x faster than axios/got), but lower-level API; overkill for a CLI that makes a handful of API calls

**Verdict:** Use `ky`. It is already in the monorepo as a dependency of `@loop/app`, TypeScript support is first-class, it handles JSON, errors, and retries cleanly, and sharing the same HTTP client across app and CLI is architecturally coherent. Consider creating a shared `packages/api-client` internal package that both `@loop/app` and `@loop/cli` can import.

### 4. Config Management: `conf` for simplicity, env vars for CI

**`conf` (sindresorhus/conf):**
- Version 15.1.0, published actively (last update: ~12 days before research date)
- Stores config as JSON in the system user's config directory
- macOS: `~/Library/Preferences/<name>-nodejs/`
- Linux: `~/.config/<name>/` (XDG_CONFIG_HOME compliant)
- Windows: `%APPDATA%\<name>\`
- JSON Schema validation of stored data
- TypeScript generics for typed config access
- 2,760 npm dependents

**XDG Compliance:** `conf` handles XDG_CONFIG_HOME automatically on Linux. For the Loop CLI, the config directory should be `~/.config/loop/` (Linux/macOS) with the stored file being `config.json`.

**Environment Variable Override Pattern (standard across gh, vercel, railway CLIs):**
```
LOOP_API_URL   — override the API base URL
LOOP_API_TOKEN — override the auth token (used in CI/CD instead of stored config)
```

**Credential Storage Pattern (from gh, vercel, railway):**
- Interactive auth: `loop auth login` prompts for API key and persists via `conf`
- CI/non-interactive: Read `LOOP_API_TOKEN` env var, skip config file lookup
- Precedence: env var > config file > prompt user

**Implementation pattern:**
```typescript
// Config resolution order:
const token =
  process.env.LOOP_API_TOKEN ??
  config.get('token') ??
  await promptForToken()
```

This mirrors how `gh`, `vercel`, and `railway` CLIs all handle credentials — token in config file for interactive sessions, env var for CI.

### 5. CLI Architecture Patterns

**Command Structure (gh CLI pattern):**
```
apps/cli/
  src/
    bin.ts          # shebang + runMain()
    index.ts        # root command definition
    commands/
      issues/
        index.ts    # issues subcommand group
        list.ts
        show.ts
        create.ts
      projects/
        index.ts
        list.ts
      signals/
        ingest.ts
      triage.ts
      auth/
        login.ts
        logout.ts
        status.ts
    lib/
      api-client.ts # shared ky instance, reads config
      config.ts     # conf wrapper
      output.ts     # table, json, plain text renderers
      errors.ts     # typed error classes + handler
    types.ts
```

**Shared API Client Abstraction:**
```typescript
// lib/api-client.ts
import ky from 'ky'
import { getConfig } from './config.js'

export function createApiClient() {
  const { baseUrl, token } = getConfig()
  return ky.create({
    prefixUrl: process.env.LOOP_API_URL ?? baseUrl,
    headers: {
      Authorization: `Bearer ${process.env.LOOP_API_TOKEN ?? token}`,
    },
    retry: { limit: 2, statusCodes: [429, 500, 503] },
  })
}
```

**Output Formatting Pattern:**
- All commands accept `--json` flag (global option on root command)
- Default output: colored table (cli-table3 + picocolors)
- `--json` output: `JSON.stringify(data, null, 2)` piped to stdout
- Error output: always to stderr, never stdout

```typescript
// Pattern for every command's action handler:
if (options.json) {
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
} else {
  renderTable(result)
}
```

**Error Handling Strategy:**
- Network errors: catch ky's `HTTPError`, extract status + body, print user-friendly message to stderr, exit code 1
- Auth errors (401/403): special message suggesting `loop auth login`, exit code 1
- Not found (404): "Not found: issue #abc", exit code 1
- Server errors (5xx): ky retries 2x automatically; if still failing, print "API error" + message, exit code 1
- Config missing: if no token found and not CI, run auth flow or exit with helpful message
- Unhandled: `process.on('uncaughtException')` safety net logs + exits cleanly

**Exit Code Convention:**
- 0: success
- 1: general error (network, API, config)
- 2: usage error (bad arguments) — Commander handles this automatically

### 6. npm/npx Publishing

**package.json `bin` field:**
```json
{
  "name": "@loop/cli",
  "version": "0.1.0",
  "bin": {
    "loop": "./dist/bin.js"
  }
}
```

**Shebang in `src/bin.ts`:**
```typescript
#!/usr/bin/env node
import { runMain } from './index.js'
runMain()
```

tsup automatically preserves the shebang when it detects it at the top of the entry file.

**tsup configuration (`tsup.config.ts`):**
```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/bin.ts'],
  format: ['esm'],    // ESM matches the monorepo's "type": "module"
  target: 'node18',
  clean: true,
  minify: false,      // keep readable for debugging; bundle is small anyway
  sourcemap: true,
  dts: false,         // CLI binary does not need type declarations
})
```

**Installation modes:**
- `npx @loop/cli issues list` — works immediately without install
- `npm install -g @loop/cli && loop issues list` — global install
- `npm install --save-dev @loop/cli` — project-local (for team scripts)

**Turborepo integration:** Add a `build` task in `apps/cli/package.json` that runs `tsup`. Turborepo caches the output in `dist/`. The `turbo.json` already captures `dist/**` as build output, so no config changes needed at the root.

**Publishing note:** The CLI package should NOT be `"private": true` unlike `@loop/api` and `@loop/app`. It needs to be publishable to the npm registry under the `@loop` scope.

### 7. Framework Deep Dive: Why Not oclif, clipanion, or citty?

**oclif:**
- 173K weekly downloads vs Commander's 238M — 1,380x fewer
- Designed for plugin-extensible CLIs (think Heroku's `heroku plugins:install`) — unnecessary for a fixed-command REST wrapper
- Class-based with static properties for args/flags — more boilerplate
- Heavy dependency tree
- Best for: Salesforce, Heroku-scale CLIs with plugin ecosystems

**clipanion:**
- Type-safe by design (used by Yarn Berry), which is its strongest argument
- Class-based: commands extend `Command` base class, define options as class properties
- The type inference is excellent, but the class syntax is unfamiliar compared to Commander's functional API
- Per the Stricli docs: "requiring runtime loading of all commands limits lazy-evaluation performance strategies"
- Best for: projects where compile-time type safety on args is a hard requirement

**citty:**
- Zero dependencies (built on `util.parseArgs`), 100% TypeScript, v0.2.1
- Lightweight and modern — used by Nuxt CLI and other UnJS projects
- Pre-1.0 version signals some API instability risk
- Smaller community (1.1K stars vs Commander's 27.7K)
- Best for: UnJS ecosystem projects, or when zero-dependency is a hard constraint

**Commander.js wins because:**
1. Largest ecosystem and community (27.7K stars, 238M weekly downloads)
2. Included TypeScript types (no separate `@types/` install)
3. v14 `extra-typings` gives strong inference on parsed options
4. Subcommands: `.addCommand()` for modular file-per-command structure
5. Familiar API that any Node.js developer already knows
6. Active maintenance (v14.x released 2024)
7. Used by major CLIs in production

---

## Detailed Analysis

### Monorepo Integration Checklist

The monorepo uses:
- `"type": "module"` at root — the CLI must also use ESM
- npm workspaces — CLI package at `apps/cli/` is automatically included via `apps/*` glob
- Turborepo — `dev`, `build`, `test`, `typecheck`, `lint` tasks will automatically apply to `@loop/cli`
- TypeScript 5 — consistent across all packages
- `ky` already in `apps/app` — use the same version for CLI

The CLI package should share the API response types with the API package. This argues for extracting a `packages/types` or `packages/api-client` internal package, though that can be deferred to a follow-up phase.

### Table Rendering Guidance

For `loop issues list`, a table with these columns:
```
ID    TYPE    TITLE                  STATUS    PRIORITY  CREATED
abc1  bug     Login page crashes     open      high      2d ago
abc2  feat    Add dark mode          backlog   medium    5d ago
```

cli-table3 setup:
```typescript
import Table from 'cli-table3'
import pc from 'picocolors'

const STATUS_COLORS: Record<string, (s: string) => string> = {
  open:      pc.green,
  in_progress: pc.yellow,
  closed:    pc.dim,
  backlog:   pc.cyan,
}

const PRIORITY_COLORS: Record<string, (s: string) => string> = {
  critical:  pc.red,
  high:      pc.yellow,
  medium:    pc.white,
  low:       pc.dim,
}
```

### Config File Schema

```typescript
// ~/.config/loop/config.json (Linux/macOS)
// ~/Library/Preferences/loop-nodejs/config.json (macOS via conf)
interface LoopConfig {
  apiUrl: string      // default: 'https://api.looped.me'
  token: string       // Bearer token
}
```

`conf` with JSON Schema validation catches malformed configs at startup rather than at API call time.

### Auth Flow Design

```
loop auth login
  → prompts: "Enter your API token: " (masked)
  → validates by calling GET /health with the token
  → stores token + apiUrl in conf config
  → prints: "Logged in. Token stored in ~/.config/loop/"

loop auth status
  → reads config
  → calls GET /health
  → prints current apiUrl + masked token

loop auth logout
  → clears config
  → prints: "Logged out."
```

---

## Final Recommendation

| Category | Package | Rationale |
|---|---|---|
| CLI Framework | `commander` v14 | 238M weekly downloads, TypeScript built-in, simple subcommands, active maintenance |
| Colors | `picocolors` | 7 KB, zero deps, 14x smaller than chalk, fast, covers all status/priority coloring needs |
| Table output | `cli-table3` | Widest adoption (3,952 dependents), cell spanning, word wrap, custom styles |
| Spinners | `nanospinner` | 20 KB vs ora's 280 KB, single dep (picocolors), TypeScript types |
| Interactive prompts | `@inquirer/prompts` | Official modern Inquirer rewrite, actively maintained, familiar mental model |
| HTTP client | `ky` | Already in monorepo (`apps/app`), TypeScript-first, handles JSON/errors/retries cleanly |
| Config management | `conf` | v15.1.0, actively maintained, XDG-compliant, JSON Schema validation, typed generics |
| Build tool | `tsup` | Zero-config, esbuild-backed speed, shebang preservation, ESM output, handles `dist/` |

**Dependencies to install in `apps/cli/`:**

Runtime:
```
commander picocolors cli-table3 nanospinner @inquirer/prompts ky conf
```

Dev:
```
tsup @types/node typescript
```

Total runtime dependency count: **7 packages** (plus their transitive deps which are minimal — most are zero-dep or single-dep).

---

## Research Gaps & Limitations

- Shell completion generation (tab completion for `loop <TAB>`) was not researched in depth. Commander supports `.addCompletion()` patterns; this can be added later.
- Windows compatibility of `picocolors` and `nanospinner` was not specifically tested but both are documented as cross-platform.
- The `conf` package stores config in `~/Library/Preferences/` on macOS by default rather than `~/.config/`. If strict XDG compliance on macOS is desired, use `xdg-basedir` + manual JSON file management instead.
- `@inquirer/prompts` migration from legacy `inquirer` was not tested hands-on; the API shape change should be reviewed before implementation.

---

## Contradictions & Disputes

- **TypeScript type safety:** Clipanion proponents argue Commander's types are "bolted on" rather than built in. This is true for complex positional argument inference, but Commander's `extra-typings` path resolves the practical gap for option flags. For the Loop CLI's use case (mostly flags + a single ID argument), Commander's typing is sufficient.
- **Picocolors vs chalk:** Chalk's 24M weekly downloads vs picocolors' smaller footprint — chalk wins on features (RGB, chaining). For the Loop CLI's simple use case (coloring predefined status strings), picocolors is the right call. If the feature set grows, migrating to chalk is trivial.
- **`conf` macOS path:** `conf` does NOT use `~/.loop/config.json` by default. It uses `~/Library/Preferences/loop-nodejs/config.json` on macOS. If the task brief's requirement for `~/.loop/config.json` is a hard constraint, implement config management manually using `node:fs` + `node:os` instead of `conf`.

---

## Search Methodology

- Searches performed: 16
- Most productive terms: "commander.js npm weekly downloads 2025", "conf npm sindresorhus XDG", "citty unjs github", "tsup CLI shebang bin package.json"
- Primary sources: npm trends, GitHub repositories, official documentation, npm package pages
- Key fetch: hackers.pub 2026 TypeScript CLI article, Bloomberg Stricli alternatives page, blog.kilpatrick.cloud CLI packages overview

---

## Sources

- [Commander.js GitHub](https://github.com/tj/commander.js)
- [Commander vs oclif vs yargs - npm trends](https://npmtrends.com/commander-vs-oclif-vs-yargs)
- [Clipanion GitHub](https://github.com/arcanis/clipanion)
- [Building CLI apps with TypeScript in 2026 - hackers.pub](https://hackers.pub/@hongminhee/2026/typescript-cli-2026)
- [Alternatives Considered - Stricli (Bloomberg)](https://bloomberg.github.io/stricli/docs/getting-started/alternatives)
- [Citty - UnJS GitHub](https://github.com/unjs/citty)
- [picocolors GitHub](https://github.com/alexeyraspopov/picocolors)
- [cli-table3 - npm](https://www.npmjs.com/package/cli-table3)
- [console-table-printer - npm](https://www.npmjs.com/package/console-table-printer)
- [nanospinner GitHub](https://github.com/usmanyunusov/nanospinner)
- [ora GitHub](https://github.com/sindresorhus/ora)
- [@inquirer/prompts - npm](https://www.npmjs.com/package/@inquirer/prompts)
- [Inquirer.js GitHub](https://github.com/SBoudrias/Inquirer.js)
- [ofetch - UnJS GitHub](https://github.com/unjs/ofetch)
- [ky - npm (apps/app already uses this)](https://www.npmjs.com/package/ky)
- [conf - GitHub (sindresorhus)](https://github.com/sindresorhus/conf)
- [xdg-basedir - npm](https://www.npmjs.com/package/xdg-basedir)
- [tsup documentation](https://tsup.egoist.dev/)
- [tsup - LogRocket guide](https://blog.logrocket.com/tsup/)
- [Build and publish npx command with TypeScript - Sandro Maglione](https://www.sandromaglione.com/articles/build-and-publish-an-npx-command-to-npm-with-typescript)
- [The Landscape of npm Packages for CLI Apps - blog.kilpatrick.cloud](https://blog.kilpatrick.cloud/posts/node-cli-app-packages/)
- [In-Depth Comparison: Yargs, Commander, Oclif - Oreate AI](https://www.oreateai.com/blog/indepth-comparison-of-cli-frameworks-technical-features-and-application-scenarios-of-yargs-commander-and-oclif/24440ae03bfbae6c4916c403a728f6da)
- [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir/latest/)
- [handle-cli-error - GitHub](https://github.com/ehmicky/handle-cli-error)
