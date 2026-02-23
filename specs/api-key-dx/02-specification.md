---
slug: api-key-dx
number: 10
created: 2026-02-22
status: draft
---

# Specification: API Key DX — Identifiable Keys, Auto-Generation & Better Errors

**Status:** Draft
**Authors:** Claude Code, 2026-02-22
**Ideation:** specs/api-key-dx/01-ideation.md
**Research:** research/20260222_api_key_generation_onboarding_patterns.md

---

## Overview

Improve the Loop API key developer experience by introducing identifiable keys with a `loop_` prefix, auto-generating keys during `npm run setup`, providing actionable Zod startup error messages with generation commands, fixing FTUE key masking to show the prefix, and updating documentation and test files for consistency.

## Background / Problem Statement

Currently, Loop's API key setup has several DX gaps:

1. **No key generation**: Users must manually create keys or use the shared dev placeholder `loop-dev-api-key-insecure`. There is no `npm run setup` step that generates a unique key.
2. **No identifiable format**: Keys have no prefix, making it impossible to distinguish Loop keys from other secrets in logs, configs, or secret scanning tools.
3. **Generic error messages**: When `LOOP_API_KEY` is missing, `env.ts` prints a generic Zod error directing users to `.env.example` — no generation command is provided.
4. **FTUE masking bug**: `setup-checklist.tsx` masks keys as `apiKey.slice(0, 3)` which shows `loo•••` instead of the full `loop_` prefix.
5. **Outdated docs**: `docs/self-hosting/environment.mdx` references a `tok_` prefix that was never implemented.
6. **Inconsistent test keys**: Test files mix hardcoded `'test-api-key'`, `process.env.LOOP_API_KEY`, and fallback patterns.

## Goals

- Auto-generate a cryptographically secure `loop_`-prefixed API key during `npm run setup`
- Provide a standalone `npm run generate-key` command for manual key generation/rotation
- Show actionable error messages with exact generation commands when env vars are missing
- Fix FTUE masking to display `loop_•••••` (preserving the prefix)
- Update all documentation to use `loop_` prefix consistently
- Standardize test files to use `loop_test-api-key` format

## Non-Goals

- Multi-key management (multiple API keys per instance)
- Key rotation UI or automatic rotation
- OAuth/session-based authentication
- Hosted key management (Unkey-style)
- GitHub Secret Scanning Partner Program registration (future work)
- Key validation endpoint (ping/verify key)
- Enforcing `loop_` prefix in env.ts validation (dev key stays non-prefixed)

## Technical Dependencies

- Node.js `crypto` module (built-in, no external dependency)
- Zod (already used in both `env.ts` files)
- No new npm packages required

## Detailed Design

### 1. Key Format

Format: `loop_` + 64-character lowercase hex string

```
loop_a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678
```

- **Prefix**: `loop_` (5 characters)
- **Secret**: 64 hex characters from `crypto.randomBytes(32)`
- **Total length**: 69 characters
- **Entropy**: 256 bits (cryptographically secure)
- **Regex**: `loop_[a-f0-9]{64}`

The dev key `loop-dev-api-key-insecure` remains non-prefixed to make it obviously not a production key. No format validation is enforced in `env.ts` — the key is validated as a non-empty string only.

### 2. Key Generation Script (`scripts/generate-api-key.js`)

New file that:
- Generates a `loop_`-prefixed key using `crypto.randomBytes(32).toString('hex')`
- Writes `LOOP_API_KEY=<key>` to `apps/api/.env`
- Writes `VITE_LOOP_API_KEY=<key>` to `apps/app/.env`
- Is idempotent: skips generation if a `loop_`-prefixed key already exists in both files
- Handles missing `.env` files gracefully (creates them if needed, warns if `.env.example` wasn't copied)
- Outputs the masked key to stdout for confirmation

```js
#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const API_ENV = path.join(__dirname, '..', 'apps', 'api', '.env');
const APP_ENV = path.join(__dirname, '..', 'apps', 'app', '.env');

function readEnvValue(filePath, key) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match ? match[1] : null;
}

function setEnvValue(filePath, key, value) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${key}=${value}\n`);
    return;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    fs.writeFileSync(filePath, content.replace(regex, `${key}=${value}`));
  } else {
    fs.appendFileSync(filePath, `\n${key}=${value}\n`);
  }
}

// Check if valid loop_ key already exists in both files
const apiKey = readEnvValue(API_ENV, 'LOOP_API_KEY');
const appKey = readEnvValue(APP_ENV, 'VITE_LOOP_API_KEY');

if (apiKey?.startsWith('loop_') && appKey?.startsWith('loop_') && apiKey === appKey) {
  console.log(`API key already exists: ${apiKey.slice(0, 10)}...`);
  console.log('Skipping generation. Use --force to regenerate.');
  process.exit(0);
}

// Support --force flag to regenerate
const force = process.argv.includes('--force');
if (!force && apiKey?.startsWith('loop_')) {
  console.log(`API key already exists: ${apiKey.slice(0, 10)}...`);
  console.log('Skipping generation. Use --force to regenerate.');
  process.exit(0);
}

