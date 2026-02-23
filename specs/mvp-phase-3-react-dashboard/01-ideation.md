---
slug: mvp-phase-3-react-dashboard
number: 4
created: 2026-02-20
status: ideation
---

# MVP Phase 3: React Dashboard

**Slug:** mvp-phase-3-react-dashboard
**Author:** Claude Code
**Date:** 2026-02-20
**Branch:** preflight/mvp-phase-3-react-dashboard
**Related:** [MVP Build Plan](../../specs/mvp-build-plan.md) (Phase 3 of 4)

---

## 1) Intent & Assumptions

- **Task brief:** Build the React dashboard for Loop — 5 views (Issue List, Issue Detail, Loop Activity, Goals Dashboard, Prompt Health) in the existing `apps/app/` React 19 + Vite 6 + Tailwind CSS 4 app, plus 3 new dashboard API endpoints in `apps/api/`. This is Phase 3 of the MVP, building on the complete data layer (Phase 1) and prompt/dispatch engine (Phase 2).

- **Assumptions:**
  - Phases 1 and 2 are complete — all CRUD endpoints, dispatch, prompt selection/hydration, and reviews are implemented and tested
  - The frontend (`apps/app/`) is a clean slate — only React 19, Vite 6, and Tailwind CSS 4 are installed, with a placeholder `App.tsx`
  - TanStack Query will be used for data fetching (specified in the task brief)
  - shadcn/ui will be used for the component library (specified in the task brief)
  - The dashboard is read-heavy for the MVP — no inline editing of issues from the dashboard (agents create/update via API)
  - Authentication is a single API key via bearer token (same as the existing API auth model)
  - The app will be a client-side SPA — no SSR needed

- **Out of scope:**
  - CLI tool (Phase 4 — independent, can be built in parallel)
  - Prompt template editing UX (post-MVP)
  - Custom/saved views (post-MVP)
  - Multi-user authentication (post-MVP)
  - Real-time updates via SSE/WebSocket (polling is sufficient for MVP)
  - Inline issue creation or editing from the dashboard

---

## 2) Pre-reading Log

- `meta/loop-litepaper.md`: Loop vision — "no AI inside Loop", pull-based dispatch, self-improving prompts. The dashboard is the visibility layer into the autonomous loop
- `meta/loop-mvp.md`: Full MVP spec with domain model, API endpoints, and dashboard view descriptions for all 5 views
- `specs/mvp-build-plan.md`: 4-phase build plan — Phase 3 scope: 5 dashboard views + 3 API endpoints + TanStack Query + shadcn/ui
- `apps/api/src/db/schema/_helpers.ts`: Shared column helpers — `cuid2Id`, `timestamps`, `softDelete`
- `apps/api/src/db/schema/issues.ts`: Issues table with type/status/priority enums, JSONB fields for hypothesis/commits/PRs, plus labels, issueLabels, issueRelations, comments
- `apps/api/src/db/schema/projects.ts`: Projects with status/health enums, goals with metric tracking
- `apps/api/src/db/schema/signals.ts`: Signals with source, severity, JSONB payload
- `apps/api/src/db/schema/prompts.ts`: Prompt templates (conditions, specificity), versions (usage/completion metrics), reviews (clarity/completeness/relevance 1-5)
- `apps/api/src/routes/issues.ts`: Full CRUD with filtering by status/type/projectId/labelId/priority/parentId, pagination
- `apps/api/src/routes/dispatch.ts`: `GET /dispatch/next` (atomic claim with `FOR UPDATE SKIP LOCKED`, priority scoring), `GET /dispatch/queue` (preview)
- `apps/api/src/routes/templates.ts`: Template CRUD + version management + `GET /templates/preview/:issueId`
- `apps/api/src/routes/prompt-reviews.ts`: Review submission with EWMA scoring
- `apps/api/src/lib/prompt-engine.ts`: Template selection (`selectTemplate`), hydration context assembly, Handlebars compilation
- `apps/api/src/lib/priority-scoring.ts`: Deterministic scoring — priority weight, type bonus, goal alignment, age bonus
- `apps/api/src/app.ts`: Hono app setup with middleware injection and route mounting
- `apps/api/src/types.ts`: `AppEnv` type (Hono context with injected db), `AnyDb` type
- `apps/app/src/App.tsx`: Placeholder component — "Loop: The Autonomous Improvement Engine"
- `apps/app/package.json`: Only `react@^19`, `react-dom@^19` as runtime dependencies; `vite@^6`, `tailwindcss@^4`, `@tailwindcss/vite@^4` as dev dependencies
- `apps/app/vite.config.ts`: Vite 6 + React plugin + Tailwind CSS Vite plugin + `@/` alias
- `apps/app/tsconfig.json`: Strict mode, `@/*` path alias to `./src/*`
- `apps/app/src/index.css`: Single `@import 'tailwindcss'` entry

