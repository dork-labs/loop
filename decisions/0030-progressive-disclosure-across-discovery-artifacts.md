---
number: 30
title: Use progressive disclosure across layered discovery artifacts
status: proposed
created: 2026-02-22
spec: agent-discovery-layer
superseded-by: null
---

# 30. Use progressive disclosure across layered discovery artifacts

## Status

Proposed

## Context

AI agents discover tools through multiple channels with different token budgets and activation patterns. A single monolithic document would either waste tokens (too much context loaded always) or be incomplete (trimmed to fit budgets). The agentskills.io spec recommends progressive disclosure: metadata always loaded (~100 tokens), instructions on activation (<5,000 tokens), references on demand.

## Decision

Layer discovery artifacts with increasing detail levels, each sharing a common content nucleus (API base URL, auth pattern, env var name, issue types, status values). The layers are: SKILL.md description (~150 tokens, always loaded) → SKILL.md body (~2,500 tokens, on activation) → references/api.md (~3,000 tokens, on demand). Parallel artifacts (AGENTS.md, Cursor rules, OpenHands microagent) serve the same nucleus in format-specific wrappers for their respective platforms.

## Consequences

### Positive

- Minimal context window cost when Loop isn't relevant (~150 tokens)
- Full API detail available on demand without loading upfront
- Each platform gets content optimized for its activation pattern and token budget
- Shared content nucleus ensures consistency across all 5 artifacts

### Negative

- Content duplication across artifacts increases maintenance burden
- Content nucleus changes require updating all 5 files
- No automated mechanism to enforce consistency (relies on tests)
