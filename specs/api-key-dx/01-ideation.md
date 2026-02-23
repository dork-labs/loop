---
slug: api-key-dx
number: 10
created: 2026-02-22
status: ideation
---

# API Key DX — Identifiable Keys, Auto-Generation & Better Errors

**Slug:** api-key-dx
**Author:** Claude Code
**Date:** 2026-02-22
**Branch:** preflight/api-key-dx
**Related:** specs/agent-integration-strategy.md (Feature 1)

---

## 1) Intent & Assumptions

- **Task brief:** Improve the API key generation and developer experience for Loop. Currently, users must manually create and set `LOOP_API_KEY` in their `.env` files with no guidance on format or generation. We need identifiable keys with a `loop_` prefix, auto-generation during `npm run setup`, actionable Zod startup errors, updated `.env.example` files, and correct display in the FTUE checklist.

- **Assumptions:**
  - The existing `scripts/setup.sh` already handles env file creation by copying `.env.example` files
  - Both `apps/api/.env` and `apps/app/.env` must share the same API key value
  - The FTUE setup checklist already exists and displays the API key with masking
  - Node.js `crypto.randomBytes` is sufficient for key entropy (256-bit)
  - The `loop_` prefix convention follows industry patterns (Stripe `sk_live_`, GitHub `ghp_`)
  - Dev environments use a shared insecure key (`loop-dev-api-key-insecure`) — this is fine for local dev

- **Out of scope:**
  - Multi-key management (multiple API keys per instance)
  - Key rotation UI or automatic rotation
  - OAuth/session-based authentication
  - Hosted key management (Unkey-style)
  - GitHub Secret Scanning Partner Program registration (future work)
  - Key validation endpoint (ping/verify key)

## 2) Pre-reading Log

- `research/20260222_api_key_generation_onboarding_patterns.md`: Comprehensive research on patterns from Stripe, Supabase, Auth.js, Strapi, and Directus. Recommends `loop_` prefix, `crypto.randomBytes(32).toString('hex')`, and improved startup error messages. This is the foundational research document.
- `scripts/setup.sh`: Current setup script — copies `.env.example` to `.env`, starts Docker postgres, runs migrations. Lines 59-60 handle env file creation but do NOT generate keys. Key generation needs to be added here.
- `apps/api/src/env.ts`: Zod-based env validation. Schema on lines 4-13, error output on lines 37-44. Uses `z.string()` for `LOOP_API_KEY` with no format validation. Error message is generic.
- `apps/app/src/env.ts`: Vite app env validation. Schema on lines 3-6, error output on lines 10-16. Validates `VITE_LOOP_API_KEY` as required string.
- `apps/api/.env.example`: Current value `LOOP_API_KEY=loop-dev-api-key-insecure`. No generation command comment.
- `apps/app/.env.example`: Current value `VITE_LOOP_API_KEY=loop-dev-api-key-insecure`. No generation command comment.
- `apps/api/src/middleware/auth.ts`: Bearer token validation using timing-safe comparison. Format-agnostic — will work with `loop_` prefixed keys transparently.
- `apps/app/src/components/setup-checklist.tsx`: FTUE component, line 24 masks key as `apiKey.slice(0, 3) + '•'.repeat(...)`. With `loop_` prefix, this shows "loo•••" which isn't ideal — should show "loop_•••" to communicate the format.
- `apps/app/src/components/setup-code-snippet.tsx`: Multi-language code examples. Fully dynamic — injects `apiKey` prop, no changes needed.
- `apps/app/src/lib/api-client.ts`: ky HTTP client with Bearer token auth. Format-agnostic, no changes needed.
- `docs/self-hosting/environment.mdx`: Lines 53 and 63 show generation commands with `tok_` prefix (outdated). Must be updated to `loop_`.
- `apps/api/src/__tests__/setup.ts`: Line 13 sets default `LOOP_API_KEY` to `'test-api-key'`. Should be updated to `loop_test-api-key` for consistency.
- `apps/api/src/__tests__/env.test.ts`: All test cases use `'test-key'`. Should update to `loop_` prefix format.

