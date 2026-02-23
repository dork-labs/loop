---
slug: api-key-dx
number: 10
created: 2026-02-22
status: draft
---

# Tasks: API Key DX — Identifiable Keys, Auto-Generation & Better Errors

**Spec:** specs/api-key-dx/02-specification.md
**Decomposed:** 2026-02-22

---

## Phase 1: Core Key Generation

### Task 1.1: Create `scripts/generate-api-key.js`

**Subject:** [api-key-dx] [P1] Create standalone API key generation script
**Active Form:** Creating standalone API key generation script

Create the file `scripts/generate-api-key.js` with the following exact content:

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

**Key format:** `loop_` + 64-character lowercase hex string (256-bit entropy from `crypto.randomBytes(32)`).

**Verification:**
- Run `node scripts/generate-api-key.js` — generates key, writes to both `.env` files
- Run again — prints skip message (idempotent)
- Run with `--force` — generates new key even when one exists
- Delete `.env` files, run — creates `.env` files with key

---

### Task 1.2: Add `generate-key` script to root `package.json` and integrate into `scripts/setup.sh`

**Subject:** [api-key-dx] [P1] Add generate-key npm script and integrate into setup.sh
**Active Form:** Adding generate-key npm script and integrating into setup.sh
**Depends on:** Task 1.1

**Part A: Root `package.json`**

In `/Users/doriancollier/Keep/dork-os/loop/package.json`, add to the `"scripts"` object:

```json
"generate-key": "node scripts/generate-api-key.js"
```

The full scripts section should become:

```json
"scripts": {
    "dev": "turbo dev",
    "dev:full": "npm run db:dev:up && npm run dev",
    "build": "turbo build",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint",
    "lint:fix": "turbo lint -- --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:dev:up": "docker compose -f docker-compose.dev.yml up -d",
    "db:dev:down": "docker compose -f docker-compose.dev.yml down",
    "db:dev:reset": "docker compose -f docker-compose.dev.yml down -v",
    "generate-key": "node scripts/generate-api-key.js",
    "setup": "bash scripts/setup.sh"
}
```

**Part B: `scripts/setup.sh`**

Insert key generation call after the env file copying section (after line 67, before the Database section). Add these lines between the "Environment Files" block and the "Database" block:

```bash
# ─── API Key ────────────────────────────────────────────────────────────────

echo ""
echo "Generating API key..."
node scripts/generate-api-key.js
```

The insertion point is after this existing code:

```bash
if [ ! -f apps/web/.env ]; then
  cp apps/web/.env.example apps/web/.env
  echo "  Created apps/web/.env"
else
  echo "  apps/web/.env already exists, skipping"
fi
```

And before:

```bash
# ─── Database ────────────────────────────────────────────────────────────────
```

**Verification:**
- `npm run generate-key` works from repo root
- `npm run generate-key -- --force` passes the force flag through
- `npm run setup` (full flow) generates a key after copying env files

---

### Task 1.3: Update `.env.example` files with generation command comments

**Subject:** [api-key-dx] [P1] Update .env.example files with generation command comments
**Active Form:** Updating .env.example files with generation command comments
**Depends on:** Task 1.1

**File: `apps/api/.env.example`**

Change the API key comment and value lines from:

```env
# API authentication — shared dev key (matches apps/app/.env.example)
LOOP_API_KEY=loop-dev-api-key-insecure
```

To:

```env
# API Key — generate a real key with: npm run generate-key
LOOP_API_KEY=loop-dev-api-key-insecure
```

**File: `apps/app/.env.example`**

Change the API key comment and value lines from:

```env
# API key — must match LOOP_API_KEY in apps/api/.env
VITE_LOOP_API_KEY=loop-dev-api-key-insecure
```

To:

```env
# API Key — must match apps/api/.env LOOP_API_KEY
# Generate with: npm run generate-key
VITE_LOOP_API_KEY=loop-dev-api-key-insecure
```

**Verification:**
- Comments in both files mention `npm run generate-key`
- Default dev key value `loop-dev-api-key-insecure` is preserved (non-prefixed intentionally)

---

## Phase 2: Error Messages & FTUE

### Task 2.1: Add `ENV_HINTS` map to `apps/api/src/env.ts`

