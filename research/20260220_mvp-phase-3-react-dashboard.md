# Research: MVP Phase 3 — React Dashboard

**Date:** 2026-02-20
**Feature Slug:** mvp-phase-3-react-dashboard
**Research Depth:** Deep

---

## Research Summary

The recommended stack for the Loop dashboard is **TanStack Router** (file-based, v1) + **TanStack Query v5** + **shadcn/ui** with the official `Sidebar` component, using a typed `ky`-based API client and `react-markdown` + `rehype-pretty-code` for content rendering. TanStack Router's native search-param validation and type-safe route loaders integrate cleanly with TanStack Query's `queryOptions` helper, eliminating boilerplate and making shareable filtered URLs a first-class feature. The `apps/app/` package is currently a clean-slate Vite + React 19 + Tailwind CSS 4 app with no existing routing or data layer, which gives maximum flexibility.

---

## Key Findings

### 1. Routing: TanStack Router wins for this use case

TanStack Router v1 (stable) has first-class support for:
- Fully typed search params with Zod validation
- Nested layouts via pathless (underscore-prefixed) layout routes
- File-based routing with a Vite plugin that generates the route tree
- Native `queryOptions` integration with TanStack Query route loaders

React Router v7 only gains these capabilities in "framework mode" (Remix-style), not in the plain SPA library mode. For a Vite SPA without SSR, TanStack Router delivers a meaningfully better DX.

### 2. TanStack Query v5 is fully React 19 compatible

The v5 API is stable. Key patterns:
- `queryOptions()` helper creates reusable typed query configs for use with both `useQuery`/`useSuspenseQuery` and route loaders
- `QueryClient` + `QueryClientProvider` at the app root
- v5 uses a single config object: `useQuery({ queryKey, queryFn })` — the overloaded variants are gone
- The `@tanstack/react-query-devtools` panel is hidden in production automatically

### 3. API client: thin typed `ky` wrapper

`ky` is 4KB vs Axios at 14KB, wraps native `fetch`, and handles auth headers, JSON parsing, and HTTP error throwing out of the box. The right pattern for this project is a small module (`src/lib/api-client.ts`) that creates a pre-configured `ky` instance with the bearer token injected from an env var, then exports typed functions per resource.

### 4. Data table: shadcn/ui guide + TanStack Table v8

shadcn/ui does not ship a data table component — it ships a `Table` primitive and a documented pattern for assembling it with `@tanstack/react-table`. Key points:
- Column definitions with `ColumnDef<T>[]`
- `useReactTable` hook with `getCoreRowModel`, `getSortingRowModel`, `getFilteredRowModel`, `getPaginationRowModel`
- Server-side mode where TanStack Table handles UI state (sort, page) and those values feed the TanStack Query query key to trigger refetches

For the Issue List, server-side pagination + filtering is the right approach since the API already supports `?status=`, `?type=`, `?projectId=`, and pagination query params.

### 5. Timeline / Activity Feed: custom CSS + OriginUI patterns

There is no first-party shadcn/ui timeline component, but the pattern is simple CSS:
- A vertical `div` with a left border (`border-l-2 border-border`)
- Absolutely-positioned dots at each event node
- `timelineData` array mapped into event cards
- OriginUI (`originui.com/timeline`) ships production-ready timeline components built with Tailwind and no extra dependencies

For real-time updates on the "Loop Activity" view: **polling is the correct starting choice** for an MVP. TanStack Query's `refetchInterval` option on a `useQuery` call is a one-liner. SSE or WebSocket can be added later.

### 6. Dashboard layout: shadcn/ui Sidebar component

shadcn/ui v1 now includes a full first-class `Sidebar` component system:
- `SidebarProvider` wraps the app and manages collapsible state
- `SidebarTrigger` is a button to toggle open/closed
- Collapsible modes: `icon` (collapses to icon strip), `offcanvas` (slides off screen), `none` (always visible)
- Mobile: automatically becomes a `Sheet` drawer
- CSS variable-driven widths (`--sidebar-width`, `--sidebar-width-mobile`)
- `useSidebar()` hook for programmatic control

### 7. Markdown rendering: `react-markdown` + `rehype-pretty-code`

For rendering issue descriptions, comments, and prompt template content:
- `react-markdown` with `remark-gfm` handles GitHub Flavored Markdown (tables, strikethrough, task lists)
- `rehype-pretty-code` (Shiki-powered) handles syntax highlighting, parsing at render time with pre-styled HTML output
- `@tailwindcss/typography` handles typographic styles with a single `prose` class wrapper
- Tailwind CSS v4 supports the typography plugin via `@plugin "@tailwindcss/typography"` in the CSS file — no `tailwind.config.js` needed

