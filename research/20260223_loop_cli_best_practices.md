# Loop CLI — Research Findings

**Date:** 2026-02-23
**Topic:** CLI framework selection, output formatting, config management, testing, and publishing for the `loop` CLI
**Research Mode:** Deep Research
**Searches performed:** 16
**Sources evaluated:** 40+

---

## Research Summary

The existing `apps/cli/` package already establishes strong patterns: commander.js for command routing, picocolors + cli-table3 for formatting, ky for HTTP, and `~/.loop/config.json` for config storage. The research confirms these are sound choices and identifies several enhancements — most importantly, adopting a three-tier output mode (`--plain`, `--json`, human default), migrating config to `~/.config/loop/` per XDG spec, and adding shell completions via omelette. No framework migration is warranted.

---

## Key Findings

### 1. CLI Framework: commander.js is the Right Choice

Commander.js is the dominant TypeScript CLI framework with **198 million weekly downloads** and 114,000+ dependent packages. The existing CLI already uses it correctly. The alternatives all have meaningful drawbacks:

- **oclif** has lazy loading but carries 35+ transitive dependencies and a 747ms typical startup time (302ms of that just for oclif framework overhead in a Salesforce-scale CLI). Far heavier than needed for a focused tool.
- **clipanion** (Yarn's framework) is zero-dependency and type-safe but forces class-based commands and loads all commands at startup.
- **yargs** has poor native TypeScript support, requires plugins, and its API is considered less type-safe.
- **citty** (unjs) is still at v0.2.0, under heavy development, and too immature for production use.
- **cleye** is minimalist and TypeScript-first but has only 165 dependent packages — essentially unproven at scale.

Commander.js supports `gh`-style `resource action [flags]` grammar through nested `.command()` calls, with parent opts accessible via `program.opts()` from within any action handler (the pattern the existing CLI already uses). The main weakness is that global options must be accessed via `program.opts()` rather than being automatically passed to subcommand handlers — the existing pattern of passing `globalOpts` explicitly is the accepted idiom for this.

### 2. Output Formatting: Three-Tier System with picocolors + cli-table3

The existing output.ts establishes the right primitive: a `output(data, opts, renderFn)` dispatcher that routes between JSON and human-rendered modes. The research identifies a needed addition: a `--plain` flag for grep/pipe-friendly plain text (no ANSI escape codes, tab-separated or space-aligned rows).

**Library assessment:**

| Library     | Weekly Downloads | Size                 | Use Case                  |
| ----------- | ---------------- | -------------------- | ------------------------- |
| picocolors  | Very high        | 7 kB, 0.466ms load   | Color and bold text       |
| chalk       | Lower            | 101 kB, 6.167ms load | Same but 14x heavier      |
| cli-table3  | 19.4M            | Moderate             | Bordered table rendering  |
| ink (React) | High             | Large                | Interactive/real-time TUI |
| columnify   | Moderate         | Small                | Simple column formatting  |

**Recommendation:** Keep picocolors + cli-table3. Ink is the right choice only for real-time dashboard UIs (progress bars, spinners, live updates) — overkill for a fire-and-forget dispatch CLI. The `loop next` command is a single-shot output, not a live TUI.

**Three output tiers:**

- **Human (default):** Colored, bordered table via cli-table3. Best for terminals.
- **--plain:** Tab-separated or space-aligned, no ANSI codes. Grep and `awk`-friendly.
- **--json:** Full JSON via `JSON.stringify`. Pipe to `jq` or parse programmatically.

The `gh` CLI implements this same pattern: default human output, `--json` for structured output, and `--jq` / `--template` for further transformation of JSON. The `--plain` tier fills the gap for shell scripting without requiring `jq`.

### 3. Config Location: Migrate from `~/.loop/` to `~/.config/loop/`

The existing config at `~/.loop/config.json` works but violates the XDG Base Directory Specification, which is the standard all modern CLI tools follow:

- `gh` stores config at `~/.config/gh/config.yml`
- Docker, kubectl, and most DevOps CLIs use `~/.config/toolname/`
- The `$XDG_CONFIG_HOME` env var allows users to override the location globally

**Recommended locations:**

- Config: `$XDG_CONFIG_HOME/loop/config.json` (default: `~/.config/loop/config.json`)
- Sensitive credentials stay in this same file but with `chmod 0600` (already implemented)

**Resolution priority (already correct):**

```
CLI flags > LOOP_API_TOKEN / LOOP_API_URL env vars > config file
```

**Format:** Keep JSON. TOML is more human-readable for editing but requires a parser dependency (`@iarna/toml` or `smol-toml`). Given the config is typically set via `loop config set`, not hand-edited, JSON is simpler.

### 4. Shell Completions: Use omelette

Two main options for Node.js shell completions:

- **omelette** — template-based, supports bash/zsh/fish, simple API, active maintenance
- **tabtab** — more complex, supports similar shells, used by pnpm

omelette has the simpler API: define a completion template, bind events for each token, and call `setupShellInitFile()` for one-time installation. It appends a single source line to `~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`.

Suggested integration: `loop completion install` to trigger setup, `loop completion generate --shell zsh` to print the raw script.

### 5. CLI Testing Strategy: Unit + Integration with Vitest

The existing test infrastructure (Vitest + PGlite for API) is the right foundation. For CLI-specific testing:

**Unit testing individual command actions:**

- Mock `createApiClient` to return a ky instance backed by `msw` or simple mock responses
- Test the render functions in isolation (renderIssueTable, etc.) by capturing stdout via `vi.spyOn(process.stdout, 'write')`
- Snapshot test the string output of render functions — Vitest snapshot testing captures `.snap` files in `__snapshots__/` automatically

**Integration testing the CLI binary:**

- Use Node's `child_process.spawn` or `execa` to invoke the built binary with test args
- Assert exit codes and stdout/stderr content
- Use environment variables to point at a mock API server (msw or a test Hono server on a random port)

**Key test patterns for CLI:**

```typescript
// Unit: capture stdout
const writes: string[] = [];
vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
  writes.push(String(chunk));
  return true;
});

// Integration: spawn binary
import { execaSync } from 'execa';
const result = execaSync('node', ['dist/bin.js', 'next', '--json'], {
  env: { LOOP_API_URL: 'http://localhost:4321', LOOP_API_TOKEN: 'test' },
});
expect(JSON.parse(result.stdout)).toMatchSnapshot();
```

### 6. npm Package Publishing

The existing tsup build (`format: ['esm']`, entry `src/bin.ts`) is correct. The `bin` field in `package.json` maps the `loop` command name to the compiled output. Key checklist:

- `#!/usr/bin/env node` shebang must be first line of entry file (already present in `bin.ts`)
- `bin` field: `{ "loop": "./dist/bin.js" }` (or `looped` as currently named)
- `files` field restricts what gets published: `["dist/", "README.md"]`
- Set `"type": "module"` if shipping ESM (required for `.js` imports to work with ESM output)
- Node 18+ minimum is reasonable given the codebase target

**npx usage:** Once published, `npx @dork-labs/looped next` will work without installation. For the `loop` binary name (if publishing as `@dork-labs/loop`), users can run `npx @dork-labs/loop next`.

### 7. `gh` CLI Architecture Patterns Applied to Loop

The `gh` CLI is implemented in Go with Cobra, but its design patterns translate directly:

**Command grammar:** `gh <resource> <action> [flags]` maps to `loop <resource> <action> [flags]`:

- `loop issue list --status todo`
- `loop issue view <id>`
- `loop project list`
- `loop next` (special dispatch command, not `loop dispatch next`)

**Output routing:** gh routes via `--json`, then optionally `--jq` / `--template`. Loop should route via output tier flag checked early in each command.

**Auth:** gh stores tokens in `~/.config/gh/hosts.yaml` with `0600` permissions. Same pattern as the existing `~/.loop/config.json`. The gh team considered OS keychain but found the XDG file approach simpler and sufficient for developer tools.

**Error handling:** gh exits with non-zero codes on error and writes errors to stderr. The existing `withErrorHandler` wrapper is the right approach — it should ensure `process.exit(1)` on API errors while writing error text to `stderr`, not `stdout`.

---

## Detailed Analysis

### Framework Comparison Table

| Framework    | Weekly Downloads | Dependencies   | TypeScript             | Subcommands          | Startup Impact   | Maturity     |
| ------------ | ---------------- | -------------- | ---------------------- | -------------------- | ---------------- | ------------ |
| commander.js | 198M             | 0              | Good (not first-class) | Nested `.command()`  | Minimal          | Very high    |
| yargs        | ~100M            | Many           | Requires plugins       | Good                 | Moderate         | High         |
| oclif        | ~2M              | 35+ transitive | First-class            | Plugin-based         | ~300ms overhead  | High         |
| clipanion    | 2.1M             | 0              | First-class            | Class-based          | All load at init | Medium       |
| citty        | Low              | ~1             | Good                   | Nested defineCommand | Minimal          | Low (v0.2.0) |
| cleye        | Very low         | 0              | First-class            | `.command()`         | Minimal          | Low          |

**Winner for loop CLI:** commander.js — already in use, zero dependencies, massive ecosystem, adequate TypeScript support, proven nested command patterns, and no startup overhead.

### Output Formatter Comparison

**Manual (picocolors + cli-table3) — RECOMMENDED:**

- Full control over layout
- No React runtime overhead
- cli-table3: 19.4M weekly downloads, well-maintained
- picocolors: 7x faster load time vs chalk, functionally identical API subset
- Simple to add `--plain` tier: strip ANSI codes via a `stripAnsi` helper and use tab separators

**Ink (React):**

- Appropriate for: spinners, real-time progress, interactive prompts
- Overkill for fire-and-forget commands
- React reconciler adds startup overhead
- Would be the right choice if `loop next` eventually gets an interactive "claim and start" mode

**cli-table3 alone (no color library):**

- Missing status color coding which aids scannability
- Not recommended — color is important UX for terminal tools

**Custom formatter only (no cli-table3):**

- More work for alignment and wrapping
- cli-table3 handles edge cases (Unicode width, wrapping) that are painful to reimplement

### Config File Strategy

```
~/.config/loop/config.json    (XDG-compliant, mode 0600)
```

vs current:

```
~/.loop/config.json           (non-standard, mode 0600)
```

Migration path: on first run after update, check if `~/.loop/config.json` exists and `~/.config/loop/config.json` does not, then migrate automatically with a one-time message.

### `loop next` Command — Enhanced Design

The existing `looped next` implementation in `dispatch.ts` is solid. For the enhanced `loop next` as the "killer command," the recommended additions are:

1. **Three-tier output:** Add `--plain` to existing `--json` + human modes
2. **`--claim` flag:** `loop next --claim` claims the top issue (sets to in_progress) and returns the full issue context in one call
3. **Exit code signaling:** Exit 0 when items exist, exit 2 when queue is empty (useful for scripting loops)
4. **`--watch` mode (future):** Poll on an interval and print newly queued items — this is where Ink would be appropriate

### Security Considerations

**Credential storage:**

- Current approach (plaintext JSON with `0600` permissions) matches how `gh`, `vercel`, `wrangler` all handle tokens
- OS keychain (via `keytar`) is more secure but adds a native module dependency, complicates cross-platform builds, and breaks in containerized environments
- Recommendation: keep plaintext-with-0600 for v1; `keytar` opt-in for users who want it
- Token is never echoed to stdout unmasked (the existing `maskToken()` function handles this)
- Environment variable `LOOP_API_TOKEN` takes precedence over config file — this is the right pattern for CI environments where tokens should not be in filesystem config

**Config directory:**

- `mkdir` with `{ recursive: true }` before writing (already done)
- Never log token values in error messages or debug output

---

## Potential Solutions

### Solution A: Extend Existing CLI (RECOMMENDED)

Incrementally enhance the existing commander.js + picocolors + cli-table3 CLI:

1. Rename binary from `looped` to `loop` and update package name from `@dork-labs/looped` to `@dork-labs/loop`
2. Add `--plain` output tier to the `output()` dispatcher
3. Migrate config path from `~/.loop/` to `~/.config/loop/` with auto-migration
4. Add `loop completion install` via omelette
5. Add `--claim` flag to `loop next`
6. Improve error handling: ensure errors go to stderr and non-zero exit codes

**Pros:** No breaking changes to architecture, builds on proven patterns, minimal new dependencies
**Cons:** Some tech debt in the binary name change

### Solution B: Rebuild with oclif

Use oclif's code generator and plugin system.

**Pros:** Plugin architecture for extensibility, built-in shell completions, built-in testing helpers
**Cons:** 35+ transitive dependencies, 300ms+ startup overhead documented in Salesforce's own metrics, class-based API requires significant rewrite, overkill for a focused dispatch CLI

### Solution C: Rebuild with clipanion

**Pros:** Zero dependencies, excellent TypeScript inference via decorators
**Cons:** Requires full rewrite to class-based architecture, loads all commands at startup, smaller ecosystem

---

## Recommendation

**Use Solution A.** The existing CLI is well-structured and uses the right primitives. The task is enhancement, not replacement.

**Framework:** Keep commander.js. 198M weekly downloads, zero dependencies, already integrated, supports all required subcommand patterns. The Stricli team's critique that method chaining impedes type safety is valid for very large CLIs but not relevant at Loop's scale.

**Output formatting:** Keep picocolors + cli-table3. Add a `--plain` output tier implemented as a simple ANSI-stripping pass plus tab-separated columns. Reserve Ink for if/when interactive modes are needed (e.g., a `loop next --watch` live-updating queue view).

**Config location:** Migrate to `$XDG_CONFIG_HOME/loop/config.json` (default `~/.config/loop/config.json`). Add auto-migration logic. Keep JSON format (no new parser dependency).

**Shell completions:** Add `omelette` as a dependency. Implement `loop completion install` and `loop completion generate --shell <bash|zsh|fish>`.

**Testing:**

- Unit tests: `vi.spyOn(process.stdout, 'write')` for render function output capture; snapshot tests for table output strings
- Integration tests: `execa` to spawn the built binary; `msw` for API mocking; env vars for config injection
- No new test framework needed — Vitest is sufficient

**Security:** Keep plaintext config with `0600` permissions. Document that `LOOP_API_TOKEN` env var is the preferred approach for CI/CD environments.

**Publishing:** Package as `@dork-labs/loop` with `bin: { "loop": "./dist/bin.js" }`. Ship ESM only (tsup already configured correctly). Node 18+ minimum.

---

## Research Gaps and Limitations

- No direct benchmark data for commander.js vs citty startup time at the same command count (citty claims mri-based parsing is faster, but the project is too immature to evaluate)
- The Stricli framework (Bloomberg's internal CLI framework, now open source) was identified in research but not deeply evaluated — it may be worth a future look for highly type-safe CLIs
- Shell completion behavior differences between omelette and oclif's built-in completions were not directly compared

---

## Contradictions and Disputes

- **oclif performance claims vs reality:** oclif documentation claims "only 35 dependencies" and "large CLIs load as fast as small ones" via lazy loading. However, their own performance profiling shows 302ms of oclif overhead for Salesforce CLI. This is acceptable for Salesforce's complexity but not the right tradeoff for Loop.
- **Config location:** The existing `~/.loop/config.json` is a reasonable pragmatic choice (simpler, users know where it is). The XDG path is more "correct" but introduces a breaking change. This tradeoff should be a deliberate decision rather than an automatic migration.

---

## Sources and Evidence

- [commander.js npm page](https://www.npmjs.com/package/commander) — 198M weekly downloads, v14.0.3
- [clipanion npm page](https://www.npmjs.com/package/clipanion) — 2.1M weekly downloads
- [Stricli alternatives comparison](https://bloomberg.github.io/stricli/docs/getting-started/alternatives) — detailed critique of method-chaining frameworks
- [oclif performance docs](https://oclif.io/docs/performance/) — Salesforce CLI: 747ms total, 302ms oclif overhead
- [picocolors vs chalk benchmark](https://github.com/alexeyraspopov/picocolors) — picocolors 7kB/0.466ms vs chalk 101kB/6.167ms
- [cli-table3 vs table npm comparison](https://npm-compare.com/cli-table,cli-table3,console-table-printer,table,text-table) — cli-table3 at 19.4M weekly downloads
- [gh CLI formatting docs](https://cli.github.com/manual/gh_help_formatting) — --json, --jq, --template output modes
- [gh config token storage](https://github.com/cli/cli/issues/7757) — stored in ~/.config/gh/hosts.yaml
- [XDG Base Directory spec](https://specifications.freedesktop.org/basedir/latest/) — $XDG_CONFIG_HOME default is $HOME/.config
- [omelette npm](https://github.com/f/omelette) — template-based shell completion for bash/zsh/fish
- [Vercel CLI command routing](https://deepwiki.com/vercel/vercel/3.1-cli-commands) — centralized Map-based registry with alias resolution
- [citty unjs](https://github.com/unjs/citty) — v0.2.0, under heavy development

---

## Search Methodology

- Searches performed: 16
- Most productive search terms: "TypeScript CLI framework comparison commander yargs oclif clipanion 2025", "gh CLI architecture command grammar output formatting", "oclif framework startup time lazy loading performance", "XDG base directory spec CLI config best practice"
- Primary information sources: npm package pages, official framework docs, GitHub repos, npm-compare.com, Bloomberg Stricli docs
