# Environment Variable Validation Libraries for TypeScript Monorepos

**Date:** 2026-02-21
**Scope:** Focused Investigation — env validation for a monorepo with Hono API (Node.js), Vite React SPA (`import.meta.env`), and Next.js marketing site (`process.env`)
**Depth:** Focused Investigation (10 tool calls)

---

## Research Summary

The TypeScript ecosystem has consolidated around two dominant patterns for env validation in 2025-2026: **t3-env (`@t3-oss/env-core`)** for teams that want a purpose-built, framework-aware solution, and **rolling your own with Zod** for teams that want zero additional dependencies and full control. For this specific monorepo — Hono API + Vite SPA + Next.js site, all already using Zod — the roll-your-own Zod pattern is the pragmatic winner. t3-env is a close second if the client/server variable separation enforcement is worth the dependency.

---

## Key Findings

### 1. t3-env is the community standard, but it has real friction with Vite SSR

t3-env (`@t3-oss/env-core`) is the most-used dedicated env validation library in the TypeScript ecosystem with ~497,000 weekly downloads. Its `extends` property for monorepo sharing and built-in `clientPrefix` enforcement for server/client separation are genuinely useful. However, using it with Vite requires manually wiring `runtimeEnv` to `import.meta.env`, and there is a known caveat: during SSR or build-time config evaluation, `import.meta.env` is not yet populated, requiring a fallback to `process.env` or Vite's `loadEnv`. This creates friction in a monorepo where one app is pure Vite SPA and another is Hono on Node.

### 2. Zod is already in the project — rolling your own costs almost nothing

The API (`apps/api`) already depends on Zod v4. The app (`apps/app`) already depends on Zod v3. Rolling a custom `env.ts` per app using `z.object().parse()` adds zero dependencies, is fully portable, and is trivially understandable by any engineer. The only things you give up vs. t3-env are: (a) the automatic enforcement that `VITE_`-prefixed variables are on the right side of the server/client boundary, and (b) the `extends` composability across packages. Both can be compensated for with conventions and a lint rule.

### 3. envalid is for Node.js only — it does not fit Vite apps

envalid is a Node.js library with ~447,000 weekly downloads. It uses its own built-in validators (`str()`, `bool()`, `num()`) rather than Zod, provides immutable output via Proxy, and exits the process on validation failure (Node.js behavior). It has no concept of `import.meta.env`, no client/server separation, and no framework presets. It is appropriate for pure server-side Node.js projects (the Hono API in isolation), but it is wrong for a monorepo that also has Vite frontend apps. Adding envalid alongside Zod (which is already in the project for request validation) would be adding a second validation tool for no gain.

### 4. znv is too small and pre-v1.0

