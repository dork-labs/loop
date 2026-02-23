# API Key DX Improvements — Research Findings

**Research Date:** 2026-02-22
**Feature:** api-key-dx
**Research Mode:** Deep Research
**Builds On:** `research/20260222_api_key_generation_onboarding_patterns.md`

---

## Research Summary

This document extends the prior onboarding patterns research with concrete, implementation-ready findings for the five specific improvements in the api-key-dx feature: (1) `loop_` prefix format, (2) auto-generation in `npm run setup`, (3) Zod custom error messages with inline generation commands, (4) `.env.example` improvements, and (5) FTUE checklist key masking. All five improvements have strong industry precedent, can be implemented using only built-in Node.js APIs (no new dependencies), and are mutually reinforcing.

---

## Key Findings

### 1. API Key Prefix: `loop_` Is the Right Choice

**Industry pattern**: Every major API-first company now uses structured prefixes on externally-shared keys. The format `<product>_<random>` is the clear convention:

| Product          | Format                                 | Notes                                     |
| ---------------- | -------------------------------------- | ----------------------------------------- |
| Stripe           | `sk_live_...` / `sk_test_...`          | Underscore separator, environment encoded |
| Supabase (2024+) | `sb_publishable_...` / `sb_secret_...` | Full word prefix                          |
| Resend           | `re_...`                               | Two-letter prefix only                    |
| Anthropic        | `sk-ant-...`                           | Hyphen separator                          |
| Unkey            | `uk_...`                               | Two-letter prefix                         |
| GitHub PAT       | `ghp_...`                              | Two-letter company + one-letter type      |

**Why prefixes matter**:

- GitHub secret scanning can detect a prefixed key with a false-positive rate approaching 0.5% (vs. ~15-40% for unprefixed random strings). The prefix makes the regex `loop_[a-f0-9]{64}` unambiguous.
- Developers can identify at a glance what a string is, even in logs or error messages.
- Secret rotation tools (Doppler, Infisical, 1Password Secrets) can scope their scans by prefix.
- The current `loop-dev-api-key-insecure` value in `.env.example` has no consistent format and looks like a human-typed string, not a generated key.

**Recommendation: `loop_` + 64 hex chars** (see encoding comparison below).

---

### 2. Encoding: Hex vs Base64url vs Nanoid

Three encodings are in common use for the random portion of API keys:

| Encoding              | Command                                        | 32-byte output length | Characters       | Notes                                                                                             |
| --------------------- | ---------------------------------------------- | --------------------- | ---------------- | ------------------------------------------------------------------------------------------------- |
| **Hex**               | `crypto.randomBytes(32).toString('hex')`       | 64 chars              | `[0-9a-f]`       | Unambiguous, no URL-encoding issues, easily regex-matched, universally supported                  |
| **Base64url**         | `crypto.randomBytes(32).toString('base64url')` | 43 chars              | `[A-Za-z0-9\-_]` | 33% shorter, URL-safe, but mixed-case makes regex harder and copy-paste more error-prone          |
| **Base64**            | `crypto.randomBytes(32).toString('base64')`    | 44 chars              | `[A-Za-z0-9+/=]` | `+` and `/` break URLs, `=` padding confuses some parsers — avoid for API keys                    |
| **Nanoid** (21 chars) | `nanoid()`                                     | 21 chars              | `[A-Za-z0-9_-]`  | Requires a dependency, designed for IDs not secrets, 126-bit entropy (sufficient but not 256-bit) |

**Entropy analysis**:

- `crypto.randomBytes(32)` = 256 bits of OS-sourced cryptographic randomness, regardless of encoding.
- Nanoid's default 21-char output = ~126 bits. Sufficient for practical security (equivalent to UUID v4) but lower than the 256-bit standard.
- The encoding is purely cosmetic — all formats carry the same underlying randomness when derived from the same `randomBytes(32)` call.

**Winner: Hex**

- Regex `loop_[a-f0-9]{64}` is clean, unambiguous, and trivially validated.
- No uppercase ambiguity (no confusing `O`/`0`, `I`/`l`).
- All major API docs and secret scanning tools expect hex or alphanumeric; hex is the most universally parseable.
- One-line shell equivalent: `openssl rand -hex 32` — easy to document and cross-reference.
- The prior research document's existing recommendation (`loop_${randomBytes(32).toString('hex')}`) is confirmed as correct.

