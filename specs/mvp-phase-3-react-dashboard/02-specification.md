---
slug: mvp-phase-3-react-dashboard
number: 4
created: 2026-02-20
status: draft
---

# Specification: React Dashboard (MVP Phase 3)

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-20
**Ideation:** `specs/mvp-phase-3-react-dashboard/01-ideation.md`
**Phase 2 Spec:** `specs/prompt-dispatch-engine/02-specification.md`

---

## Overview

Build the React dashboard for Loop: 5 views (Issue List, Issue Detail, Loop Activity, Goals Dashboard, Prompt Health) in the existing `apps/app/` React 19 + Vite 6 + Tailwind CSS 4 app, plus 3 new dashboard API endpoints and CORS middleware in `apps/api/`. The dashboard is the visibility layer into the autonomous improvement loop, providing a read-heavy interface for monitoring signals, issues, dispatch activity, goal progress, and prompt quality.

---

## Background / Problem Statement

Phases 1 and 2 established Loop's complete backend: 11 database tables, CRUD endpoints for all entities, signal ingestion, webhook handlers, a prompt engine with Handlebars template selection and hydration, atomic dispatch via `FOR UPDATE SKIP LOCKED`, EWMA-based review scoring, and auto-improvement issue creation.

However, there is no way for humans to observe the loop in action. The API is designed for agent consumption — agents pull work from `/api/dispatch/next` and report results back. Without a dashboard:

- Operators cannot see what signals have been ingested or what issues exist
- There is no visibility into the dispatch queue or what agents are working on
- Goal progress is only accessible via raw API calls
- Prompt quality trends are invisible — the EWMA scoring and improvement issue creation happens silently
- The core value proposition ("autonomous improvement loop") cannot be demonstrated

The dashboard transforms Loop from an invisible API into a visible, monitorable system.

---

## Goals

- Build 5 dashboard views rendering data from the existing API
- Add 3 new aggregation endpoints for dashboard-specific data needs
- Add CORS middleware to the Hono API for frontend access
- Use TanStack Router for file-based routing with typed URL search params
- Use TanStack Query for data fetching with per-resource cache tuning
- Use shadcn/ui for consistent, accessible UI components (dark mode only)
- Implement server-side filtering, sorting, and pagination on Issue List
- Display pre-assembled signal chains in the Loop Activity timeline
- Show prompt quality trends with sparkline charts
- Support responsive layout with collapsible sidebar

## Non-Goals

- CLI tool (Phase 4 — independent, can be built in parallel)
- Prompt template editing UX (post-MVP)
- Custom/saved views or filters (post-MVP)
- Multi-user authentication (post-MVP — single API key is sufficient)
- Real-time updates via SSE/WebSocket (polling via `refetchInterval` is sufficient for MVP)
- Inline issue creation or editing from the dashboard
- Light mode or theme toggle (dark mode only)
- Shared type package between API and frontend (manual type definitions for MVP)
- SSR — this is a client-side SPA

---

## Technical Dependencies

### New Dependencies (`apps/app/`)

| Package | Purpose | Version |
|---------|---------|---------|
| `@tanstack/react-router` | File-based routing with typed search params | `^1` |
| `@tanstack/react-router-vite-plugin` | Vite plugin for file-based route generation | `^1` |
| `@tanstack/zod-adapter` | Zod validation for route search params | `^1` |
| `@tanstack/react-query` | Data fetching, caching, polling | `^5` |
| `@tanstack/react-query-devtools` | Dev tools for query debugging | `^5` |
| `@tanstack/react-table` | Headless table with sorting, filtering, pagination | `^8` |
| `ky` | Lightweight fetch wrapper (4KB) | `^1` |
| `zod` | Schema validation for search params and API types | `^3` |
| `react-markdown` | Markdown rendering | `^9` |
| `remark-gfm` | GitHub Flavored Markdown support | `^4` |
| `rehype-pretty-code` | Syntax highlighting (Shiki-powered) | `^0.14` |
| `recharts` | Charts for Prompt Health sparklines | `^2` |
| `lucide-react` | Icons (included with shadcn/ui) | `^0.460` |
| `class-variance-authority` | Component variants (shadcn/ui dependency) | `^0.7` |
| `clsx` | Conditional classes (shadcn/ui dependency) | `^2` |
| `tailwind-merge` | Merge Tailwind classes (shadcn/ui dependency) | `^2` |
| `@tailwindcss/typography` | Prose styling for markdown content | `^0.5` |

