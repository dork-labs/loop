# Research: Documentation Structure for Loop Post-MVP Docs Update

**Date:** 2026-02-20
**Feature:** docs-update-post-mvp
**Depth:** Deep Research

---

## Research Summary

Loop's documentation needs to serve two distinct audiences: developers integrating the REST API into their own systems, and AI agents consuming docs to understand what to do next. The most effective structure for this kind of product follows the Diátaxis framework (four quadrants: tutorials, how-to guides, reference, explanation) combined with the information architecture patterns from best-in-class API docs like Stripe and Vercel. Fumadocs already has OpenAPI integration (`fumadocs-openapi`) wired up in `apps/web/src/lib/openapi.ts`, which means the API reference section can be generated automatically from an OpenAPI spec. The current `docs/meta.json` already sketches eight top-level sections; this report refines those into a concrete, prioritized table of contents with content specifications for each page.

---

## Key Findings

### 1. Framework: Diátaxis Maps Cleanly Onto Loop's Surface Area

The Diátaxis framework identifies four documentation types that serve different user needs:

- **Tutorials** — learning-oriented, hand-holding, concrete goal ("build your first agent integration")
- **How-to guides** — task-oriented, assumes competency ("how to ingest a Sentry error as a signal")
- **Reference** — information-oriented, authoritative and complete (REST API endpoints, CLI commands)
- **Explanation** — understanding-oriented, conceptual ("why does Loop use EWMA for prompt scoring?")

Loop's existing section placeholders in `docs/meta.json` (`getting-started`, `guides`, `concepts`, `integrations`, `api`, `self-hosting`, `contributing`, `changelog`) map directly onto this framework:

| Diátaxis Type | Loop Section |
|---|---|
| Tutorial | `getting-started` |
| How-to guides | `guides`, `integrations` |
| Reference | `api`, `cli` (missing), `self-hosting` |
| Explanation | `concepts` |

The most important insight: **the "concepts" section is where Loop earns developer trust**. Loop is not a simple CRUD API — it has a mental model (signals → issues → dispatch → reviews) that needs to be explained before any integration attempt. Prioritize concepts early.

### 2. Getting Started Guide: Optimize for Time-to-First-API-Call

Industry standard (Twilio, Stripe) is to minimize time-to-first-successful-call. The goal is a working signal ingestion in under 5 minutes for any developer who lands on the docs. The Getting Started section should be a linear tutorial, not a reference dump.

Effective Getting Started structure:
1. One-sentence product description (what it is, what it does)
2. Prerequisites (API key, curl or any HTTP client)
3. Step 1: Health check — prove the connection works
4. Step 2: Create a project
5. Step 3: Ingest a signal — the "hello world" moment
6. Step 4: View the resulting issue in the dashboard
7. Next steps card (link to: CLI quickstart, Webhook setup, Prompt Engine)

Use Fumadocs `<Steps>` component for the numbered walkthrough. Use `<Callout type="info">` for prerequisite notes. Use tabbed code blocks for curl/JavaScript/Python examples.

### 3. Fumadocs-Specific Capabilities Already Wired Up

The web app already has:

- **`fumadocs-openapi`** installed and configured (`apps/web/src/lib/openapi.ts`), pointing at `docs/api/openapi.json`
- **`APIPage`** component exported for use in catch-all page renderer
- **Catch-all route** at `/docs/[[...slug]]/page.tsx` that renders both MDX and OpenAPI pages
- **`source.config.ts`** pointing at root-level `docs/` directory
- **`DocsLayout`** with sidebar driven by `source.pageTree` and a GitHub link

This means the API reference section requires only:
1. Generating `docs/api/openapi.json` from the Hono routes (Hono has `@hono/zod-openapi` or similar for spec generation)
2. Running `fumadocs-openapi generate` to produce MDX files in `docs/api/`
3. Adding a `meta.json` inside `docs/api/` to control sidebar order

Fumadocs components available for use in MDX:

| Component | Use Case |
|---|---|
| `<Callout>` | Warnings, tips, prerequisites, "danger" for destructive ops |
| `<Tabs>` / `<Tab>` | Multi-language code examples (curl, JS, Python) |
| `<Steps>` | Numbered how-to sequences |
| `<Card>` / `<Cards>` | Section landing pages, "next steps" navigation |
| `<TypeTable>` | Parameter/field reference tables |
| Code blocks with title + highlight | All API request/response examples |
| `APIPage` (OpenAPI) | Auto-generated interactive API reference |

### 4. Sidebar Organization: Folder-Per-Section with meta.json

The existing `docs/meta.json` top-level `pages` array controls the sidebar order. Each entry should be a directory. Each directory needs its own `meta.json` with a `title` and `pages` array. Fumadocs v14 introduced Sidebar Tabs — designating a folder as `root` in meta.json creates tab-style navigation. This is ideal for separating "Guides" from "API Reference" at the top level.

Recommended file system layout (see Full Recommendation below).

### 5. API Reference: Generate From OpenAPI, Don't Hand-Write

Hand-written API reference docs go stale. The correct approach for Loop is:
1. Add `@hono/zod-openapi` or a route-level OpenAPI annotation approach to generate a spec from the existing Zod schemas already in the route files
2. Output `docs/api/openapi.json` (or YAML) as part of the build
3. Use `fumadocs-openapi` to generate/refresh the MDX reference pages
4. The `APIPage` component provides an interactive playground for free

Until the OpenAPI spec is generated, a hand-written quick reference table in `docs/api/index.mdx` is acceptable as a placeholder.

### 6. CLI Documentation Pattern

The CLI should get its own reference section (`docs/cli/`). Every command page should follow this template:

```
## loop <command>

Brief one-line description.

### Usage
\`\`\`bash
loop <command> [flags]
\`\`\`

### Arguments / Flags
| Flag | Default | Description |
|---|---|---|

### Examples
\`\`\`bash
# Common use case 1
loop <command> --flag value

# Common use case 2
\`\`\`

### See Also
- Related command links
```

This is the pattern used by the Kubernetes kubectl docs, Vercel CLI docs, and Stripe CLI docs — all of which are considered industry reference quality.

### 7. Webhook Documentation Pattern

Webhook docs need three things:
1. **Setup guide** — how to register an endpoint, verify signatures, respond correctly (2xx fast)
2. **Event catalog** — every event type with full example payload (one code block per event)
3. **Security** — HMAC-SHA256 verification walkthrough with copy-paste code

Stripe's webhook docs are the gold standard: they show the full JSON payload, explain each field, and provide verification code in multiple languages. Loop has three webhook providers (PostHog, GitHub, Sentry) — each should have a dedicated integration page.

### 8. Concepts Section: The Trust-Builder

"Concepts" is where you explain Loop's mental model. Without this, developers will struggle to use the API correctly because they won't understand why certain entities exist or how data flows. Required concept pages:

- **Signals** — what they are, the difference between a raw signal and an issue, how signals are typed (error, metric, feedback, alert)
- **Issues** — how issues are created from signals, status lifecycle, relations and comments
- **The Dispatch Loop** — how the prompt engine selects a template, hydrates it with Handlebars, dispatches it, and closes the loop via reviews
- **Priority Scoring** — EWMA-based scoring explained at a high level (links to ADR 0010)
- **Projects and Goals** — organizational model, how goals aggregate issues

### 9. 2025-2026 DX Trend: Agent Experience (AX)

One notable 2025-2026 trend: "You can't have great DX if you don't have great AX (Agent Experience)." Loop's product is *about* AI agents, so its docs should be structured to be consumed by AI agents as well as humans. This means:

- Clear, unambiguous headings (agents use them as semantic anchors)
- Explicit field-by-field descriptions (no "see above" or "as mentioned")
- Consistent terminology throughout (no synonyms for the same concept)
- A machine-readable API spec (OpenAPI) alongside human-readable prose

