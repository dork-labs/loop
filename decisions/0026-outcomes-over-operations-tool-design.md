---
number: 26
title: Use outcomes-over-operations design for MCP tools
status: proposed
created: 2026-02-22
spec: mcp-server
superseded-by: null
---

# 26. Use outcomes-over-operations design for MCP tools

## Status

Proposed

## Context

The MCP server could expose tools as 1:1 mappings to REST API endpoints (e.g., separate tools for PATCH status, POST comment, GET relations) or as higher-level operations that represent what agents want to accomplish.

## Decision

Design 9 tools around agent intent, not API endpoints. For example, `loop_complete_task` combines three API calls (update status, add comment, check unblocked issues) into one tool. `loop_get_next_task` wraps the atomic dispatch claim with hydrated prompt instructions.

## Consequences

### Positive

- Agents need fewer tool calls to accomplish goals (reduced token usage)
- Tool descriptions are more intuitive for agent reasoning
- Total tool count stays manageable (9 vs potentially 20+)
- Token budget for descriptions stays under 1,000 tokens

### Negative

- Some tools make multiple API calls internally, adding latency
- Less granular control for agents that want individual operations
- Tool behavior is opinionated — may not match every agent's workflow