**Subject:** [api-key-dx] [P2] Add ENV_HINTS to API env.ts for actionable error messages
**Active Form:** Adding ENV_HINTS to API env.ts for actionable error messages
**Depends on:** Task 1.1

**File:** `apps/api/src/env.ts`

Add the `ENV_HINTS` constant after the schema definition (after line 13, before `export type Env`):

```ts
const ENV_HINTS: Record<string, string> = {
  LOOP_API_KEY: [
    'Generate one with:',
    '  node -e "console.log(\'loop_\' + require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    'Or run: npm run setup',
  ].join('\n'),
  DATABASE_URL: 'Run: npm run db:dev:up (starts local PostgreSQL)',
}
```

Then update the error handler in the `else` branch (currently lines 37-44). Replace:

```ts
  const result = apiEnvSchema.safeParse(process.env)

  if (!result.success) {
    console.error('\n  Missing or invalid environment variables:\n')
    result.error.issues.forEach((i) =>
      console.error(`  - ${i.path.join('.')}: ${i.message}`)
    )
    console.error('\n  Copy apps/api/.env.example to apps/api/.env\n')
    process.exit(1)
  }
```

With:

```ts
  const result = apiEnvSchema.safeParse(process.env)

  if (!result.success) {
    console.error('\n  Missing or invalid environment variables:\n')
    result.error.issues.forEach((i) =>
      console.error(`  - ${i.path.join('.')}: ${i.message}`)
    )
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && ENV_HINTS[key]) {
        console.error(`\n  Hint for ${key}:\n  ${ENV_HINTS[key]}`)
      }
    }
    console.error('\n  Copy apps/api/.env.example to apps/api/.env\n')
    process.exit(1)
  }
```

Also update the test defaults (line 26) from `'test-api-key'` to `'loop_test-api-key'`:

```ts
    LOOP_API_KEY: 'loop_test-api-key',
```

**Verification:**
- Delete `LOOP_API_KEY` from `.env`, start API — see hint with generation command
- Delete `DATABASE_URL` from `.env`, start API — see hint about `db:dev:up`
- Existing env.test.ts tests still pass (schema validation unchanged)

---

### Task 2.2: Add `ENV_HINTS` map to `apps/app/src/env.ts`

**Subject:** [api-key-dx] [P2] Add ENV_HINTS to App env.ts for actionable error messages
**Active Form:** Adding ENV_HINTS to App env.ts for actionable error messages
**Depends on:** Task 1.1

**File:** `apps/app/src/env.ts`

Add the `ENV_HINTS` constant after the schema definition (after line 6) and update the error handler. The full file should become:

```ts
import { z } from 'zod'

export const appEnvSchema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:5667'),
  VITE_LOOP_API_KEY: z.string().min(1),
})

const ENV_HINTS: Record<string, string> = {
  VITE_LOOP_API_KEY: [
    'Generate one with:',
    '  node -e "console.log(\'loop_\' + require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    'Or run: npm run setup',
  ].join('\n'),
}

const result = appEnvSchema.safeParse(import.meta.env)

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n')
  result.error.issues.forEach((i: z.ZodIssue) =>
    console.error(`  - ${i.path.join('.')}: ${i.message}`)
  )
  for (const issue of result.error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && ENV_HINTS[key]) {
      console.error(`\n  Hint for ${key}:\n  ${ENV_HINTS[key]}`)
    }
  }
  console.error('\n  Copy apps/app/.env.example to apps/app/.env\n')
  throw new Error('Invalid environment variables')
}

export const env = result.data
export type Env = z.infer<typeof appEnvSchema>
```

**Verification:**
- Delete `VITE_LOOP_API_KEY` from app `.env`, start app — see hint with generation command
- Normal startup with valid env — no changes in behavior

---

### Task 2.3: Fix FTUE masking in `setup-checklist.tsx`

**Subject:** [api-key-dx] [P2] Fix FTUE key masking to show loop_ prefix (slice 0-5)
**Active Form:** Fixing FTUE key masking to show loop_ prefix
**Depends on:** Task 1.1

**File:** `apps/app/src/components/setup-checklist.tsx`

Change line 24 from:

