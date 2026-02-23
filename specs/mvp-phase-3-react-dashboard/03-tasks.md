# Task Breakdown: React Dashboard (MVP Phase 3)

Generated: 2026-02-20
Source: specs/mvp-phase-3-react-dashboard/02-specification.md
Last Decompose: 2026-02-20

## Overview

Build the React dashboard for Loop: 5 views (Issue List, Issue Detail, Loop Activity, Goals Dashboard, Prompt Health) in the existing `apps/app/` React 19 + Vite 6 + Tailwind CSS 4 app, plus 3 new dashboard API endpoints and CORS middleware in `apps/api/`. This covers Phases 3A through 3E of the MVP build plan.

---

## Phase 3A: Foundation

### Task 3A.1: Install Dependencies and Initialize shadcn/ui

**Description**: Install all frontend runtime and dev dependencies, initialize shadcn/ui with dark-mode-only config, and install all required shadcn/ui components.
**Size**: Medium
**Priority**: High
**Dependencies**: None
**Can run parallel with**: Task 3A.8 (CORS + dashboard/stats are API-side)

**Implementation Steps**:

1. Install runtime dependencies in `apps/app/`:

```bash
cd apps/app
npm install @tanstack/react-router @tanstack/react-router-vite-plugin @tanstack/zod-adapter @tanstack/react-query @tanstack/react-query-devtools @tanstack/react-table ky zod react-markdown remark-gfm rehype-pretty-code recharts lucide-react class-variance-authority clsx tailwind-merge @tailwindcss/typography
```

2. Initialize shadcn/ui:

```bash
npx shadcn@latest init
```

Configure `components.json`:

- Style: default
- Base color: neutral
- CSS variables: yes
- Tailwind CSS: v4
- Components alias: `@/components`
- Utils alias: `@/lib/utils`

3. Install all required shadcn/ui components:

```bash
npx shadcn@latest add sidebar table badge button card input select separator skeleton tooltip chart sheet scroll-area dropdown-menu avatar
```

4. Create `apps/app/src/lib/utils.ts` (shadcn/ui utility):

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

5. Update `apps/app/src/index.css` with dark-mode CSS variables:

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

6. Add `class="dark"` to `<html>` in `apps/app/index.html`.

**Acceptance Criteria**:

- [ ] All npm packages install without errors
- [ ] `components.json` exists with correct configuration
- [ ] All 15 shadcn/ui components are installed in `src/components/ui/`
- [ ] `cn()` utility function works correctly
- [ ] CSS variables render dark theme colors
- [ ] `npm run typecheck` passes in `apps/app`

---

### Task 3A.2: Set Up TanStack Router with File-Based Routing

**Description**: Configure TanStack Router with the Vite plugin for file-based route generation, create the root route, dashboard layout, and index redirect.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3A.1
**Can run parallel with**: None (router is prerequisite for all views)

**Implementation Steps**:

1. Update `apps/app/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/react-router-vite-plugin';
import path from 'path';

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

2. Create `apps/app/src/routes/__root.tsx`:

```typescript
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/query-client'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
```

3. Create `apps/app/src/routes/_dashboard.tsx`:

```typescript
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

export const Route = createFileRoute('/_dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </SidebarProvider>
  )
}
```

4. Create `apps/app/src/routes/_dashboard/index.tsx`:

```typescript
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_dashboard/')({
  beforeLoad: () => {
    throw redirect({ to: '/issues' });
  },
});
```

5. Update `apps/app/src/main.tsx`:

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

6. Create placeholder route files for all 5 views so the router generates properly:
   - `apps/app/src/routes/_dashboard/issues/index.tsx`
   - `apps/app/src/routes/_dashboard/issues/$issueId.tsx`
   - `apps/app/src/routes/_dashboard/activity/index.tsx`
   - `apps/app/src/routes/_dashboard/goals/index.tsx`
   - `apps/app/src/routes/_dashboard/prompts/index.tsx`

**Acceptance Criteria**:

- [ ] `routeTree.gen.ts` is generated by the Vite plugin on dev server start
- [ ] Navigating to `/` redirects to `/issues`
- [ ] Dashboard layout renders with sidebar + main content outlet
- [ ] All 5 placeholder routes are accessible
- [ ] `npm run typecheck` passes
- [ ] `npm run dev` starts without errors

---

### Task 3A.3: Create API Client and Query Infrastructure

**Description**: Create the typed `ky` API client, QueryClient with default options, query key factory, and all resource-specific query options modules.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3A.1
**Can run parallel with**: Task 3A.2

**Implementation Steps**:

1. Create `apps/app/src/lib/api-client.ts`:

```typescript
import ky from 'ky';

export const api = ky.create({
  prefixUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:4242',
  headers: {
    Authorization: `Bearer ${import.meta.env.VITE_LOOP_API_KEY}`,
  },
  hooks: {
    afterResponse: [
      async (_request, _options, response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error ?? `API error: ${response.status}`);
        }
      },
    ],
  },
});

// Resource-specific API helpers
import type { Issue, PaginatedResponse, Comment } from '@/types/issues';
import type { Project } from '@/types/projects';
import type { Goal } from '@/types/projects';
import type { PromptTemplate } from '@/types/prompts';
import type { DashboardStats, ActivityChain, PromptHealth } from '@/types/dashboard';

export const issuesApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/issues', { searchParams: params }).json<PaginatedResponse<Issue>>(),
  get: (id: string) => api.get(`api/issues/${id}`).json<{ data: Issue }>(),
};

export const projectsApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/projects', { searchParams: params }).json<PaginatedResponse<Project>>(),
  get: (id: string) => api.get(`api/projects/${id}`).json<{ data: Project }>(),
};

export const goalsApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/goals', { searchParams: params }).json<PaginatedResponse<Goal>>(),
  get: (id: string) => api.get(`api/goals/${id}`).json<{ data: Goal }>(),
};

export const labelsApi = {
  list: (params?: Record<string, string>) =>
    api
      .get('api/labels', { searchParams: params })
      .json<PaginatedResponse<import('@/types/issues').Label>>(),
};

export const templatesApi = {
  list: (params?: Record<string, string>) =>
    api.get('api/templates', { searchParams: params }).json<PaginatedResponse<PromptTemplate>>(),
  get: (id: string) => api.get(`api/templates/${id}`).json<{ data: PromptTemplate }>(),
  versions: (id: string, params?: Record<string, string>) =>
    api
      .get(`api/templates/${id}/versions`, { searchParams: params })
      .json<PaginatedResponse<import('@/types/prompts').PromptVersion>>(),
  reviews: (id: string, params?: Record<string, string>) =>
    api
      .get(`api/templates/${id}/reviews`, { searchParams: params })
      .json<PaginatedResponse<import('@/types/prompts').PromptReview>>(),
};

