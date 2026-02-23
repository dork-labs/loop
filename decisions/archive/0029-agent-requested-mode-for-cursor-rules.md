---
number: 29
title: Use Agent-Requested mode for Cursor rules over alwaysApply
status: draft
created: 2026-02-22
spec: agent-discovery-layer
superseded-by: null
---

# 29. Use Agent-Requested mode for Cursor rules over alwaysApply

## Status

Draft (auto-extracted from spec: agent-discovery-layer)

## Context

Cursor rules (.mdc files) support three activation modes: `alwaysApply: true` (loaded every prompt), glob-based (loaded when matching files are open), and Agent-Requested (`alwaysApply: false`, no globs — the agent reads the description and decides). Loop's Cursor rule provides API context that's only relevant when the developer is working with Loop's API, not on every keystroke.

## Decision

Use Agent-Requested mode (`alwaysApply: false`, no globs) for the Loop Cursor rule. The description field contains enough context for the agent to decide when Loop API knowledge is relevant. This avoids wasting context window tokens on every prompt when Loop isn't being used.

## Consequences

### Positive

- Zero token cost when the developer isn't working with Loop
- Agent autonomously decides relevance based on the description
- No false positives from glob patterns matching unrelated files

### Negative

- Agent may occasionally fail to activate the rule when it would be helpful
- Relies on Cursor's agent-requested activation working correctly
- Less discoverable than alwaysApply — new users won't see Loop context immediately