```ts
  const maskedKey = `${apiKey.slice(0, 3)}${'•'.repeat(Math.max(apiKey.length - 3, 8))}`
```

To:

```ts
  const maskedKey = `${apiKey.slice(0, 5)}${'•'.repeat(Math.max(apiKey.length - 5, 8))}`
```

This changes the masking from showing 3 characters (`loo•••`) to 5 characters (`loop_•••`), which preserves the `loop_` prefix visibility. For the non-prefixed dev key `loop-dev-api-key-insecure`, it shows `loop-•••` which is also acceptable.

**Verification:**
- With a `loop_`-prefixed key, FTUE displays `loop_•••••••••`
- With dev key `loop-dev-api-key-insecure`, FTUE displays `loop-•••••••••`
- Toggle show/hide key still works correctly

---

## Phase 3: Docs & Test Consistency

### Task 3.1: Update `docs/self-hosting/environment.mdx`

**Subject:** [api-key-dx] [P3] Update environment docs to use loop_ prefix instead of tok_
**Active Form:** Updating environment docs to use loop_ prefix instead of tok_
**Depends on:** Task 1.1

**File:** `docs/self-hosting/environment.mdx`

Make these replacements throughout the file:

1. Line 53 — Authorization example:
   - From: `Authorization: Bearer tok_your_secret_key_here`
   - To: `Authorization: Bearer loop_your_secret_key_here`

2. Line 63 — Node.js generation command:
   - From: `node -e "console.log('tok_' + require('crypto').randomBytes(32).toString('hex'))"`
   - To: `node -e "console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))"`

3. After the Node.js generation command (line 63), add a new line:
   ```bash
   # Or use the built-in script
   npm run generate-key
   ```

4. Line 100 — App env example:
   - From: `VITE_LOOP_API_KEY=tok_your_secret_key_here`
   - To: `VITE_LOOP_API_KEY=loop_your_secret_key_here`

5. Line 109 — API example env:
   - From: `LOOP_API_KEY=tok_your_secret_key_here`
   - To: `LOOP_API_KEY=loop_your_secret_key_here`

6. Line 121 — Dashboard example env:
   - From: `VITE_LOOP_API_KEY=tok_your_secret_key_here`
   - To: `VITE_LOOP_API_KEY=loop_your_secret_key_here`

**Verification:**
- No remaining `tok_` references in the file
- All examples show `loop_` prefix
- `npm run generate-key` command is documented

---

### Task 3.2: Update test files to use `loop_test-api-key` format

**Subject:** [api-key-dx] [P3] Standardize test files to use loop_test-api-key format
**Active Form:** Standardizing test files to use loop_test-api-key format
**Depends on:** Task 1.1

Update the following files:

**1. `apps/api/src/__tests__/setup.ts` (line 12)**

From:
```ts
process.env.LOOP_API_KEY = process.env.LOOP_API_KEY ?? 'test-api-key'
```

To:
```ts
process.env.LOOP_API_KEY = process.env.LOOP_API_KEY ?? 'loop_test-api-key'
```

**2. `apps/api/src/__tests__/env.test.ts`**

Replace all instances of `'test-key'` with `'loop_test-key'` in the LOOP_API_KEY values. There are 7 occurrences at lines 8, 15, 22, 37, 50, 74, 90. Each looks like:

```ts
LOOP_API_KEY: 'test-key',
```

Change to:

```ts
LOOP_API_KEY: 'loop_test-key',
```

**3. `apps/api/src/__tests__/signals.test.ts` (line 12)**

From:
```ts
const AUTH_HEADER = { Authorization: 'Bearer test-api-key' }
```

To:
```ts
const AUTH_HEADER = { Authorization: 'Bearer loop_test-api-key' }
```

**4. `apps/api/src/__tests__/issues.test.ts` (line 9)**

From:
```ts
const AUTH_HEADER = { Authorization: 'Bearer test-api-key' }
```

To:
```ts
const AUTH_HEADER = { Authorization: 'Bearer loop_test-api-key' }
```

**5. `apps/api/src/__tests__/goals.test.ts` (line 7)**

From:
```ts
const AUTH_HEADER = { Authorization: 'Bearer test-api-key' }
```

