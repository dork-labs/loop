# TypeScript SDK Design for Loop (`@dork-labs/loop-sdk`)

**Research Date:** 2026-02-23
**Mode:** Deep Research
**Searches Performed:** 10
**Sources Gathered:** 20+

---

## Research Summary

Building `@dork-labs/loop-sdk` as a hand-written, class-based SDK following the Stripe/OpenAI pattern is the clear winner for Loop's situation. The Stripe and OpenAI SDKs share a common lineage (same generation tooling: Stainless) and a nearly identical architecture. Loop's API surface is small enough (~15 resource namespaces) that hand-writing is low overhead and produces better output than any generator for a codebase with Loop-specific idioms (dispatch, signals). The existing MCP package already uses `ky` for HTTP — the SDK should make `ky` its HTTP layer too (same dependency, already in the monorepo), or optionally accept a bare native `fetch` for true zero-dependency operation in edge environments. Dual ESM/CJS packaging via `tsup` is the current industry standard for TypeScript library publishing.

---

## Key Findings

### 1. Stripe/OpenAI SDK Architecture — The Reference Pattern

Both are Stainless-generated but their architecture is now the canonical pattern regardless of generation:

**Class hierarchy:**

```
LoopClient (root client)
  ├── issues: IssuesResource extends BaseResource
  ├── projects: ProjectsResource extends BaseResource
  ├── goals: GoalsResource extends BaseResource
  ├── labels: LabelsResource extends BaseResource
  ├── signals: SignalsResource extends BaseResource
  ├── templates: TemplatesResource extends BaseResource
  ├── dispatch: DispatchResource extends BaseResource
  └── dashboard: DashboardResource extends BaseResource
```

**`BaseResource` provides:**

- Reference back to the root client (for config, HTTP client access)
- URL construction from the base path
- The `_request()` method shared by all resources
- Attachment of pagination helpers when response is a list type

**Namespacing on the client:**

```typescript
// Stripe's approach — instantiate resources in the constructor, assign as properties
class LoopClient {
  readonly issues: IssuesResource;
  readonly projects: ProjectsResource;
  // ...

  constructor(config: LoopClientConfig) {
    this.issues = new IssuesResource(this);
    this.projects = new ProjectsResource(this);
    // ...
  }
}
```

**Per-request options** flow through a second argument on every method:

```typescript
await client.issues.list({ status: 'triage' }, { timeout: 5000, idempotencyKey: 'abc' });
```

**Error hierarchy:**

```
LoopError (base)
  LoopAPIError (HTTP errors with status code)
    LoopAuthError (401)
    LoopPermissionError (403)
    LoopNotFoundError (404)
    LoopValidationError (422 — wraps Zod details)
    LoopRateLimitError (429)
    LoopServerError (500+)
  LoopConnectionError (network failures, no HTTP status)
  LoopTimeoutError (request timed out)
```

Each error carries: `status`, `code`, `message`, `requestId` (from `x-request-id` header), and raw response.

### 2. Pagination — Async Generator Pattern

The AWS SDK and OpenAI/Stripe all converge on async generators as the highest-ergonomic pagination API for TypeScript:

```typescript
// Low-level: returns a single page with cursor metadata
const page = await client.issues.list({ status: 'triage', limit: 50 });
// { data: Issue[], total: number, offset: number, limit: number }

// High-level: async iterator that auto-fetches pages
for await (const issue of client.issues.iter({ status: 'triage' })) {
  console.log(issue.title); // loops through all pages transparently
}

// Convenience: collect all items into an array (use carefully with large datasets)
const all = await client.issues.listAll({ status: 'triage' });
```

Implementation of `iter()`:

```typescript
async *iter(params: ListIssuesParams): AsyncGenerator<Issue> {
  let offset = 0;
  while (true) {
    const page = await this.list({ ...params, offset, limit: 100 });
    yield* page.data;
    if (page.data.length < 100) break;
    offset += page.data.length;
  }
}
```