### New Dependencies (`apps/api/`)

| Package | Purpose | Version |
|---------|---------|---------|
| `@hono/cors` | CORS middleware for Hono | `^1` |

### Existing Dependencies (already installed)

- React 19, React DOM 19
- Vite 6, `@vitejs/plugin-react`
- Tailwind CSS 4, `@tailwindcss/vite`
- TypeScript 5

### shadcn/ui Components (installed via CLI)

`sidebar`, `table`, `badge`, `button`, `card`, `input`, `select`, `separator`, `skeleton`, `tooltip`, `chart`, `sheet` (mobile sidebar), `scroll-area`, `dropdown-menu`, `avatar`

---

## Detailed Design

### Architecture

```
apps/app/src/
├── routes/                          # TanStack Router file-based routes
│   ├── __root.tsx                   # Root layout: QueryClientProvider, SidebarProvider
│   ├── _dashboard.tsx               # Pathless layout: sidebar + header + <Outlet />
│   └── _dashboard/
│       ├── index.tsx                # Redirect → /issues
│       ├── issues/
│       │   ├── index.tsx            # Issue List (filterable table)
│       │   └── $issueId.tsx         # Issue Detail (full page)
│       ├── activity/
│       │   └── index.tsx            # Loop Activity (timeline)
│       ├── goals/
│       │   └── index.tsx            # Goals Dashboard (progress cards)
│       └── prompts/
│           └── index.tsx            # Prompt Health (metrics + sparklines)
├── lib/
│   ├── api-client.ts                # Typed ky instance with auth
│   ├── query-client.ts              # QueryClient with default options
│   ├── query-keys.ts                # Query key factory
│   └── queries/
│       ├── issues.ts                # Issue queryOptions
│       ├── projects.ts              # Project queryOptions
│       ├── goals.ts                 # Goal queryOptions
│       ├── labels.ts                # Label queryOptions
│       ├── templates.ts             # Template queryOptions
│       └── dashboard.ts             # Dashboard endpoint queryOptions
├── components/
│   ├── ui/                          # shadcn/ui installed components
│   ├── app-sidebar.tsx              # Sidebar navigation
│   ├── issue-table/
│   │   ├── columns.tsx              # TanStack Table column definitions
│   │   └── data-table.tsx           # Table component with pagination
│   ├── issue-detail/
│   │   ├── issue-header.tsx         # Type/status/priority badges
│   │   ├── issue-metadata.tsx       # Project, labels, dates
│   │   ├── issue-relations.tsx      # Blocking/blocked-by links
│   │   ├── issue-children.tsx       # Child issues list
│   │   ├── issue-agent-results.tsx  # Summary, commits, PRs
│   │   └── issue-comments.tsx       # Threaded comments
│   ├── activity-timeline.tsx        # CSS-based timeline
│   ├── goal-card.tsx                # Goal progress card
│   ├── prompt-card.tsx              # Template health card
│   ├── score-sparkline.tsx          # Recharts AreaChart wrapper
│   └── markdown-content.tsx         # react-markdown wrapper
├── types/
│   ├── issues.ts                    # Issue, Label, Comment, Relation types
│   ├── projects.ts                  # Project, Goal types
│   ├── prompts.ts                   # Template, Version, Review types
│   └── dashboard.ts                 # Dashboard endpoint response types
└── index.css                        # Tailwind imports + plugins
```

### API Client (`lib/api-client.ts`)

A typed `ky` instance with the API base URL and auth header pre-configured:

```typescript
import ky from 'ky'

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4242',
  headers: {
    Authorization: `Bearer ${import.meta.env.VITE_LOOP_API_KEY}`,
  },
  hooks: {
    afterResponse: [
      async (_request, _options, response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(body.error ?? `API error: ${response.status}`)
        }
      },
    ],
  },
})
```

Resource-specific helpers provide typed responses:

```typescript
import type { Issue, PaginatedResponse } from '@/types/issues'

export const issuesApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/issues', { searchParams: params }).json<PaginatedResponse<Issue>>(),
  get: (id: string) =>
    api.get(`api/issues/${id}`).json<{ data: Issue }>(),
}
```

### Query Key Factory (`lib/query-keys.ts`)

Hierarchical key factory for consistent cache invalidation:

```typescript
export const queryKeys = {
  issues: {
    all: ['issues'] as const,
    lists: () => [...queryKeys.issues.all, 'list'] as const,
    list: (filters: Record<string, unknown>) =>
      [...queryKeys.issues.lists(), filters] as const,
    details: () => [...queryKeys.issues.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.issues.details(), id] as const,
  },
  projects: {
    all: ['projects'] as const,
    list: () => [...queryKeys.projects.all, 'list'] as const,
  },
  goals: {
    all: ['goals'] as const,
    list: () => [...queryKeys.goals.all, 'list'] as const,
  },
  labels: {
    all: ['labels'] as const,
    list: () => [...queryKeys.labels.all, 'list'] as const,
  },
  templates: {
    all: ['templates'] as const,
    list: () => [...queryKeys.templates.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.templates.all, 'detail', id] as const,
    versions: (id: string) => [...queryKeys.templates.all, 'versions', id] as const,
    reviews: (id: string) => [...queryKeys.templates.all, 'reviews', id] as const,
  },
  dashboard: {
    stats: ['dashboard', 'stats'] as const,
    activity: ['dashboard', 'activity'] as const,
    prompts: ['dashboard', 'prompts'] as const,
  },
} as const
```

### Query Options (`lib/queries/`)

Each resource module exports `queryOptions()` definitions:

```typescript
import { queryOptions } from '@tanstack/react-query'

export const issueListOptions = (filters: Record<string, string>) =>
  queryOptions({
    queryKey: queryKeys.issues.list(filters),
    queryFn: () => issuesApi.list(filters),
    staleTime: 30_000,
  })

export const issueDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.issues.detail(id),
    queryFn: () => issuesApi.get(id).then((r) => r.data),
    staleTime: 30_000,
  })
```

Cache tuning per resource:

| Resource | `staleTime` | `refetchInterval` | Rationale |
|----------|-------------|-------------------|-----------|
| Issue list | 30s | — | Changes frequently as agents work |
| Issue detail | 30s | — | Agent updates arrive regularly |
| Projects | 5min | — | Rarely changes |
| Goals | 5min | — | Updated by agents periodically |
| Labels | 10min | — | Almost never changes |
| Templates | 5min | — | Rarely changes |
| Dashboard stats | 30s | — | Reflects overall system state |
| Dashboard activity | 30s | 15s | Polling for live activity feed |
| Dashboard prompts | 5min | — | Prompt quality changes slowly |

### Routing

TanStack Router v1 with the Vite plugin for file-based route generation. Vite config updated to include the router plugin:

```typescript
// vite.config.ts
import { TanStackRouterVite } from '@tanstack/react-router-vite-plugin'

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
})
```

**Root route** (`__root.tsx`): Wraps the entire app with `QueryClientProvider` and renders `<Outlet />`. Query devtools included in development.

**Dashboard layout** (`_dashboard.tsx`): Pathless layout route that renders the sidebar, header, and main content area. All dashboard routes are children of this layout.

**Issue List search params** validated with Zod via `@tanstack/zod-adapter`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator, fallback } from '@tanstack/zod-adapter'
import { z } from 'zod'

const issueSearchSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  projectId: z.string().optional(),
  labelId: z.string().optional(),
  priority: fallback(z.coerce.number(), undefined).optional(),
  page: fallback(z.coerce.number(), 1).default(1),
  limit: fallback(z.coerce.number(), 50).default(50),
})