**Full key format**: `loop_` + 64 hex characters = 69 characters total.

---

### 3. Auto-Generation in `npm run setup`

**Current state**: `scripts/setup.sh` copies `.env.example` to `.env` if `.env` does not already exist (line 59). It does not generate a key — it just copies the placeholder value `loop-dev-api-key-insecure` from `.env.example`.

**Industry precedent for auto-generation**:

- **Auth.js** (`npx auth secret`): Generates crypto-secure random value, writes `AUTH_SECRET=<value>` to `.env.local`. Single command, zero friction.
- **Strapi** (`npx create-strapi-app`): Generates `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `JWT_SECRET` using `crypto.randomBytes` and writes them to `.env` during scaffolding.
- **Medusa** (`npx create-medusa-app`): Auto-generates and injects `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` into the Next.js starter's `.env`.

**The implementation pattern** (from Auth.js, adapted):

```js
// scripts/generate-api-key.js
import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const key = `loop_${randomBytes(32).toString('hex')}`;
const envPath = 'apps/api/.env';

// Read file, replace placeholder line or append
const content = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const updated = content.includes('LOOP_API_KEY=')
  ? content.replace(/^LOOP_API_KEY=.*/m, `LOOP_API_KEY=${key}`)
  : content + `\nLOOP_API_KEY=${key}\n`;

writeFileSync(envPath, updated);
```

**Key design decisions**:

1. **Where to put the generation logic**: The existing `scripts/setup.sh` is bash and already calls `npm install` and `npm run db:dev:up`. The generation could be added as a Node.js script called from the shell script, or the entire setup could be ported to a Node.js script. Given the repo already has Node.js as a requirement and uses `.mjs`/ESM throughout, a separate `scripts/generate-api-key.js` called from `setup.sh` is the cleanest approach.

2. **Idempotency**: The setup script comment says "Idempotent — safe to re-run at any time." Key generation must also be idempotent. The correct behavior: if `LOOP_API_KEY` is already set to a non-placeholder value in `.env`, skip generation. If it's missing, a placeholder, or empty, generate and write.

3. **Placeholder detection**: The current placeholder is `loop-dev-api-key-insecure`. Detection: check if the value starts with `loop_` (the new prefix). If not, it's a placeholder — regenerate.

4. **Both .env files**: `LOOP_API_KEY` must be consistent across `apps/api/.env` (`LOOP_API_KEY`) and `apps/app/.env` (`VITE_LOOP_API_KEY`). The generation script must write the same key to both files atomically.

5. **Console output**: After writing, print the key prominently. The developer needs to know what it is — they may want to use it in curl commands or configure external services. Print it once, clearly, with a reminder that `.env` is gitignored.

**Recommended flow in setup.sh** (additions to existing script):

```bash
# After copying .env.example files, generate the API key
echo ""
echo "Generating API key..."
node scripts/generate-api-key.js
```

---

### 4. Zod Custom Error Messages

**Current state** (`apps/api/src/env.ts` lines 37-43):

```ts
if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i) => console.error(`  - ${i.path.join('.')}: ${i.message}`));
  console.error('\n  Copy apps/api/.env.example to apps/api/.env\n');
  process.exit(1);
}
```

The issue: for `LOOP_API_KEY`, the error prints:

```
  - LOOP_API_KEY: Required
```

This is technically correct but tells the developer nothing about how to fix it.

**Zod's error customization API** (Zod v3):

```ts
// Option A: inline string message
LOOP_API_KEY: z.string().min(1, 'Generate with: node -e "..."');