Loop's current API uses offset-based pagination (`limit` + `offset` query params), which maps cleanly to this pattern. No cursor support is needed unless Loop's API adds it later.

### 3. Retry Logic — Exponential Backoff with Jitter

Standard pattern across all major SDKs:

- Default: 2 retries (3 total attempts)
- Retry on: connection errors, 408, 429, 500, 502, 503, 504
- Do NOT retry on: 400, 401, 403, 404, 422 (these are deterministic failures)
- Backoff formula: `min(initialDelay * 2^attempt, maxDelay) + jitter`
- Jitter: add random `0-200ms` to prevent thundering herd

```typescript
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 2,
  initialDelay: 500, // ms
  maxDelay: 30_000, // ms
  jitter: 200, // ms
  retryableStatuses: [408, 429, 500, 502, 503, 504],
} as const;
```

The existing MCP package's `client.ts` uses `ky.create()` with `retry: { limit: 2, statusCodes: [429, 500, 503] }`. The SDK should use the same `ky` dependency and similar config, or re-implement with native fetch if zero-dep is required.

### 4. Idempotency Keys

The Stripe pattern is the reference:

- Idempotency keys are passed per-request in the options object
- For POST mutations, callers pass `{ idempotencyKey: 'uuid' }`
- The SDK sends this as the `Idempotency-Key` HTTP header
- The SDK does NOT auto-generate idempotency keys (Stripe auto-generates on retries but this requires server support)
- Loop's API does not currently have server-side idempotency logic, so the SDK should accept and forward the key without auto-generating

```typescript
// SDK usage
await client.issues.create(
  { title: 'Bug: sign-up broken', type: 'task' },
  { idempotencyKey: crypto.randomUUID() }
);

// SDK implementation
this._client.fetch(url, {
  method: 'POST',
  headers: {
    'Idempotency-Key': options.idempotencyKey,
  },
});
```

### 5. HTTP Client Strategy — ky vs Native Fetch

The existing MCP package uses `ky`. The SDK has two defensible choices:

**Option A: Use `ky` (1 dependency, ~10KB)**

- Pros: Already in the monorepo, retry built-in, timeout built-in, clean API, works in Node 18+, Deno, Bun, browsers, Cloudflare Workers
- Cons: One dependency (violates "zero-dep" goal strictly)
- Best for: consistency with existing packages

**Option B: Native `fetch` with hand-rolled retry (~0 dependencies)**

- Pros: True zero-dep, works in any runtime with `fetch` (Node 18+, all edge runtimes)
- Cons: More code to write and maintain (~80 lines of retry/timeout logic)
- Best for: maximum portability and bundle-size sensitivity

**Decision for Loop:** Use `ky`. The "zero/minimal deps" goal from the task brief already accommodates this. The MCP package already depends on `ky`, so adding the SDK to the monorepo adds no new transitive dependencies. If a future tree-shaking concern arises, the `ky` adapter can be swapped for native fetch behind an interface.

### 6. Package Publishing — tsup with Dual ESM/CJS

The 2025 industry standard for TypeScript library publishing:

**Build tool:** `tsup` (powered by esbuild, zero config for basic cases)

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true, // generate .d.ts declarations
  clean: true,
  sourcemap: true,
  splitting: false, // keep it simple for a small SDK
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' };
  },
});
```

**`package.json` exports field:**

```json
{
  "name": "@dork-labs/loop-sdk",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"]
}
```

**Key 2025 caveat:** TypeScript in 2025 still has ESM/CJS friction. The `moduleResolution: "bundler"` setting in `tsconfig.json` + `tsup`'s `.mjs`/`.cjs` extension strategy is the most reliable approach. Do not use the `"module": "NodeNext"` setting for library packages — it causes import path resolution issues for consumers.

### 7. Types Strategy — Zod-Inferred Types, Not Duplicated

Loop's API routes already define Zod schemas for all request/response shapes. The SDK should NOT re-type these by hand. Instead:

**Option 1 (Recommended):** Extract Zod schemas into a shared `packages/types` package. Both the API and the SDK consume from this source of truth. SDK types are inferred from Zod: `type Issue = z.infer<typeof IssueSchema>`.

**Option 2 (Simpler short-term):** Hand-write types in the SDK that mirror the API's Zod schemas. Accept the maintenance burden of keeping them in sync manually. Works fine while the API surface is small.

**Option 3 (Over-engineered for now):** Use `openapi-typescript` or `hey-api/openapi-ts` to generate types from the OpenAPI spec at `/api/openapi.json`. This creates a code generation step that needs to run in CI and complicates the dev workflow. The API already has Zod schemas — generating types from OpenAPI (which was itself generated from Zod) adds unnecessary indirection.

**Recommendation: Start with Option 2 (hand-written types). Move to Option 1 (shared Zod package) when the API surface stabilizes.**

### 8. SDK Generator Comparison (Stainless, Fern, Speakeasy, hey-api)

| Generator          | TypeScript Quality                          | OpenAPI Fidelity                 | Requires Custom Config       | Self-hostable   |
| ------------------ | ------------------------------------------- | -------------------------------- | ---------------------------- | --------------- |
| Stainless          | Excellent                                   | Partial (prefers its own format) | Yes — needs Stainless config | No — cloud-only |
| Fern               | Excellent, "hand-written feel"              | Full OpenAPI support             | Minimal                      | Yes             |
| Speakeasy          | Good                                        | Full OpenAPI                     | Yes                          | Yes (binary)    |
| hey-api/openapi-ts | Good for types, minimal for client features | Full                             | Minimal                      | Yes             |

**For Loop:**

- Stainless powers OpenAI's SDK and would produce the best output, but requires Loop to maintain a Stainless config alongside the OpenAPI spec, and has cloud-dependency
- Fern would also produce excellent output with less lock-in, but adds ongoing generation CI complexity
- **Neither is worth it for Loop's current API size.** The total SDK is ~800-1200 lines of TypeScript across 10-12 files. Hand-writing is faster and produces a more idiomatic result tailored to Loop's specific patterns (dispatch, signals) that no generator will handle well without custom templates

---

## Approach Comparison

### Approach 1: Hand-Written SDK

Write all resource classes, types, HTTP logic, retry, and pagination by hand following the Stripe/OpenAI pattern.

**Pros:**

- Full control over API ergonomics
- Loop-specific idioms are natural (dispatch.next() with its complex response shape)
- No generation step, no CI complexity
- Types can be kept intentionally minimal (no unused generated surface)
- Can evolve API design freely
- Consistent with existing MCP package patterns (which is hand-written)

**Cons:**

- When the API adds endpoints, the SDK must be manually updated
- Initial investment: ~2-3 days of focused work
- Risk of types drifting from API reality if not disciplined

**Complexity:** Low-Medium
**Maintenance:** Medium (proportional to API change rate)
**Time to ship:** 2-3 days

---

### Approach 2: Generated from OpenAPI Spec

Use `hey-api/openapi-ts` or Fern to generate types and client from `/api/openapi.json`.

**Pros:**

- API changes propagate automatically when generation runs
- Zero manual type maintenance
- `hey-api/openapi-ts` generates TanStack Query hooks too (useful for the app)
- Fern produces genuinely good TypeScript

**Cons:**

- Generation step must run in CI when API changes — adds workflow complexity
- Generated types include everything, even internal-only fields
- The dispatch endpoint's response (`{ issue, prompt, meta }`) requires custom handling that generators won't get right without templates
- `hey-api` generates types but its HTTP client is basic (no retry, no idempotency keys, no typed errors)
- Stainless/Fern for full-quality output adds vendor dependency or self-hosted infra
- The OpenAPI spec at `apps/api/src/routes/openapi.ts` needs to be audited for completeness before generation produces useful output

**Complexity:** Medium (initial setup) + Low (ongoing if CI is set up correctly)
**Maintenance:** Low (for types) but Medium (for custom behaviors)
**Time to ship:** 3-5 days (setup + custom wrappers for dispatch + CI automation)

---

### Approach 3: Hybrid — Hand-Written Client, Zod-Inferred Types

Write the client class and resource methods by hand. Extract types from existing Zod schemas in the API routes (or a shared package) rather than duplicating them.

**Pros:**

- Zod schemas are the source of truth — types cannot drift
- Client design is fully hand-controlled (same ergonomic benefits as Approach 1)
- When an API schema changes, the TypeScript compiler enforces SDK type updates
- Enables runtime validation in the SDK if desired (parse responses through Zod)

**Cons:**

- Requires creating `packages/types` or `packages/schemas` to share Zod schemas between API and SDK
- Adds a monorepo package with its own tsconfig, build step, and publishing consideration
- Zod as a peer dependency of the SDK increases install size (~13KB gzipped)
- The API route files currently embed schemas inline — extracting to a shared package requires refactoring

**Complexity:** Medium (monorepo package setup + schema extraction)
**Maintenance:** Low (Zod enforces consistency)
**Time to ship:** 4-6 days (monorepo setup + refactor + client writing)

---

## Security Considerations

1. **API key never log or expose in errors.** The SDK must scrub the `Authorization` header from any logged request details or error messages. Follow the Stripe pattern: error objects include `requestId` and `status` but not request headers.

2. **API key should not appear in stack traces.** Avoid constructing URLs with the key in the query string (Loop uses Bearer token headers — this is already correct).

3. **No bundler-leaking.** The `ky` dependency and SDK source should not inadvertently pull in server-side modules in browser builds. `ky` is browser-compatible. If the SDK is used in a browser context (unusual but possible for the dashboard), the API key must be treated as a secret and not exposed to client-side code. This is a user concern, not an SDK concern.

4. **Idempotency key generation.** If the SDK auto-generates idempotency keys, use `crypto.randomUUID()` (Node 14.17+ / Web Crypto). Do NOT use `Math.random()`.

5. **HTTPS enforcement.** The SDK should warn (not throw) if `baseURL` is `http://` in non-localhost contexts. Production API traffic should always be HTTPS.