export const dashboardApi = {
  stats: () => api.get('api/dashboard/stats').json<{ data: DashboardStats }>(),
  activity: (params?: Record<string, string>) =>
    api
      .get('api/dashboard/activity', { searchParams: params })
      .json<{ data: ActivityChain[]; total: number }>(),
  prompts: () => api.get('api/dashboard/prompts').json<{ data: PromptHealth[] }>(),
};
```

2. Create `apps/app/src/lib/query-client.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

3. Create `apps/app/src/lib/query-keys.ts`:

```typescript
export const queryKeys = {
  issues: {
    all: ['issues'] as const,
    lists: () => [...queryKeys.issues.all, 'list'] as const,
    list: (filters: Record<string, unknown>) => [...queryKeys.issues.lists(), filters] as const,
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
} as const;
```

4. Create query options modules in `apps/app/src/lib/queries/`:

`issues.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { issuesApi } from '@/lib/api-client';

export const issueListOptions = (filters: Record<string, string>) =>
  queryOptions({
    queryKey: queryKeys.issues.list(filters),
    queryFn: () => issuesApi.list(filters),
    staleTime: 30_000,
  });

export const issueDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.issues.detail(id),
    queryFn: () => issuesApi.get(id).then((r) => r.data),
    staleTime: 30_000,
  });
```

`projects.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { projectsApi } from '@/lib/api-client';

export const projectListOptions = () =>
  queryOptions({
    queryKey: queryKeys.projects.list(),
    queryFn: () => projectsApi.list(),
    staleTime: 300_000,
  });
```

`goals.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { goalsApi } from '@/lib/api-client';

export const goalListOptions = () =>
  queryOptions({
    queryKey: queryKeys.goals.list(),
    queryFn: () => goalsApi.list(),
    staleTime: 300_000,
  });
```

`labels.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { labelsApi } from '@/lib/api-client';

export const labelListOptions = () =>
  queryOptions({
    queryKey: queryKeys.labels.list(),
    queryFn: () => labelsApi.list(),
    staleTime: 600_000,
  });
```

`templates.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { templatesApi } from '@/lib/api-client';

export const templateListOptions = () =>
  queryOptions({
    queryKey: queryKeys.templates.list(),
    queryFn: () => templatesApi.list(),
    staleTime: 300_000,
  });

export const templateDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.templates.detail(id),
    queryFn: () => templatesApi.get(id).then((r) => r.data),
    staleTime: 300_000,
  });
```

`dashboard.ts`:

```typescript
import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { dashboardApi } from '@/lib/api-client';

export const dashboardStatsOptions = () =>
  queryOptions({
    queryKey: queryKeys.dashboard.stats,
    queryFn: () => dashboardApi.stats().then((r) => r.data),
    staleTime: 30_000,
  });

export const dashboardActivityOptions = () =>
  queryOptions({
    queryKey: queryKeys.dashboard.activity,
    queryFn: () => dashboardApi.activity(),
    staleTime: 30_000,
    refetchInterval: 15_000,
  });

export const dashboardPromptsOptions = () =>
  queryOptions({
    queryKey: queryKeys.dashboard.prompts,
    queryFn: () => dashboardApi.prompts().then((r) => r.data),
    staleTime: 300_000,
  });
```

5. Add environment variables to `apps/app/.env.example`:

```
VITE_API_URL=http://localhost:4242
VITE_LOOP_API_KEY=your-api-key-here
```

**Acceptance Criteria**:

- [ ] `api-client.ts` exports typed API helpers for all resources
- [ ] `query-client.ts` exports configured QueryClient
- [ ] `query-keys.ts` exports hierarchical key factory
- [ ] All 6 query option modules export correct `queryOptions()` definitions
- [ ] Cache tuning matches spec (30s for issues, 5min for templates/goals, etc.)
- [ ] `.env.example` documents required env vars
- [ ] `npm run typecheck` passes

---

### Task 3A.4: Create Frontend Type Definitions

**Description**: Create all TypeScript type definitions for API response shapes used by the frontend.
**Size**: Small
**Priority**: High
**Dependencies**: Task 3A.1
**Can run parallel with**: Task 3A.2, Task 3A.3

**Implementation Steps**:

1. Create `apps/app/src/types/issues.ts`:

```typescript
export type IssueType = 'signal' | 'hypothesis' | 'plan' | 'task' | 'monitor';
export type IssueStatus = 'triage' | 'backlog' | 'todo' | 'in_progress' | 'done' | 'canceled';
export type RelationType = 'blocks' | 'blocked_by' | 'related' | 'duplicate';
export type AuthorType = 'human' | 'agent';

export interface Issue {
  id: string;
  number: number;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: number;
  parentId: string | null;
  projectId: string | null;
  signalSource: string | null;
  signalPayload: Record<string, unknown> | null;
  hypothesis: HypothesisData | null;
  agentSessionId: string | null;
  agentSummary: string | null;
  commits: CommitRef[] | null;
  pullRequests: PullRequestRef[] | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  labels?: Label[];
  relations?: IssueRelation[];
  comments?: Comment[];
  children?: Issue[];
  parent?: Issue | null;
}

export interface HypothesisData {
  statement: string;
  confidence: number;
  evidence: string[];
  validationCriteria: string;
  prediction?: string;
}

export interface CommitRef {
  sha: string;
  message: string;
  url: string;
  author: string;
  timestamp: string;
}

export interface PullRequestRef {
  number: number;
  title: string;
  url: string;
  state: string;
  mergedAt: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface IssueRelation {
  id: string;
  type: RelationType;
  issueId: string;
  relatedIssueId: string;
  relatedIssue?: Issue;
}

export interface Comment {
  id: string;
  body: string;
  issueId: string;
  authorName: string;
  authorType: AuthorType;
  parentId: string | null;
  createdAt: string;
  children?: Comment[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}
```

2. Create `apps/app/src/types/projects.ts`:

```typescript
export type ProjectStatus = 'active' | 'completed' | 'archived';
export type ProjectHealth = 'on_track' | 'at_risk' | 'behind';
export type GoalStatus = 'active' | 'achieved' | 'abandoned';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  health: ProjectHealth;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  metricName: string;
  metricUnit: string;
  targetValue: number;
  currentValue: number;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  project?: Project;
}
```