---

## Detailed Analysis

### Routing Architecture

**Recommended structure** using TanStack Router file-based routing:

```
src/routes/
├── __root.tsx               # Root layout (QueryClientProvider, SidebarProvider)
├── _dashboard.tsx           # Pathless layout route — renders Sidebar + main area
├── _dashboard/
│   ├── index.tsx            # Redirects to /issues
│   ├── issues/
│   │   ├── index.tsx        # Issue List view
│   │   └── $issueId.tsx     # Issue Detail (full-page route)
│   ├── activity/
│   │   └── index.tsx        # Loop Activity timeline
│   ├── goals/
│   │   └── index.tsx        # Goals Dashboard
│   └── prompts/
│       └── index.tsx        # Prompt Health view
```

The `_dashboard.tsx` pathless layout route renders the sidebar and navigation chrome without contributing to the URL path. All views under `_dashboard/` inherit the layout.

**Issue detail as a route vs slide-over:** both are valid. The recommendation is a **full-page route** (`/issues/$issueId`) for the MVP because:
1. Deep-linkable by default
2. Easier to implement correctly — no stacking context, z-index, or scroll-lock issues
3. A slide-over `Sheet` can be layered on later as a UX enhancement with a `?preview=true` search param

**Search params for shareable filters** (Issue List example):

```ts
// In the issues/index.tsx route definition
const issuesSearchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  type: z.string().optional(),
  projectId: z.string().optional(),
  page: z.number().int().min(1).default(1),
  q: z.string().optional(),
})
```

TanStack Router validates, serializes, and types these params automatically. Components call `useSearch({ from: '/_dashboard/issues/' })` to get the typed params.

### TanStack Query Setup and Query Key Conventions

**Provider setup in `__root.tsx`:**

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,      // 1 minute default
      gcTime: 5 * 60 * 1000,     // 5 minutes garbage collect
      retry: 1,
    },
  },
})
```

**Query key factory pattern** (recommended over ad-hoc keys):

```ts
// src/lib/query-keys.ts
export const issueKeys = {
  all: ['issues'] as const,
  lists: () => [...issueKeys.all, 'list'] as const,
  list: (filters: IssueFilters) => [...issueKeys.lists(), filters] as const,
  details: () => [...issueKeys.all, 'detail'] as const,
  detail: (id: string) => [...issueKeys.details(), id] as const,
}
```

**`queryOptions` helper** (v5 pattern for reusability):

```ts
// src/lib/queries/issues.ts
export const issueListQuery = (filters: IssueFilters) =>
  queryOptions({
    queryKey: issueKeys.list(filters),
    queryFn: () => apiClient.issues.list(filters),
    staleTime: 30 * 1000,
  })

export const issueDetailQuery = (id: string) =>
  queryOptions({
    queryKey: issueKeys.detail(id),
    queryFn: () => apiClient.issues.get(id),
  })
```

These `queryOptions` objects can be passed to `useQuery(issueListQuery(filters))` in components, and to `context.queryClient.ensureQueryData(issueDetailQuery(id))` in route loaders for data prefetching.

**Optimistic updates for status changes** (v5 `onMutate` pattern):

```ts
const mutation = useMutation({
  mutationFn: (vars: { id: string; status: IssueStatus }) =>
    apiClient.issues.update(vars.id, { status: vars.status }),
  onMutate: async (vars) => {
    await queryClient.cancelQueries({ queryKey: issueKeys.detail(vars.id) })
    const previous = queryClient.getQueryData(issueKeys.detail(vars.id))
    queryClient.setQueryData(issueKeys.detail(vars.id), (old) => ({
      ...old,
      status: vars.status,
    }))
    return { previous }
  },
  onError: (_err, vars, ctx) => {
    queryClient.setQueryData(issueKeys.detail(vars.id), ctx?.previous)
  },
  onSettled: (_data, _err, vars) => {
    queryClient.invalidateQueries({ queryKey: issueKeys.detail(vars.id) })
    queryClient.invalidateQueries({ queryKey: issueKeys.lists() })
  },
})
```

### API Client Architecture

**Recommended: typed `ky` instance**

```ts
// src/lib/api-client.ts
import ky from 'ky'

const http = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL,
  headers: {
    Authorization: `Bearer ${import.meta.env.VITE_LOOP_API_KEY}`,
  },
  hooks: {
    beforeError: [
      async (error) => {
        const { response } = error
        error.message = await response.json().then((b) => b.error ?? error.message)
        return error
      },
    ],
  },
})