---

## Full Recommendation: Documentation Table of Contents

### Proposed File System Layout

```
docs/
├── index.mdx                          # Root: what is Loop, quick links
├── meta.json                          # Top-level sidebar order
│
├── getting-started/
│   ├── meta.json
│   ├── index.mdx                      # Overview + prereqs
│   ├── quickstart.mdx                 # 5-minute: signal → issue tutorial
│   ├── authentication.mdx             # API keys, Bearer token
│   └── core-concepts.mdx             # 1-page model overview (link to /concepts)
│
├── concepts/
│   ├── meta.json
│   ├── index.mdx                      # Concepts overview
│   ├── signals.mdx                    # What signals are, signal types
│   ├── issues.mdx                     # Issue lifecycle, relations, comments
│   ├── dispatch-loop.mdx              # Template → hydrate → dispatch → review
│   ├── priority-scoring.mdx           # EWMA scoring model
│   └── projects-and-goals.mdx         # Organizational model
│
├── guides/
│   ├── meta.json
│   ├── index.mdx                      # Guides overview
│   ├── ingest-errors-from-sentry.mdx  # How-to: Sentry signal flow end-to-end
│   ├── ingest-github-events.mdx       # How-to: GitHub webhook → signal
│   ├── track-posthog-metrics.mdx      # How-to: PostHog → alert → signal
│   ├── triage-issues-with-cli.mdx     # How-to: CLI triage workflow
│   ├── build-an-agent-integration.mdx # How-to: use dispatch in an AI agent loop
│   └── prompt-review-workflow.mdx     # How-to: submit reviews, close the loop
│
├── integrations/
│   ├── meta.json
│   ├── index.mdx                      # Integrations overview + provider table
│   ├── sentry.mdx                     # Full Sentry webhook setup + event catalog
│   ├── github.mdx                     # Full GitHub webhook setup + event catalog
│   ├── posthog.mdx                    # Full PostHog webhook setup + event catalog
│   └── webhook-security.mdx           # HMAC-SHA256 verification, replay protection
│
├── api/
│   ├── meta.json
│   ├── index.mdx                      # API overview, base URL, auth, errors, pagination
│   ├── openapi.json                   # Generated OpenAPI 3.1 spec
│   └── [generated MDX per endpoint]   # Auto-generated by fumadocs-openapi
│
├── cli/
│   ├── meta.json
│   ├── index.mdx                      # CLI overview, installation, config
│   ├── issues.mdx                     # loop issues [list|create|get|update|close]
│   ├── signals.mdx                    # loop signals [ingest|list]
│   ├── triage.mdx                     # loop triage
│   ├── templates.mdx                  # loop templates [list|get|create|promote]
│   ├── dispatch.mdx                   # loop dispatch
│   └── config.mdx                     # loop config [set|get|list]
│
├── self-hosting/
│   ├── meta.json
│   ├── index.mdx                      # Self-hosting overview
│   ├── environment-variables.mdx      # Full env var reference table
│   ├── database.mdx                   # Neon/PostgreSQL setup, migrations
│   └── vercel-deployment.mdx          # One-click Vercel deploy, env config
│
├── contributing/
│   ├── meta.json
│   ├── index.mdx                      # Contributing overview
│   ├── development-setup.mdx          # Local dev, commands, testing
│   └── architecture.mdx               # High-level architecture, ADR links
│
└── changelog/
    ├── meta.json
    └── index.mdx                      # Changelog (or link to GitHub releases)
```

### Updated Root meta.json

```json
{
  "title": "Loop Documentation",
  "pages": [
    "index",
    "getting-started",
    "concepts",
    "guides",
    "integrations",
    "api",
    "cli",
    "self-hosting",
    "contributing",
    "changelog"
  ]
}
```

Note: `cli` is added as a new top-level section missing from the current `meta.json`.

---

## Priority Order for Writing