3. Create `apps/app/src/types/prompts.ts`:

```typescript
export type VersionStatus = 'draft' | 'active' | 'archived';

export interface PromptTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  issueType: string | null;
  conditions: Record<string, unknown> | null;
  specificity: number;
  createdAt: string;
  updatedAt: string;
  activeVersion?: PromptVersion | null;
}

export interface PromptVersion {
  id: string;
  templateId: string;
  version: number;
  status: VersionStatus;
  body: string;
  changelog: string | null;
  author: string;
  usageCount: number;
  completionRate: number | null;
  ewmaScore: number | null;
  createdAt: string;
}

export interface PromptReview {
  id: string;
  versionId: string;
  issueId: string;
  clarity: number;
  completeness: number;
  relevance: number;
  comment: string | null;
  createdAt: string;
}
```

4. Create `apps/app/src/types/dashboard.ts`:

```typescript
import type { IssueStatus, IssueType, Issue, IssueRelation } from './issues';
import type { PromptTemplate, PromptVersion } from './prompts';

export interface DashboardStats {
  issues: {
    total: number;
    byStatus: Record<IssueStatus, number>;
    byType: Record<IssueType, number>;
  };
  goals: {
    total: number;
    active: number;
    achieved: number;
  };
  dispatch: {
    queueDepth: number;
    activeCount: number;
    completedLast24h: number;
  };
}

export interface ActivityChain {
  root: Issue;
  children: Array<{
    issue: Issue;
    relations: IssueRelation[];
  }>;
  latestActivity: string;
}

export interface PromptHealth {
  template: PromptTemplate;
  activeVersion: PromptVersion | null;
  recentVersions: PromptVersion[];
  reviewSummary: {
    totalReviews: number;
    avgClarity: number | null;
    avgCompleteness: number | null;
    avgRelevance: number | null;
    compositeScore: number | null;
  };
  needsAttention: boolean;
}
```

**Acceptance Criteria**:

- [ ] All 4 type files created with complete interfaces
- [ ] Types match the API response shapes documented in the spec
- [ ] `npm run typecheck` passes
- [ ] No `any` types used

---

### Task 3A.5: Build Sidebar Navigation Component

**Description**: Build the sidebar navigation using shadcn/ui Sidebar component system with nav links, live stats from dashboard/stats, and responsive behavior.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3A.1, Task 3A.2, Task 3A.3
**Can run parallel with**: None

**Implementation Steps**:

1. Create `apps/app/src/components/app-sidebar.tsx`:

```typescript
import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { List, Activity, Target, Sparkles } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { dashboardStatsOptions } from '@/lib/queries/dashboard'

const navItems = [
  { title: 'Issues', to: '/issues', icon: List },
  { title: 'Activity', to: '/activity', icon: Activity },
  { title: 'Goals', to: '/goals', icon: Target },
  { title: 'Prompts', to: '/prompts', icon: Sparkles },
] as const

export function AppSidebar() {
  const router = useRouterState()
  const { data: stats } = useQuery(dashboardStatsOptions())

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <span className="text-lg font-bold">Loop</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={router.location.pathname.startsWith(item.to)}
                  >
                    <Link to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Separator />
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="space-y-1 px-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Queue</span>
                <span className="font-mono">{stats?.dispatch.queueDepth ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Active</span>
                <span className="font-mono">{stats?.dispatch.activeCount ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span>Done (24h)</span>
                <span className="font-mono">{stats?.dispatch.completedLast24h ?? '—'}</span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarFooter>
    </Sidebar>
  )
}
```

2. Update `_dashboard.tsx` layout to include `SidebarTrigger` for mobile toggle:

```typescript
function DashboardLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-12 items-center gap-2 border-b border-border px-4 lg:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">Loop</span>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}
```

**Acceptance Criteria**:

- [ ] Sidebar renders with 4 nav items (Issues, Activity, Goals, Prompts)
- [ ] Active route is highlighted
- [ ] Stats section shows queue depth, active count, done count from API
- [ ] Desktop: sidebar collapses to icon strip
- [ ] Mobile: sidebar is hidden, opens as sheet overlay on trigger
- [ ] Navigation links route correctly

---

### Task 3A.6: Add CORS Middleware and Dashboard Stats Endpoint to API

**Description**: Add CORS middleware to the Hono API and implement the `GET /api/dashboard/stats` endpoint with aggregation queries.
**Size**: Medium
**Priority**: High
**Dependencies**: None (API-side, independent of frontend)
**Can run parallel with**: Tasks 3A.1 through 3A.5

**Implementation Steps**:

1. Add CORS middleware in `apps/api/src/app.ts`:

```typescript
import { cors } from 'hono/cors';

// Add before all routes, after app creation
app.use(
  '*',
  cors({
    origin: ['http://localhost:3000', 'https://app.looped.me'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86400,
  })
);
```

2. Create `apps/api/src/routes/dashboard.ts`:

```typescript
import { Hono } from 'hono';
import { eq, sql, and, isNull, gte } from 'drizzle-orm';
import { issues } from '@/db/schema/issues';
import { goals } from '@/db/schema/projects';
import type { AppEnv } from '@/types';

export const dashboardRoutes = new Hono<AppEnv>();

/** GET /dashboard/stats - System health metrics */
dashboardRoutes.get('/stats', async (c) => {
  const db = c.get('db');

  const [issueStats, goalStats, dispatchStats] = await Promise.all([
    // Issue counts by status and type
    db
      .select({
        status: issues.status,
        type: issues.type,
        count: sql<number>`count(*)::int`,
      })
      .from(issues)
      .where(isNull(issues.deletedAt))
      .groupBy(issues.status, issues.type),

    // Goal counts
    db
      .select({
        status: goals.status,
        count: sql<number>`count(*)::int`,
      })
      .from(goals)
      .where(isNull(goals.deletedAt))
      .groupBy(goals.status),

    // Dispatch stats
    Promise.all([
      // Queue depth: todo/backlog issues
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(and(isNull(issues.deletedAt), sql`${issues.status} IN ('todo', 'backlog')`)),
      // Active count: in_progress issues
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(and(isNull(issues.deletedAt), eq(issues.status, 'in_progress'))),
      // Completed last 24h
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(
          and(
            isNull(issues.deletedAt),
            eq(issues.status, 'done'),
            gte(issues.completedAt, sql`NOW() - INTERVAL '24 hours'`)
          )
        ),
    ]),
  ]);

  // Aggregate issue stats
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let total = 0;
  for (const row of issueStats) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + row.count;
    byType[row.type] = (byType[row.type] ?? 0) + row.count;
    total += row.count;
  }

  // Aggregate goal stats
  const goalAgg = { total: 0, active: 0, achieved: 0 };
  for (const row of goalStats) {
    goalAgg.total += row.count;
    if (row.status === 'active') goalAgg.active = row.count;
    if (row.status === 'achieved') goalAgg.achieved = row.count;
  }

  return c.json({
    data: {
      issues: { total, byStatus, byType },
      goals: goalAgg,
      dispatch: {
        queueDepth: dispatchStats[0][0]?.count ?? 0,
        activeCount: dispatchStats[1][0]?.count ?? 0,
        completedLast24h: dispatchStats[2][0]?.count ?? 0,
      },
    },
  });
});
```