export const Route = createFileRoute('/_dashboard/issues/')({
  validateSearch: zodValidator(issueSearchSchema),
})
```

This gives fully typed, URL-persisted filter state. Navigation via `<Link>` with `search` prop updates filters and triggers TanStack Query refetches automatically.

### Dashboard API Endpoints

Three new aggregation endpoints in `apps/api/src/routes/dashboard.ts`, mounted as `api.route('/dashboard', dashboardRoutes)` in `app.ts`.

#### `GET /api/dashboard/stats`

Returns overall system health metrics for the sidebar or header:

```typescript
// Response shape
{
  data: {
    issues: {
      total: number
      byStatus: Record<IssueStatus, number>
      byType: Record<IssueType, number>
    }
    goals: {
      total: number
      active: number
      achieved: number
    }
    dispatch: {
      queueDepth: number          // Issues in todo/backlog eligible for dispatch
      activeCount: number         // Issues currently in_progress
      completedLast24h: number    // Issues moved to done in last 24 hours
    }
  }
}
```

**Implementation:** Parallel `Promise.all()` with `count()` aggregation queries. Single SQL query per category using Drizzle's `sql` template for `GROUP BY` aggregations.

#### `GET /api/dashboard/activity`

Returns pre-assembled signal chains for the Loop Activity view. Each chain starts from a root issue (signal or hypothesis with no parent) and includes all descendants.

Query params: `?limit=20` (number of chains, default 20)

```typescript
// Response shape
{
  data: Array<{
    root: Issue                   // The signal or top-level issue
    children: Array<{
      issue: Issue
      relations: IssueRelation[]  // blocking/blocked-by within the chain
    }>
    latestActivity: string        // ISO timestamp of most recent update in chain
  }>
  total: number
}
```

**Implementation:**
1. Query root issues (parentId IS NULL) ordered by `updatedAt DESC`, limit to N
2. For each root, query children (`parentId = root.id`) with their relations
3. Assemble chains in application code
4. Sort chains by `latestActivity` (most recent update across all chain members)

This runs 1 + N queries (N = chain count). For 20 chains this is 21 queries, acceptable for MVP. Can be optimized with a CTE or lateral join later.

#### `GET /api/dashboard/prompts`

Returns prompt template health data with version history and review scores:

```typescript
// Response shape
{
  data: Array<{
    template: PromptTemplate
    activeVersion: PromptVersion | null
    recentVersions: PromptVersion[]  // Last 5 versions with scores
    reviewSummary: {
      totalReviews: number
      avgClarity: number | null
      avgCompleteness: number | null
      avgRelevance: number | null
      compositeScore: number | null  // EWMA score from active version
    }
    needsAttention: boolean          // compositeScore < 3.0 or completionRate < 0.5
  }>
}
```

**Implementation:** Join `promptTemplates` → `promptVersions` (last 5 per template) → `promptReviews` (aggregated). Use `Promise.all()` for parallel subqueries per template.

### CORS Middleware

Add CORS to the Hono API in `apps/api/src/app.ts`:

```typescript
import { cors } from 'hono/cors'

app.use('*', cors({
  origin: [
    'http://localhost:3000',
    'https://app.looped.me',
  ],
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86400,
}))
```

Note: Hono includes a built-in `cors` middleware — no extra package needed.

### View Designs

#### View 1: Issue List (`/_dashboard/issues/index.tsx`)

**Layout:** Full-width table with filter controls above.

**Filter bar:** Horizontal row of `<Select>` dropdowns for status, type, project, label, and priority. Each maps to a URL search param via TanStack Router's `useSearch()`. Changing a filter navigates with updated search params, which updates the TanStack Query key and triggers a refetch.

**Table:** TanStack Table v8 in manual/server-side mode. Column definitions in a separate `columns.tsx` file:

| Column | Width | Content |
|--------|-------|---------|
| Number | 80px | `#${number}` monospace |
| Title | flex | Title text, truncated with tooltip |
| Type | 100px | `<Badge>` with icon + color per type |
| Status | 120px | `<Badge>` with status color |
| Priority | 80px | Priority indicator (P0-P4) |
| Project | 140px | Project name or "—" |
| Labels | 160px | Up to 2 label badges, "+N" overflow |
| Updated | 120px | Relative time ("2h ago") |

**Type badge colors:**

| Type | Color | Icon |
|------|-------|------|
| signal | amber | `Zap` |
| hypothesis | violet | `Lightbulb` |
| plan | blue | `Map` |
| task | emerald | `CheckSquare` |
| monitor | cyan | `Eye` |

**Status badge colors:**

| Status | Color |
|--------|-------|
| triage | yellow |
| backlog | slate |
| todo | blue |
| in_progress | indigo |
| done | green |
| canceled | red |

**Pagination:** Bottom bar with page info ("Showing 1-50 of 234") and Previous/Next buttons. Controlled via `page` and `limit` search params.

**Loading state:** Skeleton rows (8 rows) matching column layout during `isFetching`.

**Empty state:** Centered message "No issues found" with suggestion to adjust filters.

**Row click:** Navigates to `/issues/${issue.id}` via TanStack Router `<Link>`.

#### View 2: Issue Detail (`/_dashboard/issues/$issueId.tsx`)

**Layout:** Full-page route. Two-column layout on desktop (main content left, metadata sidebar right), single column on mobile.

**Left column (main content):**

