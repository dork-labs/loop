# NPM Package Quality System — Design

**Date:** 2026-02-24
**Status:** Approved
**Context:** Loop publishes 6 packages to npm. Package pages are missing READMEs, required `package.json` fields, and brand identity. This design introduces a quality system woven into the existing Claude Code harness.

---

## Problem

All 6 published packages are missing some combination of:
- README.md (loop-mcp, loop-cli, loop-connect have none)
- `description` (loop-cli has none)
- `keywords`, `license`, `author`, `homepage`, `repository`, `bugs`, `engines`, `sideEffects` (all packages, varying degrees)

The npm search score (Quality + Popularity + Maintenance) is directly impacted. There is also no single source of truth for which packages are published to npm.

Research findings: `research/20260223_npm_package_best_practices.md`

---

## Design

Five components. All subsequent tooling reads from the manifest — no duplication, no drift.

### Component 1: `npm-packages.json` (Manifest)

**Location:** `npm-packages.json` (repo root)
**Purpose:** Single source of truth for published packages — what to publish, in what order, and their metadata.

```json
{
  "packages": [
    {
      "name": "@dork-labs/loop-types",
      "directory": "packages/types",
      "publishOrder": 1,
      "homepage": "https://www.looped.me/docs/sdk",
      "docs": "https://www.looped.me/docs/sdk"
    },
    {
      "name": "@dork-labs/loop-sdk",
      "directory": "packages/sdk",
      "publishOrder": 2,
      "homepage": "https://www.looped.me/docs/sdk",
      "docs": "https://www.looped.me/docs/sdk"
    },
    {
      "name": "@dork-labs/loop-mcp",
      "directory": "packages/mcp",
      "publishOrder": 3,
      "homepage": "https://www.looped.me/docs/mcp",
      "docs": "https://www.looped.me/docs/mcp"
    },
    {
      "name": "@dork-labs/loop-cli",
      "directory": "apps/cli",
      "publishOrder": 3,
      "homepage": "https://www.looped.me/docs/cli",
      "docs": "https://www.looped.me/docs/cli"
    },
    {
      "name": "@dork-labs/loop-connect",
      "directory": "packages/loop-connect",
      "publishOrder": 3,
      "homepage": "https://www.looped.me/docs/connect",
      "docs": "https://www.looped.me/docs/connect"
    },
    {
      "name": "@dork-labs/loop-skill",
      "directory": "packages/loop-skill",
      "publishOrder": 4,
      "homepage": "https://www.looped.me",
      "docs": "https://www.looped.me/docs"
    }
  ]
}
```

`publishOrder` defines dependency batches. Packages with the same order number publish in parallel. Adding a new npm package = one entry here; all tooling picks it up automatically.

---

### Component 2: Skill — `publishing-npm-packages`

**Location:** `.claude/skills/publishing-npm-packages/SKILL.md`
**Trigger:** "Use when creating or updating README files for Loop npm packages, editing package.json in published packages, preparing packages for release, or auditing package compliance."

**Contents:**
- Required `package.json` fields with Loop-specific defaults pre-filled (repository URL, bugs URL, author, license)
- Badge row template ready to paste (npm version, downloads, CI status, license) using `@dork-labs/*` naming
- Canonical README structure: logo/tagline → badge row → features list → installation (npm + pnpm) → quick start → API reference/link to docs → contributing → license
- Keywords strategy: problem domain (`autonomous`, `improvement-engine`, `loop`, `ai-agent`), technology (`typescript`, `mcp`, `node`), ecosystem (`claude`, `posthog`, `sentry`, `github`)
- Reference to `research/20260223_npm_package_best_practices.md` for detailed rationale
- Instructions to read `npm-packages.json` to find the correct `homepage` and `docs` values per package

---

### Component 3: Rule — `npm-packages.md`

**Location:** `.claude/rules/npm-packages.md`
**Paths:** `packages/*/package.json, apps/*/package.json`

Wide-net glob that fires for any package.json. The rule's **first instruction** is to check `npm-packages.json`. If the current package isn't listed, stop — no checklist applies. If it is listed, apply:

**Required fields:** `description`, `keywords`, `license`, `author`, `homepage`, `repository` (with `directory`), `bugs.url`, `engines.node`, `sideEffects`, `files` (whitelist)
**Required files:** `README.md` and `LICENSE` in the package directory

Links to the `publishing-npm-packages` skill for full README structure. Does not duplicate the skill's content.

**Sync guarantee:** The rule's paths are broad globs that never change. The manifest is the only thing that changes when packages are added/renamed/removed. No drift possible.

---

### Component 4: Command — `/npm:audit`

**Location:** `.claude/commands/npm/audit.md`

Reads `npm-packages.json`, then checks each package:

| Check | Pass condition |
|-------|----------------|
| `description` | Present, 20–160 chars |
| `keywords` | ≥5 items |
| `license` | `"MIT"` |
| `author` | Present |
| `homepage` | Present, `https://` |
| `repository` | Has `type`, `url`, `directory` |
| `bugs.url` | Present |
| `engines.node` | Present |
| `sideEffects` | Explicitly set |
| `README.md` | File exists |
| `LICENSE` | File exists |

Output: pass/fail table (one row per package, one column per check). Summary: "X/6 packages fully compliant."

Auto-fix mode (`/npm:audit fix`): patches the static fields identical across all packages (`license`, `author`, `bugs.url`, `repository`) without touching package-specific fields.

---

### Component 5: `system:release` Integration

Two additions to the existing command:

1. **Pre-flight audit:** Before publishing any package, run the equivalent of `/npm:audit`. Block release if any package fails required-field checks (user can override with explicit confirmation).

2. **Manifest-driven publish order:** Read `npm-packages.json`, group by `publishOrder`, publish each batch. Same-order packages publish in parallel. The command no longer hardcodes package directories.

---

## What Changes

| What | Type | Location | Action |
|------|------|----------|--------|
| `npm-packages.json` | Data | repo root | Create |
| `publishing-npm-packages` skill | Skill | `.claude/skills/` | Create |
| `npm-packages.md` rule | Rule | `.claude/rules/` | Create |
| `/npm:audit` command | Command | `.claude/commands/npm/` | Create |
| `system:release` command | Command | `.claude/commands/system/` | Modify |
| `.claude/README.md` | Docs | `.claude/` | Modify (inventory counts + tables) |

## What Does NOT Change

- Existing package.json files (the audit command and rule will guide fixing them, but that's separate work)
- The research doc (already written, the skill references it)
- CLAUDE.md (the skill/rule/command additions are documented in `.claude/README.md`; not significant enough for CLAUDE.md)

---

## Open Questions (Resolved)

**Q: Should `system:release` use the manifest?**
A: Yes. The manifest becomes operationally authoritative, not just documentation.

**Q: How to prevent manifest/rule drift?**
A: Rule uses wide-glob paths (`packages/*/package.json`). Rule content checks the manifest at runtime. Manifest is the single authority for "is this package published?" No enumeration in the rule.