3. Mount dashboard routes in `apps/api/src/app.ts`:

```typescript
import { dashboardRoutes } from './routes/dashboard';

// Add after other api.route() calls
api.route('/dashboard', dashboardRoutes);
```

4. Write tests in `apps/api/src/__tests__/dashboard.test.ts`:

Test the stats endpoint returns correct response shape, CORS headers are present, stats aggregation produces accurate counts.

**Acceptance Criteria**:

- [ ] CORS headers present on API responses for allowed origins
- [ ] `GET /api/dashboard/stats` returns correct response shape
- [ ] Stats aggregation produces accurate counts matching database state
- [ ] CORS rejects disallowed origins
- [ ] Tests pass using `withTestDb()` PGlite infrastructure
- [ ] `npm run typecheck` passes in `apps/api`

---

## Phase 3B: Issue Views

### Task 3B.1: Build Issue List View with Filters, Table, and Pagination

**Description**: Build the complete Issue List view at `/_dashboard/issues/` with URL-persisted filters, TanStack Table with server-side pagination, type/status badge columns, skeleton loading, and empty state.
**Size**: Large
**Priority**: High
**Dependencies**: Task 3A.2, Task 3A.3, Task 3A.4
**Can run parallel with**: Task 3A.6

**Implementation Steps**:

1. Create `apps/app/src/routes/_dashboard/issues/index.tsx` with Zod search param validation:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { zodValidator, fallback } from '@tanstack/zod-adapter'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { issueListOptions } from '@/lib/queries/issues'
import { IssueDataTable } from '@/components/issue-table/data-table'
import { IssueFilters } from '@/components/issue-table/filters'

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
  component: IssueListPage,
})

function IssueListPage() {
  const search = Route.useSearch()
  const filters = useMemo(() => {
    const params: Record<string, string> = {}
    if (search.status) params.status = search.status
    if (search.type) params.type = search.type
    if (search.projectId) params.projectId = search.projectId
    if (search.labelId) params.labelId = search.labelId
    if (search.priority !== undefined) params.priority = String(search.priority)
    params.page = String(search.page)
    params.limit = String(search.limit)
    return params
  }, [search])

  const { data, isFetching, error } = useQuery(issueListOptions(filters))

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Failed to load issues: {error.message}</p>
        <button onClick={() => window.location.reload()} className="text-sm underline">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Issues</h1>
      <IssueFilters />
      <IssueDataTable
        data={data?.data ?? []}
        total={data?.total ?? 0}
        page={search.page}
        limit={search.limit}
        isLoading={isFetching && !data}
      />
    </div>
  )
}
```

2. Create `apps/app/src/components/issue-table/filters.tsx` with Select dropdowns for status, type, project, label, priority mapped to URL search params via `useNavigate`:

Filter bar uses `<Select>` components from shadcn/ui. Each filter change calls `navigate({ search: (prev) => ({ ...prev, [key]: value, page: 1 }) })` to reset pagination.

Status options: triage, backlog, todo, in_progress, done, canceled
Type options: signal, hypothesis, plan, task, monitor
Priority options: 0 (P0) through 4 (P4)

Project and label options are fetched from `projectListOptions()` and `labelListOptions()`.

3. Create `apps/app/src/components/issue-table/columns.tsx` with TanStack Table column definitions:

| Column   | Width | Content                              |
| -------- | ----- | ------------------------------------ |
| Number   | 80px  | `#${number}` monospace               |
| Title    | flex  | Title text, truncated with tooltip   |
| Type     | 100px | `<Badge>` with icon + color per type |
| Status   | 120px | `<Badge>` with status color          |
| Priority | 80px  | Priority indicator (P0-P4)           |
| Project  | 140px | Project name or dash                 |
| Labels   | 160px | Up to 2 label badges, "+N" overflow  |
| Updated  | 120px | Relative time ("2h ago")             |

Type badge colors: signal=amber, hypothesis=violet, plan=blue, task=emerald, monitor=cyan
Status badge colors: triage=yellow, backlog=slate, todo=blue, in_progress=indigo, done=green, canceled=red

4. Create `apps/app/src/components/issue-table/data-table.tsx`:

Uses `useReactTable` with manual pagination mode. Bottom pagination bar shows "Showing X-Y of Z" and Previous/Next buttons. Row click navigates to `/issues/${issue.id}` via `<Link>`.

Skeleton state: 8 rows matching column layout during initial load.

Empty state: Centered "No issues found" with suggestion to adjust filters.

**Acceptance Criteria**:

- [ ] Issue list renders with all 8 columns
- [ ] Filters are URL-persisted and shareable
- [ ] Changing a filter resets page to 1 and refetches
- [ ] Pagination works (Previous/Next, page info display)
- [ ] Type badges render correct colors and icons
- [ ] Status badges render correct colors
- [ ] Skeleton rows show during loading
- [ ] Empty state displays when no issues match filters
- [ ] Row click navigates to issue detail
- [ ] `npm run typecheck` passes

---

### Task 3B.2: Build Issue Detail View with Sub-Components

**Description**: Build the full Issue Detail page at `/_dashboard/issues/$issueId` with two-column layout, header, description (markdown), signal data, hypothesis data, agent results, children, threaded comments, metadata sidebar, and skeleton/error states.
**Size**: Large
**Priority**: High
**Dependencies**: Task 3A.2, Task 3A.3, Task 3A.4
**Can run parallel with**: Task 3B.1

**Implementation Steps**:

1. Create `apps/app/src/routes/_dashboard/issues/$issueId.tsx`:

