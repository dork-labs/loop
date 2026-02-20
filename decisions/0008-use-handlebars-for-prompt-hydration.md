---
number: 8
title: Use Handlebars for prompt template hydration
status: proposed
created: 2026-02-20
spec: prompt-dispatch-engine
superseded-by: null
---

# 8. Use Handlebars for prompt template hydration

## Status

Proposed

## Context

Loop needs a templating engine to hydrate prompt templates with issue context before dispatching to agents. Templates are stored in the database as text and rendered at dispatch time. The engine must support conditionals (`#if`), iteration (`#each`), partials, and custom helpers. Templates are authored by trusted humans/agents and stored in the DB — they are not user-submitted input.

Alternatives considered: Mustache (too limited — no helpers, no conditionals beyond truthiness), Nunjucks (more powerful but unnecessary complexity), native template literals (no DB-stored templates, no safe escaping).

## Decision

Use Handlebars (>= 4.6.0) with compiled template caching, registered partials, and `noEscape: true` (prompts are plain text for agents, not HTML). Ban triple-braces `{{{` via content validation. Register a `json` helper for JSONB rendering.

## Consequences

### Positive

- Logic-limited by design — discourages complex template logic, keeps prompts readable
- Widely understood syntax, easy for humans and agents to author
- TypeScript types available (`@types/handlebars`)
- Partials system (`{{> partial_name}}`) enables DRY shared sections across templates
- Prototype pollution protection built-in since v4.6.0

### Negative

- One additional dependency (~70KB)
- `noEscape: true` required since prompts are not HTML — must be careful if templates ever serve HTML contexts
- Compiled template cache must be invalidated when template versions are updated (solved by keying cache on versionId)
