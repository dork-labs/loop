---
number: 37
title: Use Shiki web bundle for marketing page code blocks
status: draft
created: 2026-02-23
spec: marketing-site-agent-integration
superseded-by: null
---

# 37. Use Shiki web bundle for marketing page code blocks

## Status

Draft (auto-extracted from spec: marketing-site-agent-integration)

## Context

The marketing site needs tabbed code examples (curl / TypeScript SDK / CLI) on the `/integrations` page. Marketing pages are React components (`'use client'`), not MDX, so Fumadocs' built-in Shiki integration is not available. We need a syntax highlighting approach that works in client components without SSR complexity.

## Decision

Use `shiki/bundle/web` for client-side syntax highlighting in the `CodeTabs` component. This lightweight bundle loads language grammars on demand (~20-50KB per language) and runs entirely client-side via `codeToHtml()`. The highlighted HTML is set via React's innerHTML mechanism after mount. Since all code content is static and authored by us (not user-supplied), there is no XSS risk.

## Consequences

### Positive

- Zero SSR complexity -- no server component wrappers or streaming needed
- On-demand grammar loading keeps initial bundle small
- Shiki is already a dependency (used by Fumadocs for docs pages)
- Consistent highlighting theme across marketing and documentation

### Negative

- Brief flash of unstyled code before Shiki loads on first render
- Client-side highlighting adds ~50-100ms to interactive time per code block
- All code content must be static/authored (never user-supplied) to maintain safety
