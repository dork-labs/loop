---
number: 28
title: Use content-only npm package for agent discovery artifacts
status: proposed
created: 2026-02-22
spec: agent-discovery-layer
superseded-by: null
---

# 28. Use content-only npm package for agent discovery artifacts

## Status

Proposed

## Context

The agent discovery layer ships 5 artifacts (SKILL.md, AGENTS.md, Cursor rules, OpenHands microagent, and an API reference). These are pure markdown/content files with no executable code. We needed to decide how to package and distribute them — as a standard npm package with build steps, as raw hosted files, or as a content-only npm package.

## Decision

Ship `@dork-labs/loop` as a content-only npm package with no `main`, `bin`, or `exports` fields. The `files` array explicitly lists `SKILL.md`, `references/`, `templates/`, and `README.md`. No build step is needed — the package publishes raw markdown files directly. The `openskills` installer looks for `SKILL.md` at the package root.

## Consequences

### Positive

- Zero runtime dependencies — installs instantly (~50KB)
- No build configuration complexity (no tsup, no bundler)
- Compatible with `npx openskills install` which expects SKILL.md at package root
- Easy to maintain — edit markdown, publish, done

### Negative

- Unconventional npm package structure may confuse contributors expecting executable code
- No programmatic API — consumers can only read files, not import functions
- Version bumps for content changes feel heavyweight compared to updating hosted files