```typescript
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { issueDetailOptions } from '@/lib/queries/issues'
import { IssueHeader } from '@/components/issue-detail/issue-header'
import { IssueMetadata } from '@/components/issue-detail/issue-metadata'
import { IssueRelations } from '@/components/issue-detail/issue-relations'
import { IssueChildren } from '@/components/issue-detail/issue-children'
import { IssueAgentResults } from '@/components/issue-detail/issue-agent-results'
import { IssueComments } from '@/components/issue-detail/issue-comments'
import { MarkdownContent } from '@/components/markdown-content'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_dashboard/issues/$issueId')({
  component: IssueDetailPage,
})

function IssueDetailPage() {
  const { issueId } = Route.useParams()
  const { data: issue, isLoading, error } = useQuery(issueDetailOptions(issueId))

  if (isLoading) return <IssueDetailSkeleton />
  if (error || !issue) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Issue not found</p>
        <Link to="/issues" className="text-sm underline">Back to Issues</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/issues" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to Issues
      </Link>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <IssueHeader issue={issue} />
          {issue.description && <MarkdownContent content={issue.description} />}
          {issue.type === 'signal' && issue.signalPayload && (
            <SignalData source={issue.signalSource} payload={issue.signalPayload} />
          )}
          {issue.type === 'hypothesis' && issue.hypothesis && (
            <HypothesisData data={issue.hypothesis} />
          )}
          {(issue.agentSummary || issue.commits?.length || issue.pullRequests?.length) && (
            <IssueAgentResults issue={issue} />
          )}
          {issue.children && issue.children.length > 0 && (
            <IssueChildren children={issue.children} />
          )}
          {issue.comments && issue.comments.length > 0 && (
            <IssueComments comments={issue.comments} />
          )}
        </div>
        <aside className="space-y-6">
          <IssueMetadata issue={issue} />
          {issue.relations && issue.relations.length > 0 && (
            <IssueRelations relations={issue.relations} />
          )}
        </aside>
      </div>
    </div>
  )
}
```

2. Create sub-components in `apps/app/src/components/issue-detail/`:

- `issue-header.tsx`: Issue number + title, type badge, status badge
- `issue-metadata.tsx`: Priority (P0-P4), status, type, project link, labels as badges, parent issue link, created/updated timestamps
- `issue-relations.tsx`: "Blocks" and "Blocked by" lists with issue links
- `issue-children.tsx`: Compact list of child issues with type/status badges, clickable links
- `issue-agent-results.tsx`: Agent summary text, commit list with SHA links, PR list with status badges
- `issue-comments.tsx`: Threaded comment display. Each comment shows author name, author type badge (human/agent), relative time, body text. Threaded via `parentId` with replies indented under parent.

3. Implement `IssueDetailSkeleton` with two-column skeleton layout matching the final UI structure.

4. Implement signal data section (source badge, raw payload in collapsible `<pre>` block).

5. Implement hypothesis data section (statement, confidence meter 0-1 scale, evidence list, validation criteria).

**Acceptance Criteria**:

- [ ] Issue detail renders all sections based on issue type and available data
- [ ] Two-column layout on desktop, single column on mobile
- [ ] Markdown description renders with syntax highlighting
- [ ] Signal data shows source badge and collapsible payload
- [ ] Hypothesis data shows confidence meter and evidence
- [ ] Agent results show commits with SHA links and PRs with status
- [ ] Children list is clickable and navigates to child issues
- [ ] Comments render threaded (indented replies)
- [ ] "Back to Issues" link works
- [ ] Loading skeleton matches final layout structure
- [ ] Error state shows "Issue not found" with back link
- [ ] `npm run typecheck` passes

---

### Task 3B.3: Build MarkdownContent Component

**Description**: Create the reusable markdown rendering component using react-markdown with GFM support and syntax highlighting.
**Size**: Small
**Priority**: Medium
**Dependencies**: Task 3A.1
**Can run parallel with**: Tasks 3B.1, 3B.2

**Implementation Steps**:

1. Create `apps/app/src/components/markdown-content.tsx`:

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

Note: No `rehype-raw` plugin -- prevents XSS from untrusted markdown content.

**Acceptance Criteria**:

- [ ] Renders markdown with GFM support (tables, strikethrough, task lists)
- [ ] Code blocks have syntax highlighting
- [ ] Prose styling applies via `@tailwindcss/typography`
- [ ] No raw HTML rendering (XSS safe)
- [ ] `npm run typecheck` passes

---

## Phase 3C: Activity and Goals

### Task 3C.1: Implement Dashboard Activity Endpoint

**Description**: Implement `GET /api/dashboard/activity` endpoint that returns pre-assembled signal chains for the Loop Activity view.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3A.6 (dashboard route file exists)
**Can run parallel with**: Task 3C.3

**Implementation Steps**:

Add to `apps/api/src/routes/dashboard.ts`:

```typescript
import { issues, issueRelations } from '@/db/schema/issues';
import { desc, eq, and, isNull } from 'drizzle-orm';

/** GET /dashboard/activity - Pre-assembled signal chains */
dashboardRoutes.get('/activity', async (c) => {
  const db = c.get('db');
  const limit = Number(c.req.query('limit') ?? '20');

  // 1. Query root issues (parentId IS NULL) ordered by updatedAt DESC
  const rootIssues = await db
    .select()
    .from(issues)
    .where(and(isNull(issues.deletedAt), isNull(issues.parentId)))
    .orderBy(desc(issues.updatedAt))
    .limit(limit);

  // 2. For each root, query children with their relations
  const chains = await Promise.all(
    rootIssues.map(async (root) => {
      const children = await db
        .select()
        .from(issues)
        .where(and(isNull(issues.deletedAt), eq(issues.parentId, root.id)))
        .orderBy(issues.createdAt);

      const childrenWithRelations = await Promise.all(
        children.map(async (child) => {
          const relations = await db
            .select()
            .from(issueRelations)
            .where(eq(issueRelations.issueId, child.id));
          return { issue: child, relations };
        })
      );

      // Latest activity is the most recent updatedAt across root + children
      const allTimestamps = [root.updatedAt, ...children.map((c) => c.updatedAt)];
      const latestActivity = allTimestamps
        .map((t) => new Date(t).getTime())
        .reduce((max, t) => Math.max(max, t), 0);

      return {
        root,
        children: childrenWithRelations,
        latestActivity: new Date(latestActivity).toISOString(),
      };
    })
  );

  // 3. Sort chains by latestActivity descending
  chains.sort(
    (a, b) => new Date(b.latestActivity).getTime() - new Date(a.latestActivity).getTime()
  );

  return c.json({
    data: chains,
    total: chains.length,
  });
});
```