To:
```ts
const AUTH_HEADER = { Authorization: 'Bearer loop_test-api-key' }
```

**6. `apps/api/src/__tests__/dispatch.test.ts` (line 19)**

From:
```ts
const AUTH_HEADER = { Authorization: 'Bearer test-api-key' }
```

To:
```ts
const AUTH_HEADER = { Authorization: 'Bearer loop_test-api-key' }
```

**7. `apps/api/src/__tests__/relations.test.ts` (line 10)**

From:
```ts
const AUTH = { Authorization: `Bearer ${process.env.LOOP_API_KEY ?? 'test-api-key'}` }
```

To:
```ts
const AUTH = { Authorization: `Bearer ${process.env.LOOP_API_KEY ?? 'loop_test-api-key'}` }
```

**8. `apps/api/src/__tests__/comments.test.ts` (line 9)**

From:
```ts
const AUTH = { Authorization: `Bearer ${process.env.LOOP_API_KEY ?? 'test-api-key'}` }
```

To:
```ts
const AUTH = { Authorization: `Bearer ${process.env.LOOP_API_KEY ?? 'loop_test-api-key'}` }
```

**9. `apps/api/src/env.ts` (line 26) — test default**

From:
```ts
    LOOP_API_KEY: 'test-api-key',
```

To:
```ts
    LOOP_API_KEY: 'loop_test-api-key',
```

Note: This change is also listed in Task 2.1. If Task 2.1 is completed first, this line will already be updated.

**Verification:**
- Run `npm test` — all tests pass with the updated key format
- `grep -r "test-api-key" apps/` returns no matches (only spec/research files may reference the old format)

---

## Phase 4: Verification

### Task 4.1: Run full test suite and manual verification checklist

**Subject:** [api-key-dx] [P4] Run full test suite and manual verification
**Active Form:** Running full test suite and manual verification
**Depends on:** Tasks 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2

Run the following verification steps:

**Automated:**
```bash
npm test                 # All tests pass
npm run typecheck        # No type errors
npm run lint             # No lint errors
```

**Manual verification checklist:**
- [ ] Fresh clone simulation: delete both `.env` files, run `npm run setup` — both files have matching `loop_`-prefixed key
- [ ] `npm run dev` — no env validation errors
- [ ] Delete `LOOP_API_KEY` from API `.env` → restart → see actionable error with generation command and hint
- [ ] Delete `VITE_LOOP_API_KEY` from app `.env` → restart → see actionable error with hint
- [ ] FTUE checklist shows `loop_•••` instead of `loo•••`
- [ ] `npm run generate-key` — idempotent skip message when key exists
- [ ] `npm run generate-key -- --force` — new key generated, both files updated
- [ ] `docs/self-hosting/environment.mdx` has no remaining `tok_` references
- [ ] All test files use `loop_test-api-key` format — no remaining `test-api-key` references in source

---

## Dependency Graph

```
Task 1.1 (generate-api-key.js)
  ├── Task 1.2 (npm script + setup.sh) ──┐
  ├── Task 1.3 (.env.example comments)    │
  ├── Task 2.1 (API env.ts hints)         │
  ├── Task 2.2 (App env.ts hints)         ├──→ Task 4.1 (verification)
  ├── Task 2.3 (FTUE masking fix)         │
  ├── Task 3.1 (docs update)              │
  └── Task 3.2 (test key consistency) ────┘
```

## Parallel Execution Opportunities

- **Within Phase 1:** Task 1.3 can run in parallel with Task 1.2 (no dependency between them)
- **Phase 2:** All three tasks (2.1, 2.2, 2.3) can run in parallel with each other
- **Phase 3:** Tasks 3.1 and 3.2 can run in parallel with each other
- **Cross-phase:** Phase 2 and Phase 3 tasks can all run in parallel (they only depend on Task 1.1)
- **Phase 4:** Must wait for all other tasks to complete

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| P1    | 3     | Core key generation script, npm integration, env examples |
| P2    | 3     | Actionable error messages (API + App env.ts) and FTUE masking fix |
| P3    | 2     | Documentation and test file consistency |
| P4    | 1     | Full verification |
| **Total** | **9** | |
