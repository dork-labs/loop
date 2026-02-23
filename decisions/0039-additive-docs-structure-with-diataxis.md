---
number: 39
title: Use additive topic-based docs structure with Diátaxis principles
status: draft
created: 2026-02-23
spec: docs-agent-integration
superseded-by: null
---

# 39. Use additive topic-based docs structure with Diátaxis principles

## Status

Draft (auto-extracted from spec: docs-agent-integration)

## Context

Loop's documentation needed to grow from 8 sections covering 2 integration surfaces to 12 sections covering all 7 surfaces (REST API, SDK, CLI, MCP, Agent Skill, Connect CLI, per-agent guides). Four structural approaches were evaluated: full Diátaxis restructure, additive topic-based, surface-first navigation, and tabbed integration guides. Research covered Stripe, Vercel, Supabase, Render, LaunchDarkly, and the Diátaxis framework.

## Decision

Use an additive structure with topic-based navigation at the sidebar level and Diátaxis principles applied within each section. Add 4 new top-level sections (agents/, mcp/, sdk/, skill/) alongside the existing 8. Every page is classified as one Diátaxis type (tutorial, how-to, reference, or explanation) but navigation uses topic names, not quadrant names. This matches the pattern used by every top-tier developer docs site (Stripe, Vercel, Supabase) — developers think "I need SDK docs" not "I need a Reference."

## Consequences

### Positive

- Preserves all existing URLs and user mental models
- Developers find content through topic-based intuition
- Each surface gets a standalone, deep-linkable section
- Can be implemented incrementally (phase by phase)

### Negative

- Sidebar grows from 8 to 12 items, approaching crowded territory
- Some conceptual overlap between "Agents" and "Integrations" sections
- Diátaxis discipline requires ongoing classification effort for new pages