// Option B: error map function (most powerful — can branch on issue code)
LOOP_API_KEY: z.string({
  error: (iss) =>
    iss.input === undefined
      ? 'LOOP_API_KEY is not set. Run: npm run setup'
      : 'LOOP_API_KEY must be a non-empty string',
});
```

**Zod v4 (2025) note**: Zod v4's error API changed slightly. The `invalid_type_error`/`required_error` shorthand was replaced with a unified `error` param that accepts a string or function. Both work: `z.string({ error: "message" })` or `z.string({ error: (iss) => ... })`. The repo's `zod` version should be checked; the pattern works in both v3 and v4.

**Better approach — per-field hints in the existing error formatter**:

Rather than baking the hint into the Zod schema (which couples the schema to operational concerns), the cleaner approach is to extend the error formatter with a `HINTS` map:

```ts
const ENV_HINTS: Partial<Record<keyof typeof apiEnvSchema.shape, string>> = {
  LOOP_API_KEY:
    "Run: npm run setup  (or: node -e \"console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))\")",
  DATABASE_URL: 'See apps/api/.env.example for the local Docker connection string',
};

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i) => {
    const field = i.path.join('.');
    console.error(`  - ${field}: ${i.message}`);
    const hint = ENV_HINTS[field as keyof typeof ENV_HINTS];
    if (hint) console.error(`    Fix: ${hint}`);
  });
  console.error('\n  See apps/api/.env.example for all required variables.\n');
  process.exit(1);
}
```

This produces:

```
  Missing or invalid environment variables:

  - LOOP_API_KEY: Required
    Fix: Run: npm run setup  (or: node -e "console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))")

  See apps/api/.env.example for all required variables.
```

**Why the `HINTS` map approach over inline Zod messages**:

- Keeps the schema declarative — the schema describes the shape, not the operational runbook.
- Easy to add or update hints without touching validation logic.
- Allows multi-line hints without polluting the Zod chain.
- Separates concerns: schema validity vs. developer guidance.

---

### 5. .env.example Improvements

**Industry standard** (from Inngest, NextAuth, Strapi patterns in prior research):
Every required variable should have:

1. A comment explaining what it is
2. The format it must follow
3. The command to generate it (if generatable)

**Current `apps/api/.env.example`** has inline comments but uses a placeholder value (`loop-dev-api-key-insecure`) instead of leaving the value blank with a generation command.

**Decision: placeholder value vs. empty value**

Two camps exist:

- **Placeholder approach** (current): `LOOP_API_KEY=loop-dev-api-key-insecure` — works immediately for local dev, zero friction, but ships a non-prefixed insecure value.
- **Empty with generation comment**: `LOOP_API_KEY=` with `# Generate with: ...` comment above — forces the developer to run a command, but prevents the insecure placeholder from being used in any environment.

**The right middle ground for Loop**: Ship a well-formatted placeholder that demonstrates the expected format and is visually obviously a placeholder, combined with a generation comment. The setup script then replaces this placeholder with a real key automatically.

```bash
# Bearer token for authenticating API requests (shared with apps/app/.env VITE_LOOP_API_KEY)
# Auto-generated by: npm run setup
# Manual generation: node -e "console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))"
LOOP_API_KEY=loop_replace_this_with_npm_run_setup
```

For the app `.env.example`:

```bash
# API key — must match LOOP_API_KEY in apps/api/.env
# Auto-generated by: npm run setup
VITE_LOOP_API_KEY=loop_replace_this_with_npm_run_setup
```

This approach:

- Makes the format immediately clear (`loop_` prefix visible)
- Makes the placeholder obviously a placeholder (not mistakable for a real key)
- Documents both the automatic path (`npm run setup`) and the manual path
- The Zod `min(1)` validator will still catch it if someone ships the placeholder — but for local dev, after running setup, it becomes a real key

**Webhook secrets**: Keep these commented out with `openssl rand -hex 32` as the generation instruction. These cannot be auto-generated because they must match values configured in external services.

---

### 6. FTUE Checklist Key Masking

**Current state** (`apps/app/src/components/setup-checklist.tsx` line 24):

```ts
const maskedKey = `${apiKey.slice(0, 3)}${'•'.repeat(Math.max(apiKey.length - 3, 8))}`;
```

With the current `loop-dev-api-key-insecure` key:

- Shows first 3 chars: `loo`
- Masks the rest: `loo••••••••`

With the new `loop_<64-hex-chars>` format (69 chars total):

- Shows first 3 chars: `loo` — still doesn't reveal the prefix
- Better would be to show the prefix: `loop_••••••••...••`

**Recommended change**:

```ts
const PREFIX = 'loop_';
const maskedKey = apiKey.startsWith(PREFIX)
  ? `${PREFIX}${'•'.repeat(Math.max(apiKey.length - PREFIX.length, 8))}`
  : `${apiKey.slice(0, 4)}${'•'.repeat(Math.max(apiKey.length - 4, 8))}`;
```

