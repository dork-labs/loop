---
number: 24
title: Use ENV_HINTS map for actionable environment variable errors
status: draft
created: 2026-02-22
spec: api-key-dx
superseded-by: null
---

# 24. Use ENV_HINTS map for actionable environment variable errors

## Status

Draft (auto-extracted from spec: api-key-dx)

## Context

When environment variables are missing, Zod validation errors print generic messages that direct users to `.env.example`. This provides no actionable guidance — users still need to figure out how to generate values like API keys or database URLs. The existing raw Zod safeParse approach (ADR-0020) handles validation but not developer guidance.

## Decision

Add an `ENV_HINTS` record in each `env.ts` file that maps variable names to contextual help strings. When Zod validation fails, iterate over errors and append matching hints with exact generation commands or setup instructions. This separates validation logic (Zod schema) from developer guidance (hints map), keeping both maintainable independently.

## Consequences

### Positive

- Missing env vars produce actionable copy-pasteable commands
- Separates concerns: schema validation vs. error messaging
- Works across Zod v3/v4 without API differences
- Each env var can have its own tailored help text

### Negative

- Slightly more code than inline Zod error messages
- Hints must be kept in sync with schema changes manually