Add tests for chain assembly in `apps/api/src/__tests__/dashboard.test.ts`:

- Test root issues with no children return single-node chains
- Test parent-child grouping assembles correctly
- Test chains are sorted by latest activity
- Test limit parameter works

**Acceptance Criteria**:

- [ ] Endpoint returns pre-assembled chains with root + children structure
- [ ] Children include their relations
- [ ] Chains are sorted by most recent activity
- [ ] Limit parameter controls number of chains returned
- [ ] Only non-deleted issues are included
- [ ] Tests pass

---

### Task 3C.2: Build Activity Timeline Component and Route

**Description**: Build the Loop Activity view at `/_dashboard/activity/` with CSS-based vertical timeline displaying signal chains, polling via refetchInterval.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3A.2, Task 3A.3, Task 3C.1
**Can run parallel with**: Task 3C.3

**Implementation Steps**:

1. Create `apps/app/src/routes/_dashboard/activity/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { dashboardActivityOptions } from '@/lib/queries/dashboard'
import { ActivityTimeline } from '@/components/activity-timeline'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_dashboard/activity/')({
  component: ActivityPage,
})

function ActivityPage() {
  const { data, isLoading, error } = useQuery(dashboardActivityOptions())

  if (isLoading) return <ActivitySkeleton />
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Failed to load activity: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Loop Activity</h1>
      {data?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <p className="text-lg">No activity yet</p>
          <p className="text-sm">The loop is waiting for signals</p>
        </div>
      ) : (
        <ActivityTimeline chains={data?.data ?? []} />
      )}
    </div>
  )
}
```

2. Create `apps/app/src/components/activity-timeline.tsx`:

CSS-based vertical timeline. Structure:

- Outer `<div>` with `space-y-8`
- Each chain is a group with `relative border-l border-neutral-700 pl-6`
- Each node is a `<div>` with absolutely positioned type-colored dot
- Type icons use the same colors as Issue List type badges (signal=amber, hypothesis=violet, plan=blue, task=emerald, monitor=cyan)
- Show issue title, number, relative timestamp, status badge
- Key metadata inline (source for signals, confidence for hypotheses, PR links for tasks)

Chain status indicator:

- "Complete" if all children done/canceled
- "In Progress" if any child in_progress
- "Pending" otherwise

Polling is handled by `refetchInterval: 15_000` in the query options (already configured in `dashboardActivityOptions`).

**Acceptance Criteria**:

- [ ] Timeline renders chains with root + children nodes
- [ ] Type-colored dots/icons display correctly
- [ ] Chain status indicator derives correctly from child statuses
- [ ] Relative timestamps display (e.g., "2h ago")
- [ ] Empty state shows when no activity exists
- [ ] Polling refreshes data every 15 seconds
- [ ] `npm run typecheck` passes

---

### Task 3C.3: Build Goals Dashboard View

**Description**: Build the Goals Dashboard view at `/_dashboard/goals/` with grid layout of goal cards showing progress bars, trend indicators, and project links.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Task 3A.2, Task 3A.3, Task 3A.4
**Can run parallel with**: Tasks 3C.1, 3C.2

**Implementation Steps**:

1. Create `apps/app/src/routes/_dashboard/goals/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { goalListOptions } from '@/lib/queries/goals'
import { GoalCard } from '@/components/goal-card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/_dashboard/goals/')({
  component: GoalsPage,
})

function GoalsPage() {
  const { data, isLoading, error } = useQuery(goalListOptions())

  if (isLoading) return <GoalsSkeleton />
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Failed to load goals: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Goals</h1>
      {data?.data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <p className="text-lg">No goals defined yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data?.data.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  )
}
```

2. Create `apps/app/src/components/goal-card.tsx`:

```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import type { Goal } from '@/types/projects'

export function GoalCard({ goal }: { goal: Goal }) {
  const progress = goal.targetValue > 0
    ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
    : 0

  const progressColor =
    progress > 75 ? 'bg-green-500' :
    progress > 25 ? 'bg-yellow-500' :
    'bg-red-500'

  const statusColor =
    goal.status === 'achieved' ? 'bg-green-500/20 text-green-400' :
    goal.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
    'bg-neutral-500/20 text-neutral-400'

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{goal.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {goal.metricName} ({goal.metricUnit})
          </p>
        </div>
        <Badge className={statusColor}>{goal.status}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-2 w-full rounded-full bg-secondary">
          <div
            className={`h-full rounded-full ${progressColor} transition-all`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {goal.currentValue} / {goal.targetValue} {goal.metricUnit}
          </span>
          <span className="font-mono text-sm">{progress.toFixed(0)}%</span>
        </div>
        {goal.project && (
          <p className="text-xs text-muted-foreground">
            Project: {goal.project.name}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Acceptance Criteria**:

- [ ] Goals grid renders with 2 columns on desktop, 1 on mobile
- [ ] Progress bar calculates correct percentage from currentValue/targetValue
- [ ] Progress bar color: green >75%, yellow 25-75%, red <25%
- [ ] Status badge renders with correct color
- [ ] Metric label and unit display correctly
- [ ] Project name displays when available
- [ ] Empty state shows when no goals exist
- [ ] `npm run typecheck` passes

---

## Phase 3D: Prompt Health

### Task 3D.1: Implement Dashboard Prompts Endpoint

**Description**: Implement `GET /api/dashboard/prompts` endpoint that returns prompt template health data with version history and review scores.
**Size**: Medium
**Priority**: High
**Dependencies**: Task 3A.6 (dashboard route file exists)
**Can run parallel with**: Task 3D.2

**Implementation Steps**:

Add to `apps/api/src/routes/dashboard.ts`:

```typescript
import { promptTemplates, promptVersions, promptReviews } from '@/db/schema/prompts';