## 3) Codebase Map

**Primary Components/Modules:**

- `scripts/setup.sh` — First-run automation script. Core change target: add key generation logic.
- `apps/api/src/env.ts` — API env validation with Zod. Needs improved error messages.
- `apps/app/src/env.ts` — App env validation with Zod. Needs improved error messages.
- `apps/api/.env.example` — API dev defaults. Needs generation command comments.
- `apps/app/.env.example` — App dev defaults. Needs generation command comments.
- `apps/app/src/components/setup-checklist.tsx` — FTUE masking logic (line 24). Needs to show `loop_` prefix.
- `docs/self-hosting/environment.mdx` — Public docs with outdated `tok_` prefix generation commands.

**Shared Dependencies:**

- `apps/api/src/middleware/auth.ts` — Bearer token comparison. Format-agnostic, no changes needed.
- `apps/app/src/lib/api-client.ts` — ky HTTP client. Format-agnostic, no changes needed.
- `apps/app/src/components/setup-code-snippet.tsx` — Code examples. Dynamic, no changes needed.

**Data Flow:**

```
npm run setup
  → scripts/setup.sh
    → [NEW] Generate crypto.randomBytes(32) → hex string → prepend 'loop_'
    → [NEW] Write LOOP_API_KEY=loop_... to apps/api/.env
    → [NEW] Write VITE_LOOP_API_KEY=loop_... to apps/app/.env
    → [EXISTING] Copy other .env.example files
    → [EXISTING] Start Docker postgres + run migrations

npm run dev
  → apps/api/src/env.ts validates LOOP_API_KEY
    → [NEW] If missing: print generation command with loop_ prefix
  → apps/app/src/env.ts validates VITE_LOOP_API_KEY
    → [NEW] If missing: print generation command
  → SetupChecklist reads env.VITE_LOOP_API_KEY
    → [UPDATED] Masks as "loop_•••••" (preserving prefix)
  → SetupCodeSnippet injects full key into curl/JS/Python examples
```

**Feature Flags/Config:**

- `NODE_ENV === 'test'` — gates test-only env in `apps/api/src/env.ts` (line 19). Test setup uses `'test-api-key'` default.
- No feature flags needed for this change — it's a DX improvement, not a feature toggle.

**Potential Blast Radius:**

- **Direct (must change):** 7 files — setup.sh, 2x env.ts, 2x .env.example, setup-checklist.tsx, environment.mdx
- **Indirect (should update):** 4-6 test files that hardcode `'test-api-key'` in Bearer auth headers
- **No change needed:** auth middleware, api-client, setup-code-snippet, CLI api-client

## 4) Root Cause Analysis

N/A — This is a DX improvement, not a bug fix.

## 5) Research

**Research Sources:** Prior research document (`research/20260222_api_key_generation_onboarding_patterns.md`) + new research on API key formats, GitHub secret scanning, and Zod error patterns.

### Potential Solutions

**1. Key Format: `loop_` + 64-character hex string**