---

## Performance Considerations

1. **ky vs native fetch bundle size.** `ky` is ~4.7KB minified+gzipped. For a server-side-only SDK used by agents in Node.js, this is irrelevant. If browser bundle size matters in the future, replace `ky` with native fetch behind the same interface.

2. **Retry backoff impact on agents.** AI agents calling `dispatch.next()` in a tight loop could get into a retry storm if the API is temporarily unavailable. The default 2-retry / 500ms-initial-delay config means a worst case of ~3 seconds added latency per request before failing. This is acceptable for agent workflows.

3. **Pagination memory.** `listAll()` collects all items into memory. For issue lists with hundreds of items, this is fine. Do not offer `listAll()` on signals (which could be unbounded). The `iter()` async generator is the preferred high-volume approach.

4. **Connection pooling.** `ky` uses the browser `fetch` / Node `undici` under the hood, which handles connection reuse automatically. No additional pooling config needed.

5. **Timeout defaults.** Default to `30_000ms` (30s) per the OpenAI SDK. Agents working in slow loops may benefit from longer timeouts, but callers can override per-request.

---

## Recommendation

### Recommended Approach: **Approach 1 — Hand-Written SDK**

**Rationale:**

1. **Loop's API surface is small.** 12-15 resource methods per namespace, ~10 namespaces. The entire SDK is ~1,000 lines of TypeScript. This is a weekend of work to hand-write correctly, not a multi-week undertaking.

2. **The dispatch endpoint is non-generic.** `dispatch.next()` returns `{ issue, prompt, meta }` — a richly structured response that is Loop's core differentiated feature. No generator produces the right ergonomics here without significant customization templates. Hand-writing produces a purpose-built, intuitive API.