/** GET /dashboard/prompts - Prompt template health data */
dashboardRoutes.get('/prompts', async (c) => {
  const db = c.get('db');

  // Get all non-deleted templates
  const templates = await db
    .select()
    .from(promptTemplates)
    .where(isNull(promptTemplates.deletedAt));

  const data = await Promise.all(
    templates.map(async (template) => {
      // Get recent versions (last 5)
      const versions = await db
        .select()
        .from(promptVersions)
        .where(eq(promptVersions.templateId, template.id))
        .orderBy(desc(promptVersions.version))
        .limit(5);

      // Find active version
      const activeVersion = versions.find((v) => v.status === 'active') ?? null;

      // Get review aggregates for all versions of this template
      const reviewAgg = await db
        .select({
          totalReviews: sql<number>`count(*)::int`,
          avgClarity: sql<number>`avg(${promptReviews.clarity})`,
          avgCompleteness: sql<number>`avg(${promptReviews.completeness})`,
          avgRelevance: sql<number>`avg(${promptReviews.relevance})`,
        })
        .from(promptReviews)
        .innerJoin(promptVersions, eq(promptReviews.versionId, promptVersions.id))
        .where(eq(promptVersions.templateId, template.id));

      const summary = reviewAgg[0] ?? {
        totalReviews: 0,
        avgClarity: null,
        avgCompleteness: null,
        avgRelevance: null,
      };

      const compositeScore = activeVersion?.ewmaScore ?? null;
      const completionRate = activeVersion?.completionRate ?? null;

      const needsAttention =
        (compositeScore !== null && compositeScore < 3.0) ||
        (completionRate !== null && completionRate < 0.5);

      return {
        template,
        activeVersion,
        recentVersions: versions,
        reviewSummary: {
          totalReviews: summary.totalReviews,
          avgClarity: summary.avgClarity,
          avgCompleteness: summary.avgCompleteness,
          avgRelevance: summary.avgRelevance,
          compositeScore,
        },
        needsAttention,
      };
    })
  );

  return c.json({ data });
});
```

Add tests:

- Test returns correct shape with template + versions + review summary
- Test needsAttention flag is true when compositeScore < 3.0
- Test needsAttention flag is true when completionRate < 0.5
- Test review aggregation math is correct

**Acceptance Criteria**:

- [ ] Endpoint returns all templates with health data
- [ ] Active version is correctly identified
- [ ] Recent versions limited to last 5
- [ ] Review aggregation calculates correct averages
- [ ] `needsAttention` flag triggers at correct thresholds
- [ ] Tests pass

---

### Task 3D.2: Build Prompt Health View with Cards, Sparklines, and Version History

**Description**: Build the Prompt Health view at `/_dashboard/prompts/` with template cards showing metrics grid, score sparklines using Recharts, and collapsible version history.
**Size**: Large
**Priority**: Medium
**Dependencies**: Task 3A.2, Task 3A.3, Task 3A.4, Task 3D.1
**Can run parallel with**: None

**Implementation Steps**:

1. Create `apps/app/src/routes/_dashboard/prompts/index.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { dashboardPromptsOptions } from '@/lib/queries/dashboard'
import { PromptCard } from '@/components/prompt-card'

export const Route = createFileRoute('/_dashboard/prompts/')({
  component: PromptsPage,
})

function PromptsPage() {
  const { data, isLoading, error } = useQuery(dashboardPromptsOptions())

  if (isLoading) return <PromptsSkeleton />
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Failed to load prompts: {error.message}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prompt Health</h1>
      {data?.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <p className="text-lg">No prompt templates yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.map((item) => (
            <PromptCard key={item.template.id} data={item} />
          ))}
        </div>
      )}
    </div>
  )
}
```

2. Create `apps/app/src/components/prompt-card.tsx`:

Template card with:

- Header row: template name + slug, active version badge, "Needs attention" warning badge
- Metrics row (4 metrics in horizontal grid): Usage count, Completion rate (%), Composite score (/5), Total reviews
- Score breakdown: Clarity / Completeness / Relevance as individual scores (1-5) with inline bar indicators
- Sparkline chart showing composite score trend across last 5 versions
- Collapsible version history (last 5 versions: version number, status badge, changelog text, author, usage count, completion rate)

3. Create `apps/app/src/components/score-sparkline.tsx`:

```typescript
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { PromptVersion } from '@/types/prompts'

interface ScoreSparklineProps {
  versions: PromptVersion[]
}

