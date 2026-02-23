---
number: 34
title: Use @clack/prompts for the Connect CLI
status: draft
created: 2026-02-23
spec: connect-cli
superseded-by: null
---

# 34. Use @clack/prompts for the Connect CLI

## Status

Draft (auto-extracted from spec: connect-cli)

## Context

The Connect CLI (`npx @dork-labs/loop-connect`) is a linear setup wizard — intro, prompt, validate, select, write, outro. The existing Loop CLI (`apps/cli`) uses `@inquirer/prompts`, but the Connect CLI has different needs: it needs built-in `intro()`/`outro()` framing, a `spinner()` for API validation, `note()` for summary output, and `tasks()` for multi-step progress. These primitives are not available in `@inquirer/prompts` without additional libraries.

## Decision

Use `@clack/prompts` (v1.0+) for the Connect CLI instead of matching the existing CLI's `@inquirer/prompts`. Clack provides all needed primitives (intro, outro, password, select, spinner, confirm, log, note, isCancel) with beautiful defaults out of the box. It is actively maintained (v1.0.1 shipped February 2026), used by create-t3-app and Astro, and has 2.5M weekly downloads.

## Consequences

### Positive

- All UI primitives needed for the setup wizard are built-in — no additional dependencies
- Beautiful, consistent output styling with zero configuration
- `isCancel()` pattern handles Ctrl+C cleanly at every prompt step
- Small dependency footprint for an npx-distributed package

### Negative

- Inconsistency with the existing `apps/cli` which uses `@inquirer/prompts` (tracked in `tasks-for-loop.md` for future unification)
- `validate()` in clack prompts is synchronous — async API key validation requires a separate spinner step after the prompt
