---
paths: packages/*/package.json, apps/*/package.json
---

# npm Package Rules

These rules apply to all `package.json` files in the monorepo. They enforce quality standards for packages published to npm.

## Step 1: Check the Manifest

Read `npm-packages.json` at the repo root. Check if the package being edited appears in the `packages` array by matching the `"name"` field.

**If the package is NOT listed in `npm-packages.json`:** Stop. No further checks apply — this is an internal workspace package, not a published npm package.

**If the package IS listed in `npm-packages.json`:** Continue with the checks below.

## Required Fields

All published packages must have these fields set correctly:

| Field | Required Value |
|-------|---------------|
| `description` | String, 20–160 characters |
| `keywords` | Array with ≥5 items |
| `license` | `"MIT"` |
| `author` | `"Dork Labs <hello@dork-labs.com>"` |
| `homepage` | From `npm-packages.json` `homepage` field for this package |
| `repository.type` | `"git"` |
| `repository.url` | `"https://github.com/dork-labs/loop"` |
| `repository.directory` | From `npm-packages.json` `directory` field for this package |
| `bugs.url` | `"https://github.com/dork-labs/loop/issues"` |
| `engines.node` | `">=18"` |
| `sideEffects` | `false` or an array |

## Required Files

The package directory must contain:

- `README.md` — See the `publishing-npm-packages` skill for the canonical structure and badge templates
- `LICENSE` — MIT license file

## Fixing Violations

When you find a published package is missing fields or files:

1. Apply the `publishing-npm-packages` skill for README structure and badge templates
2. Add the missing `package.json` fields using the values above
3. Look up `homepage` and `directory` from `npm-packages.json` for this specific package

Run `/npm:audit` to see the full compliance status across all published packages.
