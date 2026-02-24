---
description: Audit npm package compliance — check required fields, files, and README presence across all published packages
argument-hint: '[fix]'
allowed-tools: Read, Glob, Edit, Bash
---

# npm Package Audit

Check compliance for all packages listed in `npm-packages.json`. Displays a pass/fail table with one row per package and one column per check.

## Arguments

- _(no argument)_ — Run compliance checks and display results
- `fix` — Run checks, then auto-fix the static fields that are identical across all packages

---

## Step 1: Read the Manifest

Read `npm-packages.json` from the repo root. Extract the `packages` array — this is the authoritative list of what gets audited.

---

## Step 2: For Each Package, Run Checks

For each package entry, read `{directory}/package.json` and check the following:

| Check | Pass Condition |
|-------|---------------|
| `description` | Present, 20–160 chars |
| `keywords` | Array with ≥5 items |
| `license` | `"MIT"` |
| `author` | `"Dork Labs <hello@dork-labs.com>"` |
| `homepage` | Present and starts with `https://` |
| `repository` | Has `type`, `url`, and `directory` |
| `bugs.url` | Present |
| `engines.node` | Present |
| `sideEffects` | Explicitly set (any value) |
| `README.md` | File exists in package directory |
| `LICENSE` | File exists in package directory |

Store results as a matrix: `results[package_name][check_name] = pass | fail`.

---

## Step 3: Display Dashboard

```
═══════════════════════════════════════════════════════════════════════
                    NPM PACKAGE COMPLIANCE AUDIT
═══════════════════════════════════════════════════════════════════════

Package              desc  kw   lic  auth  home  repo  bugs  eng  side  README  LICENSE
─────────────────────────────────────────────────────────────────────────────────────────
@dork-labs/loop-types  ✅   ✅   ✅   ✅    ✅    ✅    ✅    ✅   ✅    ✅      ✅
@dork-labs/loop-sdk    ✅   ✅   ✅   ✅    ✅    ✅    ✅    ✅   ✅    ✅      ✅
@dork-labs/loop-mcp    ✅   ❌   ❌   ❌    ❌    ❌    ❌    ✅   ❌    ❌      ❌
@dork-labs/loop-cli    ❌   ❌   ❌   ❌    ❌    ❌    ❌    ✅   ❌    ❌      ❌
@dork-labs/loop-connect ✅  ❌   ❌   ❌    ❌    ❌    ❌    ✅   ❌    ❌      ❌
@dork-labs/loop-skill  ✅   ✅   ✅   ❌    ✅    ✅    ❌    ❌   ❌    ✅      ✅

─────────────────────────────────────────────────────────────────────────────────────────
Summary: 2/6 packages fully compliant.

Failing packages need: author, bugs.url, engines.node, keywords, license, sideEffects
Run `/npm:audit fix` to auto-fix static fields (license, author, bugs.url, repository).
═══════════════════════════════════════════════════════════════════════
```

Format rules:
- ✅ = pass, ❌ = fail
- Abbreviate column headers to fit (desc, kw, lic, auth, home, repo, bugs, eng, side, README, LICENSE)
- Summary line: "X/6 packages fully compliant."
- If all pass: show "6/6 packages fully compliant. ✅" and no further suggestions

---

## Step 4: Auto-Fix Mode (only if `fix` argument)

If `$ARGUMENTS` is `fix`, patch the following fields in every failing package's `package.json`. These values are identical across all published packages:

| Field | Value to Set |
|-------|-------------|
| `license` | `"MIT"` |
| `author` | `"Dork Labs <hello@dork-labs.com>"` |
| `bugs` | `{ "url": "https://github.com/dork-labs/loop/issues" }` |
| `repository` | `{ "type": "git", "url": "https://github.com/dork-labs/loop", "directory": "<from manifest>" }` |
| `engines` | `{ "node": ">=18" }` |
| `sideEffects` | `false` |

**Do NOT auto-fix** these package-specific fields — they require human judgment:
- `description` (package-specific copy)
- `keywords` (package-specific terms)
- `homepage` (already in manifest but needs to be verified)
- `README.md` (requires authoring — apply `publishing-npm-packages` skill)
- `LICENSE` (file needs to be created)

After applying fixes, re-run the checks and display the updated dashboard showing what changed.

---

## Edge Cases

- **Package directory not found**: Report "directory not found" in every column for that package
- **package.json parse error**: Report "invalid JSON" for that package
- **Partial repository object**: Fail unless all three sub-fields (`type`, `url`, `directory`) are present
- **`sideEffects: []` (empty array)**: Count as pass — it's explicitly set