1. **Header:** Issue number + title, type badge, status badge
2. **Description:** Rendered via `<MarkdownContent>` component (react-markdown + remark-gfm + rehype-pretty-code). Wrapped in `prose prose-invert` class from `@tailwindcss/typography`.
3. **Signal data** (if `type === 'signal'`): Source badge, raw payload in collapsible `<pre>` block
4. **Hypothesis data** (if `type === 'hypothesis'`): Statement, confidence meter (0-1 scale), evidence list, validation criteria
5. **Agent results** (if `agentSummary` or `commits` or `pullRequests` exist): Summary text, commit list with SHA links, PR list with status badges
6. **Children** (if any): Compact list of child issues with type/status badges, clickable
7. **Comments:** Threaded display. Each comment shows author name, author type badge (human/agent), relative time, body text. Threaded via `parentId` — replies indented under parent.

**Right column (metadata sidebar):**

- Priority (P0-P4 with label)
- Status
- Type
- Project (linked)
- Labels (as badges)
- Parent issue (if child — linked)
- Relations: "Blocks" and "Blocked by" lists with issue links
- Created / Updated timestamps

**Back navigation:** "Back to Issues" link at top.

**Loading state:** Skeleton layout matching the two-column structure.

**Error state:** "Issue not found" message with link back to issue list.

#### View 3: Loop Activity (`/_dashboard/activity/index.tsx`)

**Layout:** Vertical timeline, centered on page with max-width.

**Data source:** `GET /api/dashboard/activity` with `refetchInterval: 15_000` for polling.

**Timeline structure:** Each chain is a group. Within each group, issues are displayed chronologically as timeline nodes:

```
● Signal #31 — "PostHog: conversion rate dropped 12%"      [2h ago]
│   Source: posthog · Severity: high
│
├── ● Hypothesis #35 — "OAuth redirect causing friction"    [1h 45m ago]
│   │   Confidence: 0.82
│   │
│   ├── ● Task #42 — "Add loading spinner to OAuth flow"   [1h 30m ago]
│   │       Status: done · PR #851 merged
│   │
│   └── ● Monitor #46 — "Watch conversion for 48h"         [45m ago]
│           Status: in_progress
│
└── Chain status: In Progress
```

**CSS implementation:** Vertical `<ol>` with `border-l border-neutral-700`. Each node is an `<li>` with:
- Absolutely positioned dot/icon aligned to the border
- Type-colored icon (same colors as Issue List type badges)
- Issue title, number, and relative timestamp
- Status badge
- Key metadata inline (source, confidence, PR links)

**Empty state:** "No activity yet — the loop is waiting for signals" with illustration.

**Chain status indicator:** Derived from child statuses — "Complete" if all done/canceled, "In Progress" if any in_progress, "Pending" otherwise.

#### View 4: Goals Dashboard (`/_dashboard/goals/index.tsx`)

**Layout:** Grid of goal cards (2 columns on desktop, 1 on mobile).

**Goal card** (`<GoalCard>`):
- Title (bold)
- Metric label + unit (e.g., "Conversion Rate (%)")
- Progress bar: `currentValue / targetValue` as percentage, colored by progress (green > 75%, yellow 25-75%, red < 25%)
- Current value / target value as numbers
- Trend indicator: Up/down/flat arrow comparing current to previous (derived from recent issue activity — if currentValue changed in last 7 days, show direction)
- Status badge (active/achieved/abandoned)
- Linked project name + status
- Contributing issues count (from issues with matching `projectId`)

**Data sources:** `GET /api/goals` for goal list, `GET /api/projects` for project details, `GET /api/dashboard/stats` for issue counts.

**Empty state:** "No goals defined yet" message.

#### View 5: Prompt Health (`/_dashboard/prompts/index.tsx`)

**Layout:** Grid of template cards (1 column, full width — each card has substantial content).

**Template card** (`<PromptCard>`):

**Header row:**
- Template name + slug
- Active version number badge
- "Needs attention" warning badge (if `compositeScore < 3.0` or `completionRate < 0.5`)

**Metrics row** (4 metrics in a horizontal grid):
- Usage count (number with label)
- Completion rate (percentage with color coding)
- Composite score (number/5 with color coding)
- Total reviews (number)

**Score breakdown:**
- Clarity / Completeness / Relevance as individual scores (1-5)
- Each with a subtle inline bar indicator

**Sparkline chart** (`<ScoreSparkline>`):
- shadcn/ui `<ChartContainer>` with Recharts `<AreaChart>`
- Shows composite score trend across the last 5 versions
- X-axis: version numbers, Y-axis: score (1-5)
- Gradient fill matching the score color (green above 3.5, amber 2.5-3.5, red below 2.5)

**Version history** (collapsible):
- Last 5 versions in a compact list
- Version number, status badge, changelog text, author
- Usage count and completion rate per version