// Generate new key
const secret = crypto.randomBytes(32).toString('hex');
const key = `loop_${secret}`;

setEnvValue(API_ENV, 'LOOP_API_KEY', key);
setEnvValue(APP_ENV, 'VITE_LOOP_API_KEY', key);

console.log(`Generated API key: ${key.slice(0, 10)}...`);
console.log(`Written to:`);
console.log(`  ${API_ENV}`);
console.log(`  ${APP_ENV}`);
```

### 3. Setup Script Integration (`scripts/setup.sh`)

Add key generation call after env file copying, before Docker start:

```bash
# After copying .env files (around line 60)
echo "Generating API key..."
node scripts/generate-api-key.js
```

The existing `.env.example` copy step runs first (providing all other defaults), then the key generation script overwrites the placeholder API key values.

### 4. npm Script (`package.json`)

Add to root `package.json` scripts:

```json
"generate-key": "node scripts/generate-api-key.js"
```

### 5. Error Messaging (`apps/api/src/env.ts` and `apps/app/src/env.ts`)

Add an `ENV_HINTS` map that provides contextual error messages per variable. When Zod validation fails, iterate over errors and append hints.

**API env.ts pattern:**

```ts
const ENV_HINTS: Record<string, string> = {
  LOOP_API_KEY: [
    'Generate one with:',
    '  node -e "console.log(\'loop_\' + require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    'Or run: npm run setup',
  ].join('\n'),
  DATABASE_URL: 'Run: npm run db:dev:up (starts local PostgreSQL)',
};

// In the error handler, after printing the Zod error:
for (const issue of result.error.issues) {
  const key = issue.path[0];
  if (typeof key === 'string' && ENV_HINTS[key]) {
    console.error(`\n  Hint for ${key}:\n  ${ENV_HINTS[key]}`);
  }
}
```

**App env.ts pattern:**

```ts
const ENV_HINTS: Record<string, string> = {
  VITE_LOOP_API_KEY: [
    'Generate one with:',
    '  node -e "console.log(\'loop_\' + require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    'Or run: npm run setup',
  ].join('\n'),
};
```

### 6. FTUE Masking Fix (`apps/app/src/components/setup-checklist.tsx`)

Change line 24 from:

```ts
${apiKey.slice(0, 3)}${'•'.repeat(Math.max(apiKey.length - 3, 8))}
```

To:

```ts
${apiKey.slice(0, 5)}${'•'.repeat(Math.max(apiKey.length - 5, 8))}
```

This shows `loop_•••••••••` for `loop_`-prefixed keys. For the non-prefixed dev key `loop-dev-api-key-insecure`, it shows `loop-•••••••••` which is also fine.

### 7. `.env.example` Updates

**apps/api/.env.example:**

```env
# API Key — generate a real key with: npm run generate-key
LOOP_API_KEY=loop-dev-api-key-insecure
```

**apps/app/.env.example:**

```env
# API Key — must match apps/api/.env LOOP_API_KEY
# Generate with: npm run generate-key
VITE_LOOP_API_KEY=loop-dev-api-key-insecure
```

### 8. Documentation Update (`docs/self-hosting/environment.mdx`)

Replace all `tok_` prefix references with `loop_`:

- `tok_your_secret_key_here` → `loop_your_secret_key_here`
- `'tok_' + require('crypto')...` → `'loop_' + require('crypto')...`
- Add note about `npm run generate-key` command

### 9. Test Key Consistency

**apps/api/src/__tests__/setup.ts** (line 12):

```ts
// Before
process.env.LOOP_API_KEY = process.env.LOOP_API_KEY ?? 'test-api-key';

// After
process.env.LOOP_API_KEY = process.env.LOOP_API_KEY ?? 'loop_test-api-key';
```

**apps/api/src/__tests__/env.test.ts:**

Update all test cases using `'test-key'` to `'loop_test-key'`.

**Test files with hardcoded `'test-api-key'` in Bearer headers:**

The following files hardcode `Bearer test-api-key` and must be updated to `Bearer loop_test-api-key`:
- `apps/api/src/__tests__/signals.test.ts`
- `apps/api/src/__tests__/issues.test.ts`
- `apps/api/src/__tests__/goals.test.ts`
- `apps/api/src/__tests__/dispatch.test.ts`

Files using `Bearer ${process.env.LOOP_API_KEY}` (dynamic) need no changes — they pick up the new default from `setup.ts`.

Files using the fallback pattern `Bearer ${process.env.LOOP_API_KEY ?? 'test-api-key'}` should update the fallback:
- `apps/api/src/__tests__/relations.test.ts`
- `apps/api/src/__tests__/comments.test.ts`

## User Experience

### First-Time Setup Flow

```
$ npm run setup
Installing dependencies...
Copying .env files...
Generating API key...
Generated API key: loop_a1b2c3...
Written to:
  apps/api/.env
  apps/app/.env
Starting PostgreSQL...
Running migrations...