3. **The MCP package already establishes the pattern.** `packages/mcp/src/client.ts` shows `ky.create()` with retry config. The SDK's HTTP layer should be structurally identical. This is 20 lines of code to port.

4. **Generation adds complexity that isn't earned yet.** A generated SDK is valuable when: (a) the API surface is large (100+ endpoints), (b) changes are frequent, and (c) a CI pipeline maintains generation automatically. Loop at this stage has none of these conditions at critical mass.

5. **Hybrid (Approach 3) is premature.** The shared Zod schemas package is a great long-term architecture, but extracting schemas from the API routes now (which embed them inline in route files) requires a refactor that has API-side implications and doesn't directly serve the SDK's near-term shipping goal. Revisit when the API has 2+ consumers and schema drift actually becomes a problem.

### Implementation Blueprint

**Package location:** `packages/sdk/`
**Published name:** `@dork-labs/loop-sdk`

**Directory structure:**

```
packages/sdk/
  src/
    client.ts           # LoopClient class (root)
    base-resource.ts    # BaseResource with _request(), shared config
    http.ts             # ky wrapper, retry logic, error parsing
    errors.ts           # Error class hierarchy
    pagination.ts       # Page<T> type, async generator helpers
    types.ts            # Shared request/response types (hand-written)
    resources/
      issues.ts         # IssuesResource
      projects.ts       # ProjectsResource
      goals.ts          # GoalsResource
      labels.ts         # LabelsResource
      signals.ts        # SignalsResource
      templates.ts      # TemplatesResource
      dispatch.ts       # DispatchResource — highest priority
      dashboard.ts      # DashboardResource
      comments.ts       # CommentsResource (sub-resource on issues)
      relations.ts      # RelationsResource
    index.ts            # Public exports
  tsup.config.ts
  tsconfig.json
  package.json
```

**Core client shape:**

```typescript
// packages/sdk/src/client.ts

export interface LoopClientConfig {
  apiKey: string;
  baseURL?: string; // default: 'https://api.looped.me'
  maxRetries?: number; // default: 2
  timeout?: number; // default: 30_000 ms
}

export class LoopClient {
  readonly issues: IssuesResource;
  readonly projects: ProjectsResource;
  readonly goals: GoalsResource;
  readonly labels: LabelsResource;
  readonly signals: SignalsResource;
  readonly templates: TemplatesResource;
  readonly dispatch: DispatchResource;
  readonly dashboard: DashboardResource;

  constructor(config: LoopClientConfig) {
    // validate apiKey
    // initialize ky instance
    // initialize all resources
  }
}
```

**Per-request options:**

```typescript
export interface RequestOptions {
  timeout?: number;
  idempotencyKey?: string;
  signal?: AbortSignal; // for cancellation
}
```