znv (387 GitHub stars) is a lightweight Zod wrapper that adds smart coercion for env vars (correctly coerces the string `"false"` to `false`, unlike Zod's built-in coerce). It is a good idea, but it is pre-v1.0 with explicitly unstable API guarantees. Not suitable for production tooling that will be maintained across multiple apps in a monorepo.

### 5. Valibot offers a bundle size advantage that does not matter here

Valibot (1.4KB after tree-shaking vs. Zod's 12.1KB) offers the best bundle efficiency. t3-env now supports Valibot via Standard Schema v1. This is compelling for edge functions where cold start size matters. The Loop API runs on Vercel Functions where startup time matters, but Zod is already a hard dependency for request validation via `@hono/zod-validator` and Drizzle schema types — so switching to Valibot solely for env validation would save zero bytes in practice.

### 6. Standard Schema v1 is the 2025 interop story

t3-env now supports any Standard Schema v1 compliant library (Zod ≥3.24 or v4, Valibot ≥1.0, ArkType ≥2.1, Typia). This means there is no long-term lock-in with t3-env — you can switch your validator without changing your env wiring.

---

## Detailed Analysis

### @t3-oss/env-core

**How it works:**

```typescript
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    LOOP_API_KEY: z.string().min(1),
  },
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: z.string().url(),
  },
  // For Node.js apps:
  runtimeEnv: process.env,
  // For Vite apps: runtimeEnv: import.meta.env (but only at runtime, not during build)
});
```

**Monorepo support via `extends`:**

```typescript
// packages/shared-env/env.ts
export const sharedEnv = createEnv({
  server: { NODE_ENV: z.enum(['development', 'test', 'production']) },
  runtimeEnv: process.env,
});

// apps/api/env.ts
import { sharedEnv } from '@loop/shared-env/env';
export const env = createEnv({
  server: { DATABASE_URL: z.string().url() },
  runtimeEnv: process.env,
  extends: [sharedEnv],
});
```

**Vite caveat:** For a Vite SPA (apps/app), the recommended `runtimeEnv` is `import.meta.env`. This works at runtime. But the client/server enforcement only prevents server-only vars from being accessed in client code via TypeScript — it does not add runtime overhead. The Vite preset (`@t3-oss/env-core/presets-valibot` or similar) handles the `VITE_` prefix automatically.

```typescript
// For apps/app (Vite):
export const env = createEnv({
  clientPrefix: 'VITE_',
  client: {
    VITE_API_URL: z.string().url().optional(),
    VITE_LOOP_API_KEY: z.string().min(1),
  },
  runtimeEnv: import.meta.env,
  // No server vars — this is a pure SPA
});
```

**Known pain point:** GitHub issue #177 ("Support both process.env and import.meta.env") and issue #228 ("Using shared variables with no clientPrefix") show that mixing both env sources in a monorepo shared config is awkward. Each app effectively needs its own env file even with `extends`.

**Verdict for Loop:** t3-env would work, but adds a dependency and API complexity for a benefit (client/server enforcement) that only matters at the SPA boundary — and the SPA has no server vars to protect anyway since it's a pure frontend.

---

### Rolling Your Own with Zod

**How it works:**

```typescript
// apps/api/src/env.ts
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  LOOP_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4242),
  // Webhook secrets — optional, validated when present
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  POSTHOG_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof schema>;
```

```typescript
// apps/app/src/env.ts
import { z } from 'zod';

const schema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:4242'),
  VITE_LOOP_API_KEY: z.string().min(1),
});

const parsed = schema.safeParse(import.meta.env);
if (!parsed.success) {
  console.error('Missing required environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
export type Env = z.infer<typeof schema>;
```

**Coercion note:** Zod's `z.coerce.number()` calls `Number()` on the value before validating, which correctly handles string env vars. For booleans, use a transform: `z.string().transform(v => v === "true")` since `z.coerce.boolean()` is too permissive (treats any non-empty string as `true`).

**What you lose vs. t3-env:**

- No automatic enforcement that server vars don't leak to client (enforced by convention instead)
- No `extends` composability (shared vars require manual duplication or a shared schema object)
- No warning if a var is defined in schema but missing from `runtimeEnv` during Vite bundling (the `runtimeEnvStrict` feature of t3-env)

**What you gain:**

- Zero additional dependencies
- Works identically across Node.js (`process.env`) and Vite (`import.meta.env`) with one-line change
- No ESM-only restrictions or module resolution complexity
- Fully debuggable — it's just Zod you already know

---

### envalid

```typescript
import { cleanEnv, str, url, port } from 'envalid';

export const env = cleanEnv(process.env, {
  DATABASE_URL: url(),
  LOOP_API_KEY: str(),
  PORT: port({ default: 4242 }),
});
```

**Pros:**

- Built-in validators for common types including `port()`, `email()`, `host()`
- Clean, readable DSL
- Immutable output (Proxy-wrapped)
- Very mature (1.5k GitHub stars, v8.1.0, actively maintained)
- Exits process cleanly on validation failure with human-readable error

**Cons:**

- Node.js only — no `import.meta.env` support
- Own validator DSL (not Zod/Valibot) — redundant in a project already using Zod
- No client/server separation concept
- No monorepo sharing primitive
- Would need to be used alongside Zod (which is already in the project), not instead of it

**Verdict for Loop:** Inappropriate. The Loop API already uses Zod for all request validation. Adding envalid means two separate validation libraries doing different things. The only scenario where envalid makes sense is a pure Node.js project with no existing Zod dependency.

---

### znv

```typescript
import { parseEnv, z, port } from 'znv';

export const env = parseEnv(process.env, {
  DATABASE_URL: z.string().url(),
  PORT: port().default(4242),
  DEBUG: z.boolean().default(false), // correctly coerces "false" -> false
});
```

**Pros:**

- Zero additional dependencies (re-exports Zod's `z`)
- Correct boolean coercion (fixes Zod's `coerce.boolean` footgun)
- Nice `port()` helper
- Aggregates all errors rather than throwing on the first

**Cons:**

- 387 GitHub stars — very low adoption
- Pre-v1.0, explicitly unstable API
- No Vite/`import.meta.env` support built in
- Last meaningful release was 0.5.0 (limited maintenance activity)
- No monorepo support
- Node.js centric

**Verdict for Loop:** Interesting, but too immature and too Node-centric. The boolean coercion fix it provides can be replicated with a 3-line Zod transform.

---

### Valibot-based alternatives

**env-valibot** (GitHub: Enalmada/env-valibot) is a community project inspired by t3-env that uses Valibot instead of Zod. It has very limited adoption and is primarily interesting if you are already using Valibot exclusively. Since Loop uses Zod throughout (request validation, Drizzle schema, TanStack Router), there is no reason to introduce Valibot for env validation.

**t3-env with Valibot:** If you wanted smaller bundle sizes on the Vite SPA, you could use `@t3-oss/env-core` with Valibot via the `presets-valibot` export. But again — Zod is already bundled in `apps/app` (it's a direct dependency for TanStack Router's Zod adapter), so switching validator libraries for env specifically saves nothing.

---

## Community Adoption Data (February 2026)

| Library            | Weekly Downloads | GitHub Stars | Latest Version | Status       |
| ------------------ | ---------------- | ------------ | -------------- | ------------ |
| `@t3-oss/env-core` | ~497,000         | ~5,000+      | 0.13.10        | Active       |
| `envalid`          | ~447,000         | ~1,500       | 8.1.1          | Active       |
| `zod` (direct)     | ~25M+            | ~35,000+     | 3.x / 4.x      | Active       |
| `znv`              | Low (<5k est.)   | 387          | 0.5.0          | Low activity |
| `env-valibot`      | Negligible       | <100         | Pre-release    | Experimental |

Note: Zod used directly is the most common approach in raw numbers since Zod has 25M+ weekly downloads and most teams use it for env validation without a wrapper library.

---

## Bundle Size Analysis

| Library          | Minified+Gzipped       | Notes                                  |
| ---------------- | ---------------------- | -------------------------------------- |
| Zod v3           | ~12.1KB                | Already in all three apps              |
| Zod v4           | ~8KB (est.)            | Smaller than v3, already in API        |
| Valibot v1       | ~1.4KB                 | Best for bundle-sensitive environments |
| envalid          | ~4KB                   | Own validators, no Zod                 |
| @t3-oss/env-core | ~2KB (excl. validator) | Thin wrapper, validator cost separate  |
| znv              | ~1KB (excl. Zod)       | Zod still required                     |

For the Vite SPA, bundle size matters at the margins. Since Zod is already included as a direct `apps/app` dependency, any env validation that uses Zod adds zero marginal bundle cost.

---

## Recommendation for Loop

### Decision: Roll your own with Zod

**Rationale:**

1. **Zero new dependencies.** Zod is already in `apps/api` (v4, `zod: "^4.3.6"`) and `apps/app` (v3, `zod: "^3.25.76"`). Using it for env validation is free.

2. **Already the right tool for the job.** The API uses `@hono/zod-validator`, `@asteasolutions/zod-to-openapi`, and Drizzle-Zod integration. Env validation is just another `z.object().parse()` call.

3. **Works natively with both runtimes.** `process.env` in the Hono API, `import.meta.env` in the Vite SPA — same pattern, different source object.

4. **Simpler than t3-env for this use case.** t3-env's primary value-adds are (a) client/server separation enforcement and (b) monorepo `extends`. The Loop SPA has no server vars to protect. The monorepo has only 3 apps, each with distinct env needs.

5. **Better test integration.** The API tests already use `process.env` overrides in PGlite test setup. A plain `z.object().parse(process.env)` is transparent and easy to stub in tests.

### Implementation Pattern

**apps/api/src/env.ts** (new file):

```typescript
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  LOOP_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4242),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  POSTHOG_WEBHOOK_SECRET: z.string().optional(),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  for (const [key, errors] of Object.entries(result.error.flatten().fieldErrors)) {
    console.error(`  ${key}: ${errors?.join(', ')}`);
  }
  process.exit(1);
}

/** Validated, type-safe environment variables for the API server. */
export const env = result.data;
export type Env = z.infer<typeof schema>;
```

**apps/app/src/env.ts** (new file):

```typescript
import { z } from 'zod';

const schema = z.object({
  VITE_API_URL: z.string().url().default('http://localhost:4242'),
  VITE_LOOP_API_KEY: z.string().min(1),
});

const result = schema.safeParse(import.meta.env);

if (!result.success) {
  throw new Error(
    `Missing required environment variables:\n${JSON.stringify(result.error.flatten().fieldErrors, null, 2)}`
  );
}

/** Validated, type-safe environment variables for the React dashboard. */
export const env = result.data;
export type Env = z.infer<typeof schema>;
```

**apps/web/src/env.ts** (new file — Next.js):

```typescript
import { z } from 'zod';

const schema = z.object({
  // Server-only
  DATABASE_URL: z.string().url().optional(), // if web needs DB access
  // Public (NEXT_PUBLIC_*)
  NEXT_PUBLIC_API_URL: z.string().url().default('https://api.looped.me'),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment variables: ${JSON.stringify(result.error.flatten().fieldErrors)}`
  );
}

/** Validated, type-safe environment variables for the marketing site. */
export const env = result.data;
export type Env = z.infer<typeof schema>;
```

**Usage in the API:**

```typescript
// Instead of process.env.DATABASE_URL throughout the codebase
import { env } from './env';

const db = drizzle(neon(env.DATABASE_URL));
```

### When to Reconsider t3-env

Switch to `@t3-oss/env-core` if:

- The monorepo grows to 5+ apps sharing significant env var overlap
- A client-facing app (not the current admin SPA) needs hard enforcement that secrets don't leak to the browser bundle
- A shared `packages/` env config would save meaningful maintenance effort

t3-env would then be introduced via a `packages/env/` workspace package using the `extends` pattern, ensuring all apps inherit common vars (e.g., `NODE_ENV`, shared API keys) without duplication.

---

## Zod v3 vs v4 Note

The API uses Zod v4 (`zod: "^4.3.6"`) while the app uses Zod v3 (`zod: "^3.25.76"`). These are separate installs in separate `node_modules` and do not conflict in a monorepo. The env validation patterns above work identically in both versions. If a shared env package is ever created in `packages/`, you would need to pick one version — Zod v4 is the forward path.

---

## Research Gaps and Limitations

- npm download figures for `@t3-oss/env-core` and `envalid` are estimates derived from search result snippets; precise current counts should be verified at npmjs.com
- GitHub star count for t3-env was not definitively confirmed during this research (estimated 5,000+ based on adoption indicators)
- No hands-on test was performed for the Vite + t3-env SSR limitation described in GitHub issue #177; the caveat may have been resolved in v0.13.x

---

## Contradictions and Disputes

- Some blog posts recommend t3-env as universally superior. This is accurate for Next.js-only setups but oversimplified for mixed-runtime monorepos (Vite + Node).
- The t3-env documentation implies Vite support is seamless via `runtimeEnv: import.meta.env`, but community GitHub issues show this has edge cases during SSR and build-time config evaluation that require workarounds.

---

## Search Methodology

- Searches performed: 12
- Most productive search terms: `t3-env Vite runtimeEnv import.meta.env monorepo extends`, `envalid GitHub stars Node.js limitations`, `zod env validation pattern process.env monorepo`
- Primary information sources: env.t3.gg official docs, GitHub repositories (t3-env, znv, envalid), npm package pages, bundlephobia/bundlejs for size data