Setup complete! Run npm run dev to start.
```

### Missing Key Error (API)

```
Environment validation failed:

  LOOP_API_KEY: Required

  Hint for LOOP_API_KEY:
  Generate one with:
    node -e "console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))"
  Or run: npm run setup

Copy apps/api/.env.example to apps/api/.env and fill in the values.
```

### FTUE Checklist Display

```
API Key: loop_•••••••••••••••
```

With toggle to reveal full key and copy button.

### Manual Key Generation

```
$ npm run generate-key
Generated API key: loop_a1b2c3...
Written to:
  apps/api/.env
  apps/app/.env

$ npm run generate-key
API key already exists: loop_a1b2c3...
Skipping generation. Use --force to regenerate.

$ npm run generate-key -- --force
Generated API key: loop_f9e8d7...
Written to:
  apps/api/.env
  apps/app/.env
```

## Testing Strategy

### Unit Tests for Key Generation Script

New test file: `scripts/__tests__/generate-api-key.test.ts` (or test via shell assertions in existing test suite)

Tests:
1. **Generates valid key format** — output matches `loop_[a-f0-9]{64}`
2. **Writes to both .env files** — verify both files contain the generated key
3. **Idempotent skip** — when valid key exists, exits without modifying files
4. **Force flag** — `--force` regenerates even when key exists
5. **Creates .env if missing** — generates key even without pre-existing .env file
6. **Preserves other env vars** — existing variables in .env files are not disturbed

### Existing Test Updates

All existing API tests continue to pass with the updated `loop_test-api-key` default. Since auth middleware does timing-safe string comparison (format-agnostic), changing the test key value has no functional impact — it only affects consistency.

### Manual Verification Checklist

- [ ] Fresh clone → `npm run setup` → both .env files have matching `loop_`-prefixed key
- [ ] `npm run dev` → no env validation errors
- [ ] Delete `LOOP_API_KEY` from `.env` → restart → see actionable error with generation command
- [ ] FTUE checklist shows `loop_•••` instead of `loo•••`
- [ ] `npm run generate-key` → idempotent skip message
- [ ] `npm run generate-key -- --force` → new key generated
- [ ] All existing tests pass with updated key format

## Performance Considerations

- Key generation uses `crypto.randomBytes` — non-blocking, runs once during setup
- Zod validation with ENV_HINTS adds negligible overhead at startup (one-time cost)
- No runtime performance impact — all changes are setup/startup time only

## Security Considerations

- 256-bit entropy (32 bytes) is cryptographically sufficient for API keys
- The `loop_` prefix is public metadata, not part of the secret — does not reduce security
- Key reuse across both `.env` files is acceptable for self-hosted deployments (single-instance auth)
- The dev key `loop-dev-api-key-insecure` remains non-prefixed to prevent confusion with production keys
- `scripts/generate-api-key.js` writes to local `.env` files only — no network calls
- GitHub Secret Scanning can use custom pattern `loop_[a-f0-9]{64}` to detect leaked keys (future work)

## Documentation

Files to update:
- `docs/self-hosting/environment.mdx` — Replace `tok_` prefix with `loop_`, add `npm run generate-key` command
- `apps/api/.env.example` — Add generation command comment
- `apps/app/.env.example` — Add generation command comment
- `CLAUDE.md` — No changes needed (already documents `npm run setup` and env structure)

## Implementation Phases

### Phase 1: Core Key Generation

1. Create `scripts/generate-api-key.js` with idempotent key generation
2. Add `generate-key` script to root `package.json`
3. Integrate into `scripts/setup.sh`
4. Update `.env.example` files with generation command comments

### Phase 2: Error Messages & FTUE

5. Add `ENV_HINTS` map to `apps/api/src/env.ts`
6. Add `ENV_HINTS` map to `apps/app/src/env.ts`
7. Fix FTUE masking in `setup-checklist.tsx` (slice 0-5 instead of 0-3)

### Phase 3: Docs & Test Consistency

8. Update `docs/self-hosting/environment.mdx` (replace `tok_` → `loop_`)
9. Update `apps/api/src/__tests__/setup.ts` default key
10. Update `apps/api/src/__tests__/env.test.ts` test values
11. Update hardcoded `test-api-key` in test files (signals, issues, goals, dispatch, relations, comments)

### Phase 4: Verification

12. Run full test suite to confirm no regressions
13. Manual verification of setup flow, error messages, and FTUE display

## Open Questions

No open questions — all decisions were resolved during ideation clarification.

## Related ADRs

- ADR-0020: Use raw Zod safeParse for environment variable validation (`decisions/0020-use-raw-zod-for-env-validation.md`) — the ENV_HINTS pattern extends this existing approach

## References

- Ideation: `specs/api-key-dx/01-ideation.md`
- Research: `research/20260222_api_key_generation_onboarding_patterns.md`
- Agent Integration Strategy: `specs/agent-integration-strategy.md` (Feature 1 — API key as first integration step)
- GitHub token format research (2021): Prefix-based identification reduces false-positive rate to 0.5%
- Industry patterns: Stripe (`sk_live_`), GitHub (`ghp_`), Supabase (`sbp_`)
