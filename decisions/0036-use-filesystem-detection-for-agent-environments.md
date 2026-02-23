---
number: 36
title: Use filesystem detection for agent environment discovery
status: proposed
created: 2026-02-23
spec: connect-cli
superseded-by: null
---

# 36. Use filesystem detection for agent environment discovery

## Status

Proposed

## Context

The Connect CLI needs to detect which AI agent environments are configured in the user's project to write the appropriate config files (.mcp.json, .cursor/rules/loop.mdc, .openhands/microagents/loop.md, CLAUDE.md). Detection could use environment variables (e.g., `CURSOR_CLI`, `TERM_PROGRAM`) or filesystem presence checks. Research found that environment variables are unreliable — `CURSOR_CLI` causes conflicts, `TERM_PROGRAM=vscode` matches both VS Code and Cursor, and OpenHands has no documented detection env var.

## Decision

Use filesystem presence as the primary detection signal: check for `CLAUDE.md`, `.cursor/` directory, `.openhands/` directory, and `.mcp.json` file. All checks are relative to `process.cwd()`. This approach is deterministic, works regardless of how the CLI is invoked (terminal, CI, agent session), and doesn't depend on undocumented environment variables that may change.

## Consequences

### Positive

- Deterministic and reproducible — same project directory always produces same detection results
- Works in all contexts: interactive terminal, CI/CD, agent sessions, external terminals
- No dependency on undocumented or unstable environment variables
- Easy to test (mock `fs.existsSync`)

### Negative

- Cannot detect agent environments that don't have a project-level config directory (e.g., Windsurf has no reliable filesystem signal yet)
- A user who uses Cursor but hasn't created a `.cursor/` directory won't be detected (acceptable — the directory is created on first Cursor workspace open)
- Doesn't detect the runtime agent platform, only the configured agent artifacts