This shows `loop_••••••••••••••` — the prefix is visible (not secret, it's a structural prefix like `sk_live_`), and the random portion is masked. This is consistent with how Stripe masks keys in their dashboard (`sk_live_••••••••••••••••••••••••••••••`).

---

## Potential Solutions

### Solution A: Minimal Viable (Recommended for this feature)

Implement all five changes with zero new dependencies, staying within the existing bash + Node.js toolchain:

1. **Key format**: `loop_${randomBytes(32).toString('hex')}` — 69 chars, hex-encoded.
2. **Setup script**: Add `scripts/generate-api-key.js` (Node.js/ESM), called from `setup.sh`. Writes to both `.env` files. Idempotent.
3. **Zod errors**: Add `ENV_HINTS` map to `apps/api/src/env.ts`. No schema changes — only the error formatter changes.
4. **.env.example**: Replace `loop-dev-api-key-insecure` with `loop_replace_this_with_npm_run_setup` and add generation comments.
5. **FTUE masking**: Update `maskedKey` calculation in `setup-checklist.tsx` to preserve the `loop_` prefix.

**Pros**: No new dependencies, minimal surface area, idempotent, reversible.
**Cons**: The key generation lives in a separate `.js` file from the main `setup.sh`.

### Solution B: Port Setup to Full Node.js Script

Replace `scripts/setup.sh` with `scripts/setup.js` (or `setup.mjs`), handling all setup steps in Node.js including dependency checks, env file generation, Docker operations (via `child_process`).

**Pros**: Single language for tooling, easier to unit-test the generation logic, better cross-platform compatibility (no bash dependency), can use `@clack/prompts` for a rich interactive experience.
**Cons**: Higher scope than this feature, more migration risk, would need to replicate all the bash logic (Docker health check loop, pg_isready wait, etc.).

**Verdict**: Out of scope for api-key-dx. The full port could be a separate spec.

### Solution C: Dedicated CLI Command (`npm run generate-key`)

Add a standalone npm script: `"generate-key": "node scripts/generate-api-key.js"`. This script can be called:

- By `setup.sh` during initial setup
- Independently when rotating the key
- From the error message in `env.ts`

This is slightly better than Solution A because the script is independently usable for key rotation, not only for first-time setup.

**Verdict**: Include this as part of Solution A. The generate-api-key.js script is independently runnable — just also add it as an npm script.

---

## Security Considerations

### Key Entropy

- `crypto.randomBytes(32)` = 256 bits from the OS CSPRNG (`/dev/urandom` on Linux/macOS, `BCryptGenRandom` on Windows). This is the same source used for TLS key generation. It is cryptographically secure.
- 256-bit keys exceed NIST recommendations for symmetric authentication tokens (128-bit minimum). This is more than sufficient.
- The `loop_` prefix consumes 5 characters but does not reduce entropy — the prefix is structural metadata, not part of the secret. The 64-character hex portion always carries 256 bits of randomness.

### Does the Prefix Leak Information?

No. The prefix (`loop_`) identifies:

- The product the key belongs to (Loop)

It does NOT identify:

- Which project the key grants access to
- What permissions the key has
- The key rotation date or version

Stripe, GitHub, and Anthropic all use public prefixes on their keys. The prefix is intentionally public — it's there to help scanners find the key, not to hide information. The security lives entirely in the 64-hex random portion.

### Storage

The key is stored in `.env` (gitignored) on the developer's machine. In production (Vercel), it is stored as an environment variable. Neither location requires hashing — this is a pre-shared symmetric key, not a user password. The Unkey pattern (hash at rest) is appropriate for multi-tenant key management but is overkill for a single-key self-hosted tool.

### Key Reuse Across .env Files

`LOOP_API_KEY` (API server) and `VITE_LOOP_API_KEY` (frontend dashboard) share the same value. This is intentional and correct — the dashboard is the authorized caller of the API. The key is bundled into the Vite frontend build, which means it will appear in the compiled JS output. This is acceptable for a self-hosted tool where:

- The dashboard is only accessible to authorized users of the deployment
- The `.env` file is not committed to git
- The key is rotatable via `npm run generate-key`

It would not be acceptable in a multi-tenant SaaS where the frontend JS is served publicly.

---

## Performance Considerations

- `crypto.randomBytes(32)` is synchronous and completes in microseconds. No async handling needed in a setup script.
- File I/O for writing to two `.env` files is negligible.
- The Zod `ENV_HINTS` map adds a constant-time lookup per validation error — no measurable performance impact on startup.
- Key length (69 chars) has no meaningful performance impact on HTTP header parsing.

---

## Recommendation

Implement **Solution A + Solution C combined**:

### 1. Create `scripts/generate-api-key.js`

```js
#!/usr/bin/env node
// scripts/generate-api-key.js
// Generates a cryptographically secure LOOP_API_KEY and writes it to both
// apps/api/.env and apps/app/.env. Safe to re-run — skips generation if a
// valid loop_-prefixed key already exists.

import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const PLACEHOLDER_PATTERN = /^loop_replace_this/;
const KEY_PREFIX = 'loop_';

function isPlaceholder(value) {
  return !value || PLACEHOLDER_PATTERN.test(value) || !value.startsWith(KEY_PREFIX);
}

function readEnvValue(filePath, varName) {
  if (!existsSync(filePath)) return undefined;
  const content = readFileSync(filePath, 'utf8');
  const match = content.match(new RegExp(`^${varName}=(.*)$`, 'm'));
  return match?.[1]?.trim();
}

function writeEnvVar(filePath, varName, value) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  const updated = content.includes(`${varName}=`)
    ? content.replace(new RegExp(`^${varName}=.*$`, 'm'), `${varName}=${value}`)
    : content + `\n${varName}=${value}\n`;
  writeFileSync(filePath, updated, 'utf8');
}

const apiEnvPath = 'apps/api/.env';
const appEnvPath = 'apps/app/.env';

const existingKey = readEnvValue(apiEnvPath, 'LOOP_API_KEY');

if (!isPlaceholder(existingKey)) {
  console.log('  LOOP_API_KEY already set — skipping generation');
  process.exit(0);
}

const key = `${KEY_PREFIX}${randomBytes(32).toString('hex')}`;

writeEnvVar(apiEnvPath, 'LOOP_API_KEY', key);
writeEnvVar(appEnvPath, 'VITE_LOOP_API_KEY', key);

console.log('');
console.log('  Generated LOOP_API_KEY:');
console.log(`  ${key}`);
console.log('');
console.log('  Written to: apps/api/.env and apps/app/.env');
console.log('  Use this as your Bearer token:');
console.log(`  Authorization: Bearer ${key}`);
console.log('');
```

### 2. Update `package.json` scripts

Add:

```json
"generate-key": "node scripts/generate-api-key.js"
```

### 3. Update `scripts/setup.sh`

Add after the `copy_env` block:

```bash
echo ""
echo "Generating API key..."
node scripts/generate-api-key.js
```

### 4. Update `apps/api/src/env.ts`

Add `ENV_HINTS` map and update the error formatter:

```ts
const ENV_HINTS: Partial<Record<string, string>> = {
  LOOP_API_KEY: 'Run: npm run setup  (or: npm run generate-key)',
  DATABASE_URL: 'See apps/api/.env.example for the local Docker connection string',
};

if (!result.success) {
  console.error('\n  Missing or invalid environment variables:\n');
  result.error.issues.forEach((i) => {
    const field = i.path.join('.');
    console.error(`  - ${field}: ${i.message}`);
    const hint = ENV_HINTS[field];
    if (hint) console.error(`    Fix: ${hint}`);
  });
  console.error('\n  See apps/api/.env.example for all required variables.\n');
  process.exit(1);
}
```

### 5. Update `.env.example` files

`apps/api/.env.example`:

```bash
# Loop API Server
# Run `npm run setup` to auto-generate all secrets and start the database.

# Database — connects to local Docker postgres started by `npm run db:dev:up`
DATABASE_URL=postgresql://loop:loop@localhost:54320/loop

# Bearer token for authenticating API requests (shared with apps/app/.env VITE_LOOP_API_KEY)
# Auto-generated by: npm run setup
# Manual generation:  node -e "console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))"
LOOP_API_KEY=loop_replace_this_with_npm_run_setup

# ─── Webhook Secrets (optional — only needed for integrations) ─────────────────
# Generate with: openssl rand -hex 32
# GITHUB_WEBHOOK_SECRET=
# SENTRY_CLIENT_SECRET=
# POSTHOG_WEBHOOK_SECRET=
```

`apps/app/.env.example`:

```bash
# Loop Dashboard
# Run `npm run setup` to auto-generate all secrets.

# API base URL (defaults to http://localhost:5667 if not set)
VITE_API_URL=http://localhost:5667

# API key — must match LOOP_API_KEY in apps/api/.env
# Auto-generated by: npm run setup
VITE_LOOP_API_KEY=loop_replace_this_with_npm_run_setup
```

### 6. Update `setup-checklist.tsx`

Replace line 24:

```ts
// Before:
const maskedKey = `${apiKey.slice(0, 3)}${'•'.repeat(Math.max(apiKey.length - 3, 8))}`;

// After:
const LOOP_KEY_PREFIX = 'loop_';
const maskedKey = apiKey.startsWith(LOOP_KEY_PREFIX)
  ? `${LOOP_KEY_PREFIX}${'•'.repeat(Math.max(apiKey.length - LOOP_KEY_PREFIX.length, 8))}`
  : `${apiKey.slice(0, 4)}${'•'.repeat(Math.max(apiKey.length - 4, 8))}`;
```

---

## Research Gaps and Limitations

- Did not investigate whether the `loop_[a-f0-9]{64}` pattern should be submitted to GitHub's secret scanning partner program. For an open-source product, this is worth pursuing once the key format is stable — the bar is a uniquely defined prefix, high entropy, and an abuse notification endpoint.
- Did not investigate Zod v4 vs v3 breakage risk. The `ENV_HINTS` approach avoids Zod API differences entirely, but the existing `z.string().min(1)` validators should be checked against the installed Zod version.
- Key rotation UX (what happens when the developer runs `npm run generate-key` after initial setup — they would need to update any external services using the old key) is out of scope for this feature but worth a future spec.

---

## Contradictions and Disputes

- **Placeholder value vs. empty value in .env.example**: There is genuine debate. The Auth.js community moved away from placeholder values toward empty values + generation commands because placeholder values tend to get committed to production (the infamous `your-secret-here` in prod). The counter-argument is that for local dev tools, a working-out-of-the-box experience reduces friction. The compromise (a placeholder that starts with the correct prefix and contains "replace_this") captures both goals: it is immediately recognizable as not-real and demonstrates the expected format.
- **Hex vs base64url**: Both are valid choices. The preference for hex is consistent with the OpenSSL convention (`openssl rand -hex 32`) and makes regex validation unambiguous. Base64url would be equally secure and 33% shorter — teams that prefer shorter keys could reasonably choose it.

---

## Search Methodology

- Searches performed: 8 (plus 4 file fetches)
- Builds on: 18 searches from the prior research document
- Most productive sources: GitHub's InfoQ article on new token format, Zod docs, existing codebase files
- Primary file reads: `apps/api/src/env.ts`, `scripts/setup.sh`, `apps/api/.env.example`, `apps/app/.env.example`, `apps/app/src/components/setup-checklist.tsx`

---

## Sources

- [GitHub Changes Token Format to Improve Identifiability, Secret Scanning, and Entropy — InfoQ](https://www.infoq.com/news/2021/04/github-new-token-format/)
- [Secret Scanning Partner Program — GitHub Docs](https://docs.github.com/code-security/secret-scanning/secret-scanning-partnership-program/secret-scanning-partner-program)
- [Custom Patterns for Secret Scanning — GitHub Docs](https://docs.github.com/en/code-security/secret-scanning/using-advanced-secret-scanning-and-push-protection-features/custom-patterns)
- [Customizing Errors — Zod Docs](https://zod.dev/error-customization)
- [API Keys — Stripe Documentation](https://docs.stripe.com/keys)
- [Understanding API Keys — Supabase Docs](https://supabase.com/docs/guides/api/api-keys)
- [Node.js crypto.randomBytes — Deno/Node Docs](https://docs.deno.com/api/node/crypto/~/randomBytes)
- [What's the Best Approach for Generating Secure API Keys?](https://www.codegenes.net/blog/what-s-the-best-approach-for-generating-a-new-api-key/)
- [bevry/envfile — npm](https://www.npmjs.com/package/envfile)
- [Prior research: API Key Generation, Management, and Onboarding Patterns](./20260222_api_key_generation_onboarding_patterns.md)