export function ScoreSparkline({ versions }: ScoreSparklineProps) {
  const data = versions
    .slice()
    .reverse()
    .map((v) => ({
      version: `v${v.version}`,
      score: v.ewmaScore ?? 0,
    }))

  const latestScore = data[data.length - 1]?.score ?? 0
  const fillColor =
    latestScore >= 3.5 ? 'hsl(var(--chart-2))' :  // green
    latestScore >= 2.5 ? 'hsl(var(--chart-3))' :  // amber
    'hsl(340 75% 55%)'                              // red

  return (
    <ChartContainer config={{ score: { label: 'Score', color: fillColor } }} className="h-24 w-full">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="version" tick={{ fontSize: 10 }} />
        <YAxis domain={[1, 5]} tick={{ fontSize: 10 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke={fillColor}
          fill={fillColor}
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
```

4. Implement lazy loading: The prompts route should use `createLazyFileRoute` pattern to ensure Recharts is only loaded when navigating to `/prompts`.

**Acceptance Criteria**:

- [ ] Prompt cards render with all metric sections
- [ ] "Needs attention" badge appears when compositeScore < 3.0 or completionRate < 0.5
- [ ] Sparkline chart renders score trend across versions
- [ ] Chart gradient color changes based on score (green/amber/red)
- [ ] Version history is collapsible
- [ ] Empty state shows when no templates exist
- [ ] Recharts chunk is lazy-loaded (not in main bundle)
- [ ] `npm run typecheck` passes

---

## Phase 3E: Polish

### Task 3E.1: Add Empty States, Error Boundaries, and Keyboard Shortcuts

**Description**: Add polished empty states for all views, error boundary components with retry buttons, and Cmd+B keyboard shortcut for sidebar toggle.
**Size**: Medium
**Priority**: Medium
**Dependencies**: Tasks 3B.1, 3B.2, 3C.2, 3C.3, 3D.2
**Can run parallel with**: Task 3E.2

**Implementation Steps**:

1. Create a reusable `ErrorBoundary` component that catches React rendering errors and displays a fallback UI with error message and retry button.

2. Wrap each route's component in an error boundary at the route level or in the dashboard layout.

3. Implement `Cmd+B` keyboard shortcut:

```typescript
// In _dashboard.tsx layout
import { useSidebar } from '@/components/ui/sidebar';
import { useEffect } from 'react';

function DashboardLayout() {
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleSidebar]);

  // ... rest of layout
}
```

4. Verify all views have empty states:

- Issues: "No issues found" with filter adjustment suggestion
- Activity: "No activity yet -- the loop is waiting for signals"
- Goals: "No goals defined yet"
- Prompts: "No prompt templates yet"

5. Ensure all loading states use skeleton components matching final layout structure.

**Acceptance Criteria**:

- [ ] Error boundaries catch rendering errors and show retry UI
- [ ] `Cmd+B` toggles sidebar visibility
- [ ] All 4 views have meaningful empty states
- [ ] All views have skeleton loading states
- [ ] Error states show error message and retry mechanism
- [ ] Keyboard shortcut does not interfere with browser defaults

---

### Task 3E.2: Verify Code Splitting and Responsive Behavior

**Description**: Verify route-level code splitting works correctly, test responsive sidebar behavior, and run the full test suite.
**Size**: Small
**Priority**: Medium
**Dependencies**: All previous tasks
**Can run parallel with**: Task 3E.1

**Implementation Steps**:

1. Run `npm run build` in `apps/app/` and verify chunk output:
   - Confirm route chunks exist for each view
   - Confirm Recharts is NOT in the main chunk (only in prompts chunk)
   - Check approximate bundle sizes against budget:
     - Core: ~50KB gzipped
     - Issues: ~15KB
     - Issue Detail: ~25KB
     - Activity: ~8KB
     - Goals: ~8KB
     - Prompts: ~50KB (includes Recharts)

2. Test responsive sidebar behavior:
   - Desktop (>=1024px): Sidebar in icon collapsible mode
   - Mobile (<1024px): Sidebar hidden, opens as sheet overlay on trigger

3. Convert placeholder lazy routes to `createLazyFileRoute` pattern for proper code splitting:
   - Each route's component function should be in a lazy file
   - Search validation stays in the eager file

4. Run full test suite: `npm test`

5. Run type checking: `npm run typecheck`

**Acceptance Criteria**:

- [ ] Build succeeds without errors
- [ ] Route chunks are separate files in build output
- [ ] Recharts only loads on prompts route
- [ ] Sidebar behavior correct at desktop and mobile breakpoints
- [ ] All tests pass
- [ ] Type checking passes
- [ ] No console errors in dev mode

---

### Task 3E.3: Write Dashboard API Tests

**Description**: Write comprehensive tests for all 3 dashboard API endpoints using the existing PGlite test infrastructure.
**Size**: Medium
**Priority**: High
**Dependencies**: Tasks 3A.6, 3C.1, 3D.1
**Can run parallel with**: All frontend tasks

**Implementation Steps**:

Create `apps/api/src/__tests__/dashboard.test.ts`:

Test `GET /api/dashboard/stats`:

- Returns correct response shape with issues, goals, dispatch sections
- Issue counts by status and type are accurate
- Goal counts (total, active, achieved) are accurate
- Dispatch queue depth counts todo + backlog issues
- Active count counts in_progress issues
- Completed last 24h counts done issues with recent completedAt

Test `GET /api/dashboard/activity`:

- Returns pre-assembled chains with root + children
- Children include relations
- Chains sorted by latest activity (most recent first)
- Limit parameter controls chain count
- Root issues have no parentId
- Only non-deleted issues included

Test `GET /api/dashboard/prompts`:

- Returns templates with active version identified
- Recent versions limited to last 5
- Review aggregation averages are correct
- needsAttention = true when compositeScore < 3.0
- needsAttention = true when completionRate < 0.5
- needsAttention = false when both thresholds met

Test CORS:

- CORS headers present for allowed origins (localhost:3000, app.looped.me)
- CORS rejects disallowed origins

Use existing `withTestDb()` infrastructure for full isolation.

**Acceptance Criteria**:

- [ ] All dashboard endpoint tests pass
- [ ] CORS tests pass
- [ ] Tests use PGlite for full isolation
- [ ] Each test creates its own test data (no shared state)
- [ ] `npm test` passes

---

### Task 3E.4: Update Documentation

**Description**: Update CLAUDE.md with new dashboard API endpoints, frontend dependencies, and environment variables.
**Size**: Small
**Priority**: Low
**Dependencies**: All implementation tasks complete
**Can run parallel with**: None

**Implementation Steps**:

1. Add dashboard routes to the API Endpoints table in CLAUDE.md:

```
| `GET` | `/api/dashboard/stats` | System health metrics |
| `GET` | `/api/dashboard/activity` | Signal chains for activity timeline |
| `GET` | `/api/dashboard/prompts` | Template health with scores |
```

2. Update the App section to describe the dashboard views and tech stack.

3. Add `VITE_API_URL` and `VITE_LOOP_API_KEY` to the Environment Variables table.

4. Update the Tech Stack section with new frontend dependencies (TanStack Router, TanStack Query, shadcn/ui, ky, Recharts).

**Acceptance Criteria**:

- [ ] CLAUDE.md API endpoints table includes dashboard routes
- [ ] Environment variables documented
- [ ] Tech stack section updated
- [ ] All information is accurate

---

## Summary

| Phase     | Tasks        | Description                                                                 |
| --------- | ------------ | --------------------------------------------------------------------------- |
| 3A        | 6 tasks      | Foundation: deps, router, API client, types, sidebar, CORS + stats endpoint |
| 3B        | 3 tasks      | Issue Views: list with filters/table, detail with sub-components, markdown  |
| 3C        | 3 tasks      | Activity & Goals: activity endpoint, timeline, goals dashboard              |
| 3D        | 2 tasks      | Prompt Health: prompts endpoint, cards with sparklines                      |
| 3E        | 4 tasks      | Polish: empty states/errors/shortcuts, code splitting, API tests, docs      |
| **Total** | **18 tasks** |                                                                             |

## Parallel Execution Opportunities

- **Phase 3A**: Tasks 3A.1-3A.4 have limited dependencies; 3A.6 (API-side) can run in parallel with all frontend tasks
- **Phase 3B**: 3B.1 and 3B.2 can run in parallel; 3B.3 can run with either
- **Phase 3C**: 3C.1 (API) and 3C.3 (Goals) can run in parallel; 3C.2 depends on 3C.1
- **Phase 3D**: 3D.1 (API) can start while 3C tasks are in progress
- **Phase 3E**: 3E.1 and 3E.2 can run in parallel; 3E.3 can run with any frontend task

## Critical Path

3A.1 -> 3A.2 -> 3A.5 -> 3B.1 -> 3B.2 -> 3E.1 -> 3E.2

API critical path (can run in parallel): 3A.6 -> 3C.1 -> 3D.1 -> 3E.3