export const apiClient = {
  issues: {
    list: (filters: IssueFilters) =>
      http.get('api/issues', { searchParams: filters }).json<IssueListResponse>(),
    get: (id: string) =>
      http.get(`api/issues/${id}`).json<IssueDetailResponse>(),
    update: (id: string, data: Partial<Issue>) =>
      http.patch(`api/issues/${id}`, { json: data }).json<Issue>(),
  },
  // projects, goals, templates, signals follow the same pattern
}
```

This pattern:
- Keeps full TypeScript types end-to-end
- No Axios overhead
- `ky`'s `searchParams` option handles URL encoding automatically
- The hooks system handles auth errors gracefully

**Security note on API key:** `VITE_LOOP_API_KEY` will be embedded in the compiled JS bundle. This is acceptable for a self-hosted internal tool, but should not be used for public multi-tenant deployments.

### Data Table Implementation

The `shadcn/ui` data table for the Issue List view follows this pattern:

1. **Column definitions** typed with `ColumnDef<Issue>[]` — include ID, title, status badge (using `Badge` from shadcn), type, project name, created date, and a row action `DropdownMenu`
2. **Server-side mode**: `manualPagination: true`, `manualFiltering: true`, `manualSorting: true` on `useReactTable`. The URL search params (via TanStack Router) drive the query; the table only manages UI state for column visibility
3. **Pagination**: use shadcn/ui `Button` components wired to `navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })` — keeps page state in the URL
4. **Loading state**: show skeleton rows during `isFetching` rather than replacing the table with a full spinner — meaningfully better UX for filter interactions

### Timeline / Activity Feed

The "Loop Activity" view shows signals arriving, issues being created/updated, and prompt reviews flowing in. Recommended implementation:

**Component structure:**

```tsx
// A pure CSS timeline — no extra library needed
function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  return (
    <ol className="relative border-l border-border">
      {items.map((item) => (
        <li key={item.id} className="mb-10 ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background ring-8 ring-background">
            <ActivityIcon type={item.type} />
          </span>
          <ActivityCard item={item} />
        </li>
      ))}
    </ol>
  )
}
```

**Real-time updates:** Use `refetchInterval: 15_000` (15 seconds) on the activity query for the MVP. This is simple, reliable, and requires zero API changes. SSE can be added to the Hono API later using the `streamSSE` helper.

**Linking related items:** Each `ActivityCard` links to the relevant issue/project/template using TanStack Router's `Link` component with typed `to` and `params` props.

### Goals Dashboard and Prompt Health Views

**Goals Dashboard:**
- Stats cards showing counts: total goals, active projects, open issues vs resolved
- A `Progress` component (shadcn/ui) per goal showing `resolvedIssues / totalIssues`
- Group issues by goal using data from `GET /api/goals/:id` responses

**Prompt Health view:**
- Cards per active template showing: template name, active version, review count, average score
- A small `AreaChart` (shadcn/ui charts — built on Recharts) per template showing score trend over time
- Status badge: `healthy` / `degrading` / `no-data` based on EWMA score from prompt_reviews

shadcn/ui ships `Chart` components (AreaChart, BarChart, LineChart) built on top of Recharts via a composable wrapper system. These integrate cleanly without adding heavy chart library setup overhead.

### Dashboard Layout

**Layout structure:**

```
AppShell
├── SidebarProvider
│   ├── AppSidebar (nav items: Issues, Activity, Goals, Prompts)
│   └── main
│       ├── Header (SidebarTrigger + breadcrumbs + global search)
│       └── Outlet (route content)
```

**Nav items:**
- Issues — `ListChecks` icon
- Activity — `Activity` icon
- Goals — `Target` icon
- Prompts — `Cpu` icon

Use the shadcn/ui Sidebar's `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton` components for nav items, with TanStack Router's `Link` rendered inside `SidebarMenuButton asChild`.

**Responsive behavior:**
- Desktop: persistent `icon` collapse mode (collapses to icon-only strip, restores on hover or toggle)
- Mobile: `offcanvas` mode (slides in as a drawer over content)

### Markdown Rendering

```tsx
// src/components/markdown-content.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypePrettyCode from 'rehype-pretty-code'

export function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
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

Tailwind CSS v4 adds the typography plugin via CSS: `@plugin "@tailwindcss/typography"` in `src/index.css`. No config file change needed.

**Bundle size note:** `rehype-pretty-code` runs its Shiki highlighter at parse/render time on the client in a pure SPA context. For issue descriptions that can be long, memoize the `ReactMarkdown` component with `React.memo` and a content hash comparison.

