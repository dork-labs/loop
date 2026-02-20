---
number: 15
title: Use Commander.js over oclif for the CLI framework
status: draft
created: 2026-02-20
spec: mvp-phase-4-cli-tool
superseded-by: null
---

# 15. Use Commander.js over oclif for the CLI framework

## Status

Draft (auto-extracted from spec: mvp-phase-4-cli-tool)

## Context

The Loop CLI (`looped`) needs a framework for subcommand routing, option parsing, and help generation. The CLI is a thin REST API client with a fixed set of ~15 commands — not a plugin-extensible ecosystem tool.

Candidates evaluated: Commander.js v14, oclif, yargs, citty (UnJS), clipanion (Yarn).

## Decision

Use Commander.js v14 with its functional API. It has 238M weekly npm downloads (1,380x more than oclif), includes TypeScript definitions, and supports modular subcommands via `.addCommand()`. The `extra-typings` import provides type inference on parsed options.

## Consequences

### Positive

- Largest ecosystem — any Node.js developer already knows Commander
- Lightweight — no heavy dependency tree
- Functional API is cleaner than oclif's class-based pattern for a fixed command set
- Built-in TypeScript types (no `@types/` package needed)

### Negative

- No built-in plugin system (not needed for MVP; explicit non-goal)
- Type inference on positional args is weaker than clipanion's compile-time safety
- No auto-generated man pages (oclif provides this)