**Data source:** `GET /api/dashboard/prompts`.

### Sidebar Navigation (`components/app-sidebar.tsx`)

Uses shadcn/ui `Sidebar` component system:

```
┌──────────────────┐
│  ◉ Loop          │  ← Logo/brand
│                  │
│  Issues          │  ← /issues (ListIcon)
│  Activity        │  ← /activity (ActivityIcon)
│  Goals           │  ← /goals (TargetIcon)
│  Prompts         │  ← /prompts (SparklesIcon)
│                  │
│  ───────────     │
│  Queue: 12       │  ← From dashboard/stats
│  Active: 3       │  ← From dashboard/stats
│  Done (24h): 8   │  ← From dashboard/stats
└──────────────────┘
```

**Behavior:**
- Desktop: `icon` collapsible mode — collapses to icon strip, expands on hover or toggle
- Mobile: `offcanvas` mode — slides in as a sheet overlay
- Keyboard shortcut: `Cmd+B` to toggle
- Active route highlighted with `data-active` attribute

### Dark Mode

Dark mode only. CSS variables set on `:root` in `index.css`:

```css
@import 'tailwindcss';
@plugin '@tailwindcss/typography';

:root {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  --card: 0 0% 6%;
  --card-foreground: 0 0% 98%;
  --popover: 0 0% 6%;
  --popover-foreground: 0 0% 98%;
  --primary: 0 0% 98%;
  --primary-foreground: 0 0% 9%;
  --secondary: 0 0% 14.9%;
  --secondary-foreground: 0 0% 98%;
  --muted: 0 0% 14.9%;
  --muted-foreground: 0 0% 63.9%;
  --accent: 0 0% 14.9%;
  --accent-foreground: 0 0% 98%;
  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 14.9%;
  --input: 0 0% 14.9%;
  --ring: 0 0% 83.1%;
  --sidebar-background: 0 0% 5%;
  --sidebar-foreground: 0 0% 90%;
  --sidebar-primary: 0 0% 98%;
  --sidebar-primary-foreground: 0 0% 9%;
  --sidebar-accent: 0 0% 12%;
  --sidebar-accent-foreground: 0 0% 90%;
  --sidebar-border: 0 0% 14.9%;
  --chart-1: 220 70% 50%;
  --chart-2: 160 60% 45%;
  --chart-3: 30 80% 55%;
  --chart-4: 280 65% 60%;
  --chart-5: 340 75% 55%;
  --radius: 0.5rem;
}

body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

`<html>` element gets `class="dark"` in `index.html` to enable dark mode throughout shadcn/ui components.

### Type Definitions (`types/`)

Frontend types mirror the API response shapes. These are manually maintained for MVP (no codegen).

```typescript
// types/issues.ts
export type IssueType = 'signal' | 'hypothesis' | 'plan' | 'task' | 'monitor'
export type IssueStatus = 'triage' | 'backlog' | 'todo' | 'in_progress' | 'done' | 'canceled'
export type RelationType = 'blocks' | 'blocked_by' | 'related' | 'duplicate'
export type AuthorType = 'human' | 'agent'

export interface Issue {
  id: string
  number: number
  title: string
  description: string | null
  type: IssueType
  status: IssueStatus
  priority: number
  parentId: string | null
  projectId: string | null
  signalSource: string | null
  signalPayload: Record<string, unknown> | null
  hypothesis: HypothesisData | null
  agentSessionId: string | null
  agentSummary: string | null
  commits: CommitRef[] | null
  pullRequests: PullRequestRef[] | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  // Populated on detail endpoint
  labels?: Label[]
  relations?: IssueRelation[]
  comments?: Comment[]
  children?: Issue[]
  parent?: Issue | null
}

export interface HypothesisData {
  statement: string
  confidence: number
  evidence: string[]
  validationCriteria: string
  prediction?: string
}

export interface CommitRef {
  sha: string
  message: string
  url: string
  author: string
  timestamp: string
}

export interface PullRequestRef {
  number: number
  title: string
  url: string
  state: string
  mergedAt: string | null
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface IssueRelation {
  id: string
  type: RelationType
  issueId: string
  relatedIssueId: string
  relatedIssue?: Issue
}

export interface Comment {
  id: string
  body: string
  issueId: string
  authorName: string
  authorType: AuthorType
  parentId: string | null
  createdAt: string
  children?: Comment[]
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
}
```

Similar type files for `projects.ts`, `prompts.ts`, and `dashboard.ts`.

### Entry Point Changes

**`main.tsx`:** Replace direct `<App>` render with TanStack Router:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './index.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
```

**`App.tsx`:** No longer needed — the root route handles the app shell.

### Markdown Rendering (`components/markdown-content.tsx`)

Wrapper component for rendering markdown with GFM support and syntax highlighting:

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypePrettyCode from 'rehype-pretty-code'

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypePrettyCode, { theme: 'github-dark' }]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