---

## 3) Codebase Map

### API — Schema & Routes (Complete from Phases 1 & 2)

**Schema files** (`apps/api/src/db/schema/`):

- `_helpers.ts` — Shared `cuid2Id`, `timestamps`, `softDelete` column builders
- `issues.ts` — `issues`, `labels`, `issueLabels`, `issueRelations`, `comments` tables
- `projects.ts` — `projects`, `goals` tables
- `signals.ts` — `signals` table
- `prompts.ts` — `promptTemplates`, `promptVersions`, `promptReviews` tables

**Route files** (`apps/api/src/routes/`):

- `issues.ts` (288 LOC) — Full CRUD with filtering and pagination
- `projects.ts` (193 LOC) — CRUD with goal validation
- `goals.ts` (132 LOC) — CRUD
- `labels.ts` (94 LOC) — CRUD
- `comments.ts` (103 LOC) — Threaded comments nested under issues
- `relations.ts` (93 LOC) — Issue relations (blocks/blocked_by)
- `signals.ts` (88 LOC) — Generic signal ingestion
- `templates.ts` (475 LOC) — Template CRUD + versioning + preview endpoint
- `prompt-reviews.ts` (187 LOC) — Review submission with EWMA scoring
- `dispatch.ts` (357 LOC) — Dispatch next (atomic claim) and queue preview
- `webhooks.ts` (212 LOC) — PostHog, GitHub, Sentry handlers

**Core libraries** (`apps/api/src/lib/`):

- `prompt-engine.ts` — Template selection, hydration context, Handlebars rendering
- `priority-scoring.ts` — Deterministic scoring algorithm
- `partials.ts` — Shared Handlebars partials

### Frontend — Current State (Clean Slate)

```
apps/app/src/
├── main.tsx          # Entry point — renders <App /> into #root
├── App.tsx           # Placeholder ("Loop: The Autonomous Improvement Engine")
└── index.css         # @import 'tailwindcss'
```

**Installed:** React 19, Vite 6, Tailwind CSS 4
**Missing:** Router, data fetching, component library, icons, markdown renderer, API client

### Shared Dependencies

- No shared type package between API and frontend
- No shared config package
- ESLint config covers both apps with React-specific rules for `apps/app/`
- Prettier with `prettier-plugin-tailwindcss` for class sorting

### Data Flow

- All API routes protected by `Authorization: Bearer <LOOP_API_KEY>` (timing-safe comparison)
- Request validation via Zod (`@hono/zod-validator`)
- Responses follow `{ data, total }` pattern for lists, `{ data }` for single items
- Pagination via `?page=&limit=` query params
- Soft delete on all entities (filtering `deletedAt IS NULL`)
- Database queries use `Promise.all()` for parallel execution

### Potential Blast Radius

**Files to create (frontend — ~25-30 new files):**

- Route definitions (5 page routes + 2 layout routes)
- API client module
- Query key factory and queryOptions definitions
- shadcn/ui component installations
- Custom components (sidebar, table columns, timeline, markdown renderer)
- Type definitions for API responses

**Files to create (API — 1 new file):**

- `apps/api/src/routes/dashboard.ts` — 3 new endpoints

**Files to modify:**