**Dispatch resource (highest priority — this is Loop's killer feature):**

```typescript
export class DispatchResource extends BaseResource {
  /**
   * Atomically claim and return the highest-priority unblocked issue,
   * along with hydrated prompt instructions.
   * Returns null if the queue is empty.
   */
  async next(params?: { projectId?: string }, opts?: RequestOptions): Promise<DispatchResult | null> { ... }

  /**
   * Preview the priority-ordered queue without claiming anything.
   */
  async queue(params?: QueueParams, opts?: RequestOptions): Promise<Page<ScoredIssue>> { ... }
}
```

**Error handling (consumer-facing):**

```typescript
import { LoopClient, LoopNotFoundError, LoopRateLimitError } from '@dork-labs/loop-sdk';

try {
  const issue = await client.issues.get('nonexistent-id');
} catch (e) {
  if (e instanceof LoopNotFoundError) {
    // handle 404
  } else if (e instanceof LoopRateLimitError) {
    console.log(`Rate limited. Retry after ${e.retryAfter}s`);
  } else {
    throw e;
  }
}
```

### Caveats

1. **OpenAPI spec completeness.** The SDK types are only as accurate as the API implementation. Any discrepancies between the Zod schemas in the route files and the hand-written SDK types will be caught by integration tests, not the type system. Write at least one integration test per resource namespace against a real (test) API instance.

2. **The `ky` dependency.** If a future requirement mandates zero dependencies (e.g., embedding in an edge worker with no npm install), replace `ky` with a thin native-fetch wrapper behind the same interface. The cost is ~80 additional lines of retry/timeout code. This change should be non-breaking for consumers.

3. **Versioning discipline.** Once published, the SDK is a public API. Follow semver strictly. Types are part of the public API — TypeScript type changes are breaking changes. Use `@deprecated` tags rather than removals.

4. **Dispatch response shape stability.** The `dispatch.next()` response (`{ issue, prompt, meta }`) is the most usage-critical endpoint in Loop. Avoid adding fields to `DispatchResult` that would break existing consumers without a major version bump.

5. **MCP package reuse.** The existing `packages/mcp/src/client.ts` (`createApiClient()` with `ky`) is directly reusable in the SDK. The MCP package could be refactored to import from the SDK's HTTP layer rather than defining its own. This is a good cleanup task after the SDK ships.

---

## Sources & Evidence

- "Resources are organized hierarchically and instantiated during client initialization" — [Stripe Node.js SDK Resource System - DeepWiki](https://deepwiki.com/stripe/stripe-node/2.2-resources-system)
- Stainless generates the TypeScript SDK that OpenAI and Cloudflare use — [openai-node GitHub](https://github.com/openai/openai-node)
- "The library provides convenient access to the OpenAI REST API from TypeScript or JavaScript and is generated from the OpenAPI specification with Stainless" — [OpenAI Node.js Library](https://platform.openai.com/docs/libraries/node-js-library)
- tsup for dual ESM+CJS — [TypeScript in 2025 with ESM and CJS](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing), [Dual Publishing ESM and CJS with tsup](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong)
- "Certain errors are automatically retried 2 times by default with exponential backoff, including connection errors, 408 Request Timeout, 409 Conflict, 429 Rate Limit, and >=500 Internal errors" — [openai-node README](https://github.com/openai/openai-node/blob/master/README.md)
- Fern generates "idiomatic and typesafe by default" TypeScript — [Review of 8 SDK Generators 2025](https://nordicapis.com/review-of-8-sdk-generators-for-apis-in-2025/)
- Stainless "requires network connectivity to their cloud service for SDK generation, which rules out air-gapped environments" — [Choosing an SDK vendor: Speakeasy vs Fern vs Stainless](https://www.speakeasy.com/blog/choosing-an-sdk-vendor)
- hey-api/openapi-ts produces "production-ready SDKs" — [GitHub hey-api/openapi-ts](https://github.com/hey-api/openapi-ts)
- ky: "built directly on top of the Fetch standard, compatible across Node, Deno, Cloudflare Workers, and the browser, three retries with exponential backoff out of the box" — search result summary
- Prior Loop SDK/CLI research: [research/20260222_sdk_cli_api_interaction_layers.md](../research/20260222_sdk_cli_api_interaction_layers.md)

---

## Research Gaps and Limitations

- Did not benchmark `ky` vs native fetch performance difference in Node.js 22 specifically — this is unlikely to matter at Loop's scale
- Did not audit the completeness of `/api/openapi.json` — this would be necessary before any generation approach could be evaluated fairly
- Fern pricing / open-source vs paid tier boundary not fully evaluated — relevant if generation is revisited later
- The "idempotency key on retry" behavior (auto-generating vs requiring caller to supply) requires a decision about whether Loop's API will add server-side idempotency support

## Search Methodology

- Searches performed: 10
- Most productive search terms: "stripe-node resource namespacing TypeScript 2025", "openai-node stainless pagination async generator", "TypeScript SDK tsup ESM CJS dual package", "fern stainless speakeasy comparison 2025"
- Primary sources: GitHub deepwiki (stripe-node), openai-node README, nordicapis SDK generator review, Liran Tal ESM/CJS post, prior Loop research