No `rehype-raw` plugin — prevents XSS from untrusted markdown content.

---

## User Experience

### Navigation Flow

1. User opens `app.looped.me` → redirected to `/issues` (default view)
2. Sidebar shows 4 navigation items: Issues, Activity, Goals, Prompts
3. Sidebar footer shows live stats: queue depth, active issues, completed today
4. All views load with skeleton states, then populate with data
5. Issue List filters are URL-persisted — shareable and bookmarkable
6. Clicking an issue row navigates to full-page detail with back button

### Responsive Behavior

| Breakpoint | Sidebar | Layout |
|------------|---------|--------|
| >= 1024px (lg) | Icon strip (collapsible) | Full sidebar + main content |
| < 1024px | Hidden, offcanvas on toggle | Full-width main content |

### Loading States

- **Initial page load:** Full skeleton layout matching the final UI structure
- **Data fetching:** Per-section skeleton (e.g., table rows skeleton while table loads)
- **Background refetch:** No loading indicator (stale data shown while refetching via TanStack Query's `staleTime`)
- **Error state:** Inline error message with retry button

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Toggle sidebar |

---

## Testing Strategy

### Unit Tests

**API route tests** (`apps/api/src/__tests__/dashboard.test.ts`):
- Test each dashboard endpoint returns correct response shape
- Test stats aggregation produces accurate counts
- Test activity chains are correctly assembled (parent-child grouping)
- Test prompts endpoint includes review score calculations
- Test CORS headers are present on responses
- Use existing `withTestDb()` PGlite infrastructure

**Frontend component tests** (Vitest + Testing Library):
- `issue-table/columns.tsx`: Column definitions render correct cell content for each type/status/priority
- `activity-timeline.tsx`: Timeline renders chain nodes in correct order
- `goal-card.tsx`: Progress bar calculates correct percentage, trend arrows display correctly
- `score-sparkline.tsx`: Chart renders with correct data points
- `markdown-content.tsx`: Renders markdown without executing scripts (XSS safety)

### Integration Tests

- Issue List: Filter changes update URL params and trigger data refresh
- Issue Detail: Loads full issue data including relations and comments
- Navigation: Sidebar links route correctly, back navigation works

### What NOT to Test

- shadcn/ui component internals (tested upstream)
- TanStack Router routing mechanics (tested upstream)
- TanStack Query caching behavior (tested upstream)
- CSS visual appearance (manual QA)

---

## Performance Considerations

### Code Splitting

All route components use `createLazyFileRoute` for route-level code splitting. The Prompt Health view (which imports Recharts) is the heaviest route — lazy loading ensures Recharts (~45KB gzipped) is only loaded when the user navigates to `/prompts`.

### Bundle Size Budget

| Chunk | Estimated Size (gzipped) |
|-------|--------------------------|
| Core (React + Router + Query + ky) | ~50KB |
| shadcn/ui components | ~20KB |
| Route: Issues List | ~15KB |
| Route: Issue Detail (includes markdown) | ~25KB |
| Route: Activity | ~8KB |
| Route: Goals | ~8KB |
| Route: Prompts (includes Recharts) | ~50KB |

### Query Optimization

- `staleTime` prevents unnecessary refetches when switching between views
- `refetchInterval: 15_000` on activity view is the only polling query
- All list queries use server-side pagination (max 50 items per page)
- Dashboard endpoints use `Promise.all()` for parallel DB queries

---

## Security Considerations

1. **API Key in Bundle:** `VITE_LOOP_API_KEY` is embedded in the JavaScript bundle at build time. This is acceptable for an internal tool deployed behind Vercel deployment protection. For production multi-tenant use, this should be replaced with session-based authentication.

2. **CORS:** Whitelist only `http://localhost:3000` (dev) and `https://app.looped.me` (prod). No wildcard origins.

3. **Markdown XSS:** `react-markdown` is safe by default — it does not render raw HTML. The `rehype-raw` plugin is explicitly excluded to prevent XSS from untrusted markdown in issue descriptions.

4. **No Mutations:** The dashboard is read-only for MVP. No create/update/delete operations from the frontend reduces the attack surface.

---

## Documentation

- Update `CLAUDE.md` API endpoints table with dashboard routes
- Update `CLAUDE.md` tech stack to include new frontend dependencies
- Add `VITE_API_URL` and `VITE_LOOP_API_KEY` to environment variable documentation
- No external documentation needed (internal tool)

---

## Implementation Phases

### Phase 3A: Foundation

**Goal:** Working app shell with routing, sidebar, and API connectivity.

1. Install all dependencies (runtime + dev)
2. Initialize shadcn/ui (`components.json`, base components)
3. Set up TanStack Router (Vite plugin, root route, dashboard layout)
4. Create API client (`ky` instance with auth)
5. Set up QueryClient with default options
6. Build sidebar navigation component
7. Create `_dashboard.tsx` layout with sidebar + outlet
8. Add CORS middleware to API
9. Implement `GET /api/dashboard/stats` endpoint
10. Wire sidebar stats from dashboard/stats query

### Phase 3B: Issue Views

**Goal:** Issue List with filtering and Issue Detail with full data display.

1. Define frontend type definitions for issues
2. Create query key factory and issue queryOptions
3. Build Issue List route with search param validation
4. Build filter bar with Select dropdowns
5. Build data table with TanStack Table (columns, pagination)
6. Build Issue Detail route
7. Build issue detail sub-components (header, metadata, relations, children, agent results, comments)
8. Build `<MarkdownContent>` component
9. Add loading skeletons for both views

### Phase 3C: Activity & Goals

**Goal:** Loop Activity timeline and Goals Dashboard.

1. Implement `GET /api/dashboard/activity` endpoint (chain assembly)
2. Build Activity timeline component (CSS-based)
3. Add polling via `refetchInterval`
4. Build Goal card component with progress bar
5. Build Goals Dashboard route with grid layout
6. Wire goal data with project lookups

### Phase 3D: Prompt Health

**Goal:** Prompt Health view with metrics and sparkline charts.

1. Implement `GET /api/dashboard/prompts` endpoint
2. Build Prompt card component with metrics grid
3. Build score sparkline with shadcn/ui Chart + Recharts AreaChart
4. Build collapsible version history
5. Implement "needs attention" threshold logic
6. Add lazy loading for Recharts chunk

### Phase 3E: Polish

**Goal:** Responsive behavior, empty states, error handling.

1. Test and fix responsive sidebar behavior (icon → offcanvas)
2. Add empty states for all views
3. Add error boundaries and retry buttons
4. Add `Cmd+B` keyboard shortcut for sidebar toggle
5. Verify code splitting works correctly (check chunk sizes)
6. Run full test suite

---

## Open Questions

*None — all clarifications resolved during ideation.*

---

## Related ADRs

| ADR | Title | Relevance |
|-----|-------|-----------|
| ADR-001 | Use Hono over Express | Dashboard calls this Hono API |
| ADR-002 | Deploy as two Vercel projects | Dashboard deploys to `app.looped.me` as separate Vercel project |
| ADR-004 | Use Drizzle ORM | Schema types inform frontend type definitions |
| ADR-006 | Use soft delete | API handles filtering — dashboard doesn't need to |
| ADR-008 | Use Handlebars for prompt hydration | Dashboard displays template content (Handlebars syntax) |
| ADR-010 | Use EWMA for review scoring | Dashboard displays EWMA scores and trends |

---

## References

- [TanStack Router Docs](https://tanstack.com/router/latest) — File-based routing, search params
- [TanStack Query Docs](https://tanstack.com/query/latest) — queryOptions, query keys
- [TanStack Table Docs](https://tanstack.com/table/latest) — Server-side pagination
- [shadcn/ui Docs](https://ui.shadcn.com) — Component library, Sidebar, Table, Chart
- [Hono CORS Middleware](https://hono.dev/docs/middleware/builtin/cors) — Built-in CORS
- [ky Docs](https://github.com/sindresorhus/ky) — HTTP client
- [react-markdown Docs](https://github.com/remarkjs/react-markdown) — Markdown rendering
- [Recharts Docs](https://recharts.org) — Chart components
- Loop MVP Spec: `meta/loop-mvp.md` (React Dashboard section)
- Phase 1 Spec: `specs/data-layer-core-api/02-specification.md`
- Phase 2 Spec: `specs/prompt-dispatch-engine/02-specification.md`
- Research: `research/20260220_mvp-phase-3-react-dashboard.md`