- `apps/app/package.json` — Add ~10 new dependencies
- `apps/app/src/main.tsx` — Router provider setup
- `apps/app/src/App.tsx` — Replace placeholder with router outlet
- `apps/app/src/index.css` — Add `@plugin` directives
- `apps/api/src/app.ts` — Mount dashboard routes

---

## 4) Root Cause Analysis

N/A — this is not a bug fix.

---

## 5) Research

Research was performed by a parallel agent and saved to `research/20260220_mvp-phase-3-react-dashboard.md`. Key findings and recommendations:

### Potential Solutions

**1. Routing: TanStack Router (recommended) vs React Router v7**

- **TanStack Router v1:** Fully typed search params with Zod validation, file-based routing via Vite plugin, native `queryOptions` integration with TanStack Query for route-level prefetching, pathless layout routes for shared dashboard chrome. The search-param-as-typed-state story is the correct foundation for the filter-heavy Issue List view.
- **React Router v7:** Larger ecosystem and more familiar, but advanced type safety and search param management only work in "framework mode" (Remix-style SSR), not in the plain SPA library mode.
- **Recommendation:** TanStack Router. The Issue List's filter state (status, type, project, label, priority, page) naturally maps to URL search params. TanStack Router makes this a one-liner; React Router requires custom hooks.
- Complexity: Medium | Maintenance: Low

**2. API Client: `ky` (recommended) vs Axios vs raw `fetch`**

- **`ky`:** 4KB (vs Axios at 14KB), thin wrapper over native `fetch`, built-in hooks for auth headers and error transformation, `searchParams` option handles URL encoding, `.json<T>()` provides typed responses
- **Axios:** Familiar, large ecosystem, but XHR-based and 3.5x larger
- **Raw `fetch`:** Zero dependencies but verbose — requires manual JSON parsing, error handling, header injection
- **Recommendation:** Typed `ky` instance in `src/lib/api-client.ts` with `prefixUrl` and `Authorization` header pre-configured
- Complexity: Low | Maintenance: Low

**3. Data Table: shadcn/ui Table + TanStack Table v8 (only viable approach)**

- shadcn/ui provides a `Table` primitive, not a full data table. The documented pattern assembles it with `@tanstack/react-table`: `ColumnDef<T>[]` definitions, `useReactTable` with manual pagination/filtering/sorting, and `flexRender` for cell output
- Server-side mode: URL search params drive the TanStack Query query key, which triggers refetches on every filter/sort/page change
- Loading state: skeleton rows during `isFetching` rather than a full-page spinner
- Complexity: Medium | Maintenance: Low

**4. Timeline/Activity Feed: Pure CSS timeline (recommended)**

- Vertical `ol` with `border-l border-border`, absolutely-positioned icon dots, mapped from `timelineData` array
- OriginUI provides copy-paste timeline components built with Tailwind and no extra dependencies
- No third-party timeline library needed
- Real-time updates: `refetchInterval: 15_000` on the activity query (one-liner, zero API changes)
- Complexity: Low | Maintenance: Low

**5. Dashboard Layout: shadcn/ui Sidebar (only viable approach)**

- shadcn/ui v1 ships a first-class `Sidebar` component system: `SidebarProvider`, `SidebarTrigger`, `SidebarMenu`, collapsible modes (`icon`/`offcanvas`/`none`)
- Desktop: `icon` mode — collapses to icon strip, restores on hover or toggle
- Mobile: `offcanvas` mode — slides in as a sheet drawer
- CSS variable-driven widths, keyboard shortcut support, `useSidebar()` hook
- Complexity: Low | Maintenance: Low

**6. Markdown Rendering: `react-markdown` + `rehype-pretty-code` (recommended)**

- `react-markdown` with `remark-gfm` for GitHub Flavored Markdown
- `rehype-pretty-code` (Shiki-powered) for syntax highlighting
- `@tailwindcss/typography` for typographic styles via `prose` class
- Tailwind CSS v4 supports the typography plugin via `@plugin "@tailwindcss/typography"` — no config file change
- Complexity: Low | Maintenance: Low