### Priority 1 — Unblock Any Integration (Week 1)

These pages need to exist before anyone can meaningfully use Loop:

1. `getting-started/quickstart.mdx` — The 5-minute tutorial
2. `getting-started/authentication.mdx` — How to get and use an API key
3. `api/index.mdx` — Base URL, auth header format, error codes, pagination
4. `integrations/webhook-security.mdx` — HMAC verification (security-critical)

### Priority 2 — Build Understanding (Week 2)

5. `concepts/signals.mdx` — Core mental model piece
6. `concepts/issues.mdx` — Core mental model piece
7. `concepts/dispatch-loop.mdx` — Unique Loop concept, needs clear explanation
8. `integrations/sentry.mdx` — Most common error ingestion path

### Priority 3 — Enable Power Users (Week 3)

9. `cli/index.mdx` + all CLI command pages
10. `guides/build-an-agent-integration.mdx` — Primary use case for the product
11. `concepts/priority-scoring.mdx`
12. `guides/prompt-review-workflow.mdx`

### Priority 4 — Complete Coverage (Week 4+)

13. `integrations/github.mdx` and `integrations/posthog.mdx`
14. `self-hosting/*` — full env var reference, database setup
15. OpenAPI spec generation + `fumadocs-openapi` auto-generated reference
16. `contributing/*` and `changelog/index.mdx`

---

## Fumadocs-Specific Recommendations

### Use Sidebar Tabs for Major Sections

Configure the Fumadocs v14 Sidebar Tabs feature by marking `getting-started`, `guides`, and `api` as root folders in their respective `meta.json` files. This prevents the sidebar from becoming overwhelming when a developer is focused on one area.

### Use `<Steps>` for All Tutorials

Every how-to and tutorial page should use the Fumadocs `<Steps>` component instead of numbered markdown headings. This provides consistent visual treatment and is more scannable.

### Use `<Callout>` Consistently

Establish a four-callout vocabulary:
- `<Callout type="info">` — supplementary context
- `<Callout type="warn">` — things that commonly go wrong
- `<Callout type="error">` — security or data-loss warnings
- `<Callout>` (default) — tips and shortcuts

### Use `<Tabs>` for All Code Examples

Every code example that shows an API call should have tabs for at least: `curl`, `JavaScript (fetch)`, and `TypeScript`. This matches what Stripe and Vercel do and directly reduces friction for developers using any stack.

### OpenAPI Playground is Free — Use It

The `APIPage` component from `fumadocs-openapi` provides an interactive "Try it" playground for free. Once the OpenAPI spec is generated, developers can test endpoints directly in the docs without leaving the browser. This is the single highest-impact DX improvement available without writing a single line of custom UI.

### Every API Section Page Needs an Overview

Each generated OpenAPI section (issues, projects, signals, etc.) should have a hand-written `index.mdx` page above the generated endpoint pages. This overview should explain the resource's purpose, data model, and common patterns before the reader hits the raw endpoint reference.

---

## Detailed Analysis

### The Signal → Issue → Dispatch → Review Loop (Documentation Priority)

Loop's core differentiator is the autonomous feedback loop. This is the concept that makes the product non-obvious and worth documenting thoroughly. The documentation should trace this end-to-end flow in at least two places:

1. **`concepts/dispatch-loop.mdx`** — deep explanation of each stage
2. **`guides/build-an-agent-integration.mdx`** — tutorial that implements the full loop

A diagram (even ASCII) showing Signal → Issue → Priority Score → Dispatch → Agent Action → Prompt Review → Updated Score would anchor both pages and make the mental model immediately graspable.

### Authentication Documentation

Loop uses a single Bearer token (`LOOP_API_KEY`) for all `/api/*` endpoints and separate HMAC secrets per webhook provider. This is simple but must be documented explicitly because:
- Webhook auth is different from REST auth (a common confusion point)
- The three webhook secrets (`GITHUB_WEBHOOK_SECRET`, `SENTRY_CLIENT_SECRET`, `POSTHOG_WEBHOOK_SECRET`) each have different verification mechanisms

