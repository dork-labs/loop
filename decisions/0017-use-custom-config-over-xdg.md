---
number: 17
title: Use custom ~/.loop/config.json over XDG-compliant conf package
status: draft
created: 2026-02-20
spec: mvp-phase-4-cli-tool
superseded-by: null
---

# 17. Use custom ~/.loop/config.json over XDG-compliant conf package

## Status

Draft (auto-extracted from spec: mvp-phase-4-cli-tool)

## Context

The CLI needs persistent configuration (API URL and auth token). The `conf` package (sindresorhus) provides XDG-compliant config storage but places files at platform-specific paths (`~/Library/Preferences/loop-nodejs/` on macOS, `~/.config/loop/` on Linux). The user preference is a consistent `~/.loop/config.json` path across all platforms.

## Decision

Implement custom config management using `node:fs` and `node:os` with a fixed path at `~/.loop/config.json`. Config file is created with mode `0o600` for security. Environment variables (`LOOP_API_URL`, `LOOP_API_TOKEN`) override file config.

## Consequences

### Positive

- Predictable path across all platforms — easy to document and debug
- No additional dependency (removes `conf` from the dependency list)
- Simple mental model: one file, one location
- Consistent with the broader DorkOS ecosystem config patterns

### Negative

- Not XDG-compliant on Linux (some users expect `~/.config/`)
- Must handle file I/O, directory creation, and permissions manually
- No JSON Schema validation at config read time (could be added later)
