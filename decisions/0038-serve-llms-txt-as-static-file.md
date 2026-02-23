---
number: 38
title: Serve llms.txt as static file from public directory
status: draft
created: 2026-02-23
spec: marketing-site-agent-integration
superseded-by: null
---

# 38. Serve llms.txt as static file from public directory

## Status

Draft (auto-extracted from spec: marketing-site-agent-integration)

## Context

Loop needs to serve an `llms.txt` file at `https://www.looped.me/llms.txt` following the llmstxt.org specification, so AI agents can discover Loop's API surface and capabilities. The content is stable (API endpoints, documentation links, auth pattern) and changes infrequently. We considered two approaches: a Next.js route handler that generates content dynamically, or a static file in the `public/` directory.

## Decision

Serve `llms.txt` from `apps/web/public/llms.txt` as a static file. Next.js serves files in `public/` directly via CDN with no server-side processing. The content is updated manually when API endpoints or documentation structure changes.

## Consequences

### Positive

- Zero server cost -- served entirely from CDN edge
- Maximum cache efficiency -- CDN caches indefinitely until redeployment
- Simplest possible implementation -- no code, just a text file
- No runtime dependencies or failure modes

### Negative

- Content updates require a code change and redeployment (acceptable given infrequent changes)
- No dynamic content possible (e.g., cannot include real-time API status)
- Must remember to update when API surface changes significantly