- Description: Generate keys as `loop_` + `crypto.randomBytes(32).toString('hex')`, producing keys like `loop_a1b2c3d4e5f6...` (69 chars total).
- Pros:
  - Matches industry standard (GitHub's 2021 token format research showed 0.5% false-positive rate with unique prefix)
  - Hex is regex-friendly: `loop_[a-f0-9]{64}` — clean pattern for GitHub secret scanning
  - Cross-platform compatible (no URL-encoding issues like base64)
  - 256-bit entropy — cryptographically secure
- Cons:
  - Slightly longer than base64url (64 vs 43 chars for same entropy)
- Complexity: Low
- Maintenance: Low

**2. Key Generation: Inline in setup.sh via Node.js one-liner**

- Description: Add a Node.js one-liner in `setup.sh` to generate the key, then use `sed` or `echo` to write it to both `.env` files.
- Pros:
  - Zero new dependencies (Node.js is already required)
  - Single source of truth in setup script
  - Idempotent — detect if key already exists before generating
- Cons:
  - Bash + Node.js mixing is slightly messy
  - Alternative: separate `scripts/generate-api-key.js` file (cleaner, reusable)
- Complexity: Low
- Maintenance: Low

**3. Error Messaging: ENV_HINTS map approach**

- Description: Create an `ENV_HINTS` map that provides contextual error messages per missing env var, rather than relying on Zod's built-in error messages.
- Pros:
  - Separates concerns (schema validation vs. error messaging)
  - Works across Zod v3/v4 without API differences
  - Can include exact generation commands per variable
- Cons:
  - Slightly more code than inline Zod messages
- Complexity: Low
- Maintenance: Low

**4. FTUE Masking: Preserve `loop_` prefix in masked display**

- Description: Update masking from `apiKey.slice(0, 3)` to preserve the full `loop_` prefix, showing `loop_•••••••••` instead of `loo•••••••••`.
- Pros:
  - Communicates key format to users (Stripe shows `sk_live_••••`)
  - Helps users verify they have the right key type
- Cons: None
- Complexity: Trivial
- Maintenance: None

### Recommendation

**Recommended Approach:** Implement all four solutions together as they are complementary and each is low-complexity.

**Key format:** `loop_` + 64-char hex. This is the industry standard pattern validated by GitHub's own research.

**Generation:** Create a standalone `scripts/generate-api-key.js` that the setup script calls. Also expose as `npm run generate-key` for manual key rotation. The script should be idempotent — skip generation if a valid `loop_`-prefixed key already exists.

**Error messaging:** Use the `ENV_HINTS` map pattern in both `env.ts` files. When `LOOP_API_KEY` is missing, print:
```
Missing LOOP_API_KEY. Generate one with:
  node -e "console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))"
Or run: npm run setup
```

**FTUE masking:** Change `apiKey.slice(0, 3)` to `apiKey.slice(0, 5)` to show the full `loop_` prefix in the masked display.

**`.env.example` files:** Use `loop_replace_this_with_npm_run_setup` as the placeholder value — it captures the correct prefix format while being obviously non-real. Add inline comment with generation command.

### Security Considerations

- 256-bit entropy (32 bytes) is cryptographically sufficient for API keys
- The `loop_` prefix does not reduce security — it's public metadata, not part of the secret
- Key reuse across both `.env` files is acceptable for self-hosted deployments
- GitHub Secret Scanning can be configured with custom pattern `loop_[a-f0-9]{64}` to detect leaked keys
- The dev key `loop-dev-api-key-insecure` should remain for local development (not `loop_`-prefixed to avoid confusion with real keys)

### Performance Considerations

- Key generation is a one-time operation during setup — no runtime performance impact
- `crypto.randomBytes` is non-blocking in Node.js — no event loop stalling
- Zod validation happens once at startup — additional error formatting is negligible

## 6) Clarification

1. **Dev key format:** Should the dev key in `.env.example` use the `loop_` prefix (e.g., `loop_0000...insecure`) or stay as `loop-dev-api-key-insecure` (clearly not a real key)? Recommendation: keep the current non-prefixed format to make it obviously not a production key.

2. **Key format validation:** Should `env.ts` validate that `LOOP_API_KEY` starts with `loop_`? This would reject the current dev key format. Recommendation: don't enforce format in validation — just validate it's a non-empty string. The generation command in the error message teaches the correct format.

3. **Standalone generate-key script:** Should we create a separate `scripts/generate-api-key.js` file that's also exposed as `npm run generate-key`, or keep the generation inline in `setup.sh`? Recommendation: separate script (reusable, cleaner, testable).

4. **Test key format:** Should test files be updated to use `loop_test-api-key` format, or is the current `test-api-key` fine since tests don't validate format? Recommendation: update for consistency, but low priority — can be done as part of this work or deferred.