Document these as separate concepts: "API Key Authentication" for REST and "Webhook Signature Verification" for inbound webhooks.

### Error Documentation

The API uses consistent error shapes (`{ error: string }` for most errors, `{ error, details }` for Zod validation failures). The `api/index.mdx` overview should include a complete error code table:

| Status | Meaning | Common Cause |
|---|---|---|
| 400 | Bad Request | Missing or invalid body fields |
| 401 | Unauthorized | Missing or invalid Authorization header |
| 404 | Not Found | Resource ID does not exist or was soft-deleted |
| 422 | Validation Error | Zod schema validation failed (includes `details`) |
| 500 | Internal Server Error | Unexpected error — contact support |

### Pagination Documentation

The API uses cursor-based or offset pagination (verify which from the route implementations). This must be documented in `api/index.mdx` with a concrete example showing `limit`, `offset` (or `cursor`), and how to iterate through pages.

---

## Research Gaps and Limitations

- The CLI tool's 13 commands are referenced in the brief but the CLI source is not in this repository — assuming it is a separate package. The CLI documentation structure above assumes a `loop` binary exists; the exact command names should be verified before writing command reference pages.
- The OpenAPI spec (`docs/api/openapi.json`) does not yet exist. The recommended path is to add OpenAPI annotations to the Hono routes, but this is non-trivial and may require a separate implementation task before the API reference section can be auto-generated.
- Whether Fumadocs Sidebar Tabs are configured per-folder in `meta.json` or require a different config in v14 should be verified against the latest Fumadocs docs before implementation.
- Pagination implementation details (cursor vs offset, field names) were not confirmed from reading route source files — these should be verified before writing `api/index.mdx`.

---

## Contradictions and Disputes

None found. The Diátaxis framework, Stripe/Vercel documentation patterns, and Fumadocs capabilities are all consistent in their recommendations. The main tension in practice is between completeness and shipping speed — the priority order above resolves this by identifying the minimum viable documentation set (Priority 1) that enables actual use of the product.

---

## Search Methodology

- Number of searches performed: 11 web searches, 8 page fetches
- Most productive search terms: "Fumadocs sidebar navigation meta.json", "Diátaxis framework tutorials how-to guides reference", "CLI tool documentation best practices", "webhook documentation best practices Stripe Twilio"
- Primary information sources: fumadocs.dev, diataxis.fr, theneo.io, infrasity.com, docs.stripe.com

---

## Sources

- [Fumadocs Getting Started](https://www.fumadocs.dev/docs/mdx)
- [Fumadocs v14 Release](https://www.fumadocs.dev/blog/v14)
- [Fumadocs OpenAPI Integration](https://www.fumadocs.dev/docs/integrations/openapi)
- [Fumadocs Navigation](https://www.fumadocs.dev/docs/navigation)
- [Fumadocs UI Components](https://www.fumadocs.dev/docs/ui/components)
- [Diátaxis Documentation Framework](https://diataxis.fr/)
- [Diátaxis: Start Here](https://diataxis.fr/start-here/)
- [API Documentation Best Practices 2025 — Theneo](https://www.theneo.io/blog/api-documentation-best-practices-guide-2025)
- [CLI Documentation Checklist for SaaS — Infrasity](https://www.infrasity.com/blog/cli-docs-checklist)
- [Stripe Webhooks Documentation](https://docs.stripe.com/webhooks)
- [WorkOS: Building Webhooks — Guidelines and Best Practices](https://workos.com/blog/building-webhooks-into-your-application-guidelines-and-best-practices)
- [Command Line Interface Guidelines](https://clig.dev/)
- [I'd Rather Be Writing — Documenting APIs](https://idratherbewriting.com/learnapidoc/)
- [Postman: API Documentation Best Practices](https://www.postman.com/api-platform/api-documentation/)