### Security Considerations

- `VITE_LOOP_API_KEY` embeds in the JS bundle — acceptable for internal tool behind Vercel deployment protection; not for public multi-tenant deployment
- CORS: whitelist `http://localhost:3000` and `https://app.looped.me` only via Hono `cors()` middleware
- Markdown XSS: `react-markdown` is safe by default — do not add `rehype-raw` plugin

### Performance Considerations

- Route-level code splitting via `createLazyFileRoute` on all dashboard views
- Shiki web bundle with on-demand grammar loading (or PrismLight fallback at ~50KB)
- Per-resource staleTime tuning: 30s for issue list, 5min for templates/goals
- Recharts lazy-loaded only when Prompt Health view is rendered

### Recommended Architecture

```
apps/app/src/
├── routes/
│   ├── __root.tsx                # QueryClientProvider + SidebarProvider + DevTools
│   ├── _dashboard.tsx            # AppShell layout (sidebar + header + main)
│   └── _dashboard/
│       ├── index.tsx             # Redirect to /issues
│       ├── issues/
│       │   ├── index.tsx         # Issue List — server-side filtered table
│       │   └── $issueId.tsx      # Issue Detail — full page
│       ├── activity/
│       │   └── index.tsx         # Loop Activity — polling timeline
│       ├── goals/
│       │   └── index.tsx         # Goals Dashboard — progress cards
│       └── prompts/
│           └── index.tsx         # Prompt Health — score cards + mini charts
├── lib/
│   ├── api-client.ts             # Typed ky instance + resource namespaces
│   ├── query-keys.ts             # Query key factory functions
│   └── queries/                  # queryOptions() per resource
├── components/
│   ├── ui/                       # shadcn/ui installed components
│   ├── app-sidebar.tsx           # SidebarMenu with nav items
│   ├── issue-table/              # DataTable columns + component
│   ├── activity-timeline.tsx     # CSS timeline
│   └── markdown-content.tsx      # react-markdown wrapper
├── types/                        # API response types
└── index.css                     # @import "tailwindcss"; @plugin "@tailwindcss/typography";
```

---

## 6) Clarification

1. **Issue Detail: full page route vs side panel?** The research recommends a full-page route (`/issues/:id`) for the MVP because it's deep-linkable and avoids z-index/scroll-lock complexity. A slide-over `Sheet` can be layered on later. Do you have a preference? (Linear uses a side panel; GitHub uses a full page.)

2. **Dark mode?** The placeholder `App.tsx` uses `bg-neutral-950 text-white` suggesting a dark theme preference. Should the dashboard support:
   - Dark mode only (simpler, matches the "Loop" aesthetic)
   - Light + dark mode with system preference detection
   - Light mode only

3. **API key delivery to the frontend:** For the MVP, the simplest approach is `VITE_LOOP_API_KEY` as an environment variable baked into the build. This means the key is in the JS bundle — acceptable for an internal tool behind Vercel deployment protection. Is this acceptable, or do you want a login page with session-based auth from the start?

4. **Charts on Prompt Health view:** The spec mentions "version history with changelogs" and review score metrics. Should we include actual charts (sparklines showing score trends over time) using shadcn/ui's Recharts-based chart components, or are numeric displays with badges (e.g., "4.2/5 avg clarity") sufficient for the MVP?

5. **CORS configuration:** The Hono API currently has no CORS middleware. We'll need to add it so the frontend at `localhost:3000` (dev) and `app.looped.me` (prod) can call the API. Should we add CORS to the API as part of this phase, or is it already handled elsewhere?

6. **Loop Activity data shape:** The `GET /api/dashboard/loop` endpoint needs to return "signal chains" — linked groups of issues showing the progression from signal → hypothesis → tasks → outcome. The current API returns issues with parent/child relationships. Should the dashboard endpoint:
   - Return pre-assembled chains (API does the grouping by walking parent/child + relation links)
   - Return recent issues and let the frontend group them by `parentId` (simpler API, more frontend logic)
