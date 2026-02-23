---
number: 23
title: Use loop_ prefix for identifiable API keys
status: proposed
created: 2026-02-22
spec: api-key-dx
superseded-by: null
---

# 23. Use loop_ prefix for identifiable API keys

## Status

Proposed

## Context

Loop API keys are plain strings with no identifiable format. This makes it impossible to distinguish Loop keys from other secrets in logs, configuration files, or secret scanning tools. Industry leaders like Stripe (`sk_live_`), GitHub (`ghp_`), and Supabase (`sbp_`) use prefixed key formats. GitHub's 2021 research showed that unique prefixes reduce secret scanning false-positive rates to 0.5%.

## Decision

Use `loop_` + 64-character lowercase hex string as the standard API key format, generated via `crypto.randomBytes(32).toString('hex')`. The prefix is public metadata (not part of the secret), producing 69-character keys with 256-bit entropy and a clean regex pattern `loop_[a-f0-9]{64}`. Format validation is NOT enforced in env.ts — the dev key `loop-dev-api-key-insecure` remains non-prefixed to clearly distinguish it from production keys.

## Consequences

### Positive

- Keys are instantly recognizable as Loop API keys in logs, configs, and secret scanning
- Enables future GitHub Secret Scanning Partner Program registration with custom pattern
- Cross-platform compatible (hex has no URL-encoding issues unlike base64)
- 256-bit entropy is cryptographically sufficient

### Negative

- Slightly longer than base64url encoding (64 vs 43 characters for same entropy)
- Non-prefixed dev key creates two accepted formats (intentional trade-off for clarity)
