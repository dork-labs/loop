---
name: publishing-npm-packages
description: Provides Loop-specific standards for npm package READMEs, package.json fields, keywords, and badges. Use when creating or updating README files for Loop npm packages, editing package.json in published packages, preparing packages for release, or auditing package compliance.
---

# Publishing npm Packages

## Overview

Loop publishes 6 packages to npm under `@dork-labs/`. This skill provides the canonical standards for README structure, package.json fields, badge templates, and keywords. All published packages are listed in `npm-packages.json` at the repo root — read that file to look up per-package `homepage` and `docs` values.

## Step 1: Look Up Package Metadata

Before writing anything, read `npm-packages.json` and find the entry for this package. Note its `homepage` and `docs` values — these are required in `package.json` and the README.

## Required `package.json` Fields

Apply these fields to every published package. Replace `DIRECTORY` and `HOMEPAGE` with the values from `npm-packages.json`:

```json
{
  "description": "One sentence, 20–160 characters, no trailing period",
  "keywords": ["loop", "ai-agent", "autonomous", "improvement-engine", "typescript", "..."],
  "license": "MIT",
  "author": "Dork Labs <hello@dork-labs.com>",
  "homepage": "HOMEPAGE from npm-packages.json",
  "repository": {
    "type": "git",
    "url": "https://github.com/dork-labs/loop",
    "directory": "DIRECTORY from npm-packages.json"
  },
  "bugs": {
    "url": "https://github.com/dork-labs/loop/issues"
  },
  "engines": {
    "node": ">=18"
  },
  "sideEffects": false
}
```

`sideEffects: false` enables tree-shaking. Set to an array if the package has side-effecting files (e.g., CSS imports).

## Keywords Strategy

Use 8–12 keywords mixing these categories:

| Category | Terms |
|----------|-------|
| Problem domain | `autonomous`, `improvement-engine`, `loop`, `ai-agent`, `developer-tools` |
| Technology | `typescript`, `mcp`, `node`, `esm` |
| Ecosystem | `claude`, `posthog`, `sentry`, `github` |
| Package-specific | `cli`, `sdk`, `model-context-protocol`, `connect`, `skill` |

## Badge Row Template

Paste this after the logo/tagline, replacing `PACKAGE_NAME` with the full scoped name (e.g., `@dork-labs/loop-sdk`):

```markdown
[![npm version](https://img.shields.io/npm/v/PACKAGE_NAME.svg)](https://www.npmjs.com/package/PACKAGE_NAME)
[![npm downloads](https://img.shields.io/npm/dm/PACKAGE_NAME.svg)](https://www.npmjs.com/package/PACKAGE_NAME)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
```

## Canonical README Structure

Every published package README must follow this order:

```markdown
# @dork-labs/package-name

> One-line tagline — what this package does

[badge row]

## Features

- Feature 1 (concrete, user-benefit focused)
- Feature 2
- Feature 3

## Installation

\`\`\`bash
npm install @dork-labs/package-name
# or
pnpm add @dork-labs/package-name
\`\`\`

## Quick Start

[Minimal working code example — runnable in under 60 seconds]

## API Reference

[Key exports with types, or link to docs]

See full docs at [DOCS_URL](DOCS_URL).

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
```

### Section Guidance

**Features**: 3–5 bullet points. Focus on what users can *do*, not implementation details.

**Quick Start**: The smallest runnable example. Include `import` statement. Should work copy-paste with zero configuration.

**API Reference**: For SDKs and libraries, document the main exports. For CLIs, show the key commands. For large APIs, include the most important 3–5 items and link to docs.

## Common Pitfalls

- `types` must appear as the **first key** inside each `exports` condition (TypeScript resolution requires this)
- `description` must not end with a period
- `keywords` must be an array, not a comma-separated string
- Do NOT use official brand colors in third-party logos — Loop uses monochrome `#7A756A`

## References

For detailed rationale and scoring analysis, see: `research/20260223_npm_package_best_practices.md`