---

## Sources and Evidence

- TanStack Router comparison: [Comparison | TanStack Router Docs](https://tanstack.com/router/latest/docs/framework/react/comparison)
- TanStack Router search params as state: [Search Params Are State | TanStack Blog](https://tanstack.com/blog/search-params-are-state)
- TanStack Router file-based routing: [File-Based Routing | TanStack Router Docs](https://tanstack.com/router/v1/docs/framework/react/routing/file-based-routing)
- TanStack Router + Query integration: [TanStack Query Integration | TanStack Router Docs](https://tanstack.com/router/latest/docs/integrations/query)
- TanStack Query v5 overview: [Overview | TanStack Query React Docs](https://tanstack.com/query/v5/docs/framework/react/overview)
- TanStack Query v5 optimistic updates: [Optimistic Updates | TanStack Query React Docs](https://tanstack.com/query/v5/docs/react/guides/optimistic-updates)
- Query Key Factory library: [lukemorales/query-key-factory on GitHub](https://github.com/lukemorales/query-key-factory)
- ky vs Axios comparison: [Axios vs Ky in React | Dev Diwan on Medium](https://devdiwan.medium.com/axios-vs-ky-in-react-why-lighter-smarter-http-requests-are-just-a-ky-away-1cb4c7ab7e97)
- shadcn/ui Sidebar docs: [Sidebar - shadcn/ui](https://ui.shadcn.com/docs/components/sidebar)
- shadcn/ui data table docs: [Data Table - shadcn/ui](https://ui.shadcn.com/docs/components/data-table)
- shadcn/ui dashboard example: [Dashboard Example - shadcn/ui](https://ui.shadcn.com/examples/dashboard)
- OriginUI timeline components: [Timeline components - OriginUI](https://originui.com/timeline)
- Flowbite Tailwind timeline: [Tailwind CSS Timeline - Flowbite](https://flowbite.com/docs/components/timeline/)
- rehype-pretty-code: [Rehype Pretty Code docs](https://rehype-pretty.pages.dev/)
- react-markdown security and styling guide: [React Markdown Complete Guide 2025 - Strapi](https://strapi.io/blog/react-markdown-complete-guide-security-styling)
- Tailwind CSS v4 typography plugin: [@tailwindcss/typography on GitHub](https://github.com/tailwindlabs/tailwindcss-typography)
- TanStack Router vs React Router v7 (Jan 2026): [TanStack Router vs React Router v7 | Hamza Charafi on Medium](https://medium.com/ekino-france/tanstack-router-vs-react-router-v7-32dddc4fcd58)
- shadcn/ui dashboard complete guide 2026: [Build a Dashboard with shadcn/ui | DesignRevision](https://designrevision.com/blog/shadcn-dashboard-tutorial)

---

## Security Considerations

### API Key Handling

The `VITE_LOOP_API_KEY` approach embeds the bearer token in the compiled JS bundle. This is acceptable for:
- Internal team tooling hosted behind auth (Vercel password protection, VPN)
- Local development

It is **not acceptable** for public deployment without additional protections. The correct production path:
1. Add a session/JWT auth layer to the Hono API
2. Exchange credentials for a short-lived JWT on login
3. Store the JWT in an `httpOnly` cookie (not `localStorage`)
4. For the MVP, Vercel's deployment password or Cloudflare Access in front of `app.looped.me` provides adequate protection at zero extra development cost

### CORS

The Hono API needs to allow requests from `http://localhost:3000` (dev) and `https://app.looped.me` (production). This is configurable via Hono's `cors()` middleware. Never use `origin: '*'` in production with authenticated endpoints.

### XSS and Markdown Rendering

`react-markdown` strips dangerous HTML by default. Key rules:
- Do not add the `rehype-raw` plugin unless markdown source is fully controlled
- User-generated markdown in issue descriptions and comments should be sanitized server-side before storage as a second line of defense
- Never use `innerHTML` or React's `__html` escape hatch for any markdown-derived content — always use `react-markdown`

---

## Performance Considerations

### Bundle Size

Estimated additions to the current clean-slate bundle:

| Library | Size (min+gz) |
|---|---|
| `@tanstack/react-router` | ~45KB |
| `@tanstack/react-query` | ~13KB |
| `ky` | ~4KB |
| `@tanstack/react-table` | ~15KB |
| `react-markdown` + plugins | ~25KB |
| `rehype-pretty-code` + shiki (web bundle) | ~695KB |
| `shadcn/ui` (tree-shaken per component) | minimal |

Shiki bundle size is the main concern. Use the web bundle (`shiki/bundle/web`) with on-demand grammar loading. As an alternative, `react-syntax-highlighter` with the PrismLight build (~50KB) is an acceptable downgrade if bundle size is critical.

### Code Splitting and Lazy Loading

TanStack Router supports route-level code splitting via `createLazyFileRoute`. Recommended: mark all dashboard views except the default redirect as lazy. This ensures only the root shell and the initial route's JS loads on first paint.

### Query Caching Strategy

| Data type | staleTime | Notes |
|---|---|---|
| Issue list | 30s | Can go stale quickly as team works |
| Issue detail | 60s | Less volatile |
| Projects and Goals | 5min | Changes infrequently |
| Templates and versions | 5min | Changes on explicit promotion |
| Activity feed | 0 (always stale) | `refetchInterval: 15_000` |
| Prompt reviews | 2min | Background refresh sufficient |

Use `queryClient.invalidateQueries` on mutations, not manual refetches — TanStack Query will only refetch queries that are currently mounted.

---

## Research Gaps and Limitations

- **shadcn/ui Charts (Recharts) bundle size** was not specifically measured. Recharts adds approximately 40-60KB min+gz. If charts are not critical path, lazy-load the Prompt Health view.
- **TanStack Router ecosystem maturity**: The package reached stable in late 2024 but community resources are less extensive than React Router. The core API is stable and unlikely to have breaking changes.
- **`rehype-pretty-code` client-side performance** on long markdown documents was not benchmarked. Memoizing the `MarkdownContent` component with a content hash is a reasonable precaution.
- **Infinite scroll vs pagination**: The API returns paginated results. `useInfiniteQuery` would provide better UX for the issue list but adds complexity. Standard pagination is recommended for the MVP.

---

## Contradictions and Disputes

- **TanStack Router vs React Router v7**: Some in the community prefer React Router v7 for its stability and familiarity. The counterargument for this project is that TanStack Router's search param management is genuinely superior for a filter-heavy issue list, and the team is starting from a clean slate — not migrating an existing app.
- **Slide-over vs route for issue detail**: Tools like Linear and GitHub use slide-over sheets for issue detail because they preserve list scroll position. This is a valid UX consideration. The full-page route recommendation prioritizes implementation simplicity for the MVP; a sheet overlay can be added later.
- **SSE vs polling for activity feed**: Polling adds periodic database load regardless of activity volume. SSE would be more efficient but requires Hono API changes to implement `streamSSE` and a persistent connection. Polling at 15-30 second intervals is the correct MVP trade-off.

---

## Overall Architecture Recommendation

```
apps/app/src/
├── routes/
│   ├── __root.tsx                # QueryClientProvider + SidebarProvider + DevTools
│   ├── _dashboard.tsx            # AppShell layout route
│   └── _dashboard/
│       ├── issues/index.tsx      # Issue List — server-side filtered table
│       ├── issues/$issueId.tsx   # Issue Detail — full page with comments + markdown
│       ├── activity/index.tsx    # Loop Activity — polling timeline
│       ├── goals/index.tsx       # Goals Dashboard — progress cards
│       └── prompts/index.tsx     # Prompt Health — score cards + mini charts
├── lib/
│   ├── api-client.ts             # Typed ky instance + resource namespaces
│   ├── query-keys.ts             # Query key factory functions
│   └── queries/                  # queryOptions() per resource
├── components/
│   ├── ui/                       # shadcn/ui installed components
│   ├── app-sidebar.tsx           # SidebarMenu with nav items
│   ├── issue-table.tsx           # DataTable<Issue> column definitions
│   ├── activity-timeline.tsx     # Timeline component
│   └── markdown-content.tsx      # react-markdown + rehype-pretty-code wrapper
└── index.css                     # @import "tailwindcss"; @plugin "@tailwindcss/typography";
```

**Package installs needed (from `apps/app/`):**
```bash
npm install @tanstack/react-router @tanstack/router-devtools
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install @tanstack/react-table
npm install ky
npm install react-markdown remark-gfm rehype-pretty-code
npm install @tailwindcss/typography

# shadcn/ui setup
npx shadcn@latest init
npx shadcn@latest add sidebar button badge card table progress tabs sheet chart
```

---

## Search Methodology

- Number of searches performed: 14
- Most productive search terms: `TanStack Router search params URL state management React SPA 2025`, `TanStack Query v5 optimistic updates mutation patterns`, `shadcn/ui sidebar component collapsible navigation 2025 Vite React SPA`
- Primary information sources: tanstack.com official docs, ui.shadcn.com official docs, dev articles from 2025-2026, GitHub repositories
