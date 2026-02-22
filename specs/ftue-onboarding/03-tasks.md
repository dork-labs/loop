---
slug: ftue-onboarding
spec: 02-specification.md
created: 2026-02-22
---

# Tasks: FTUE Onboarding

## Phase 1: Foundation

### Task 1.1 — Install shadcn/ui Dialog, Tabs, and canvas-confetti dependencies

Install the required dependencies that don't exist in the project yet:
- `npx shadcn@latest add dialog tabs` in `apps/app/`
- `npm install canvas-confetti` and `npm install -D @types/canvas-confetti` in `apps/app/`

**Acceptance criteria:**
- `apps/app/src/components/ui/dialog.tsx` exists
- `apps/app/src/components/ui/tabs.tsx` exists
- `canvas-confetti` is in `apps/app/package.json` dependencies
- `@types/canvas-confetti` is in devDependencies
- `npm run typecheck` passes

### Task 1.2 — Create `use-onboarding` hook

Create `apps/app/src/hooks/use-onboarding.ts` with the following implementation:

```typescript
import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'loop:onboarding'

interface OnboardingState {
  welcomed: boolean
  completedAt: string | null
}

interface UseOnboardingReturn {
  state: OnboardingState
  /** True when user has been welcomed but hasn't received first issue yet. */
  isOnboarding: boolean
  /** Mark the welcome modal as dismissed. */
  markWelcomed: () => void
  /** Mark onboarding as complete with current timestamp. */
  markComplete: () => void
}

const DEFAULT_STATE: OnboardingState = { welcomed: false, completedAt: null }

function getState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_STATE
    const parsed = JSON.parse(raw) as Partial<OnboardingState>
    return {
      welcomed: parsed.welcomed === true,
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
    }
  } catch {
    return DEFAULT_STATE
  }
}

function setState(next: OnboardingState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  // Dispatch storage event so useSyncExternalStore picks up the change
  window.dispatchEvent(new Event('onboarding-change'))
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('onboarding-change', callback)
  return () => window.removeEventListener('onboarding-change', callback)
}

/**
 * Manages FTUE onboarding state backed by localStorage.
 *
 * @param issueCount - Current number of issues (0 means still onboarding)
 */
export function useOnboarding(issueCount: number): UseOnboardingReturn {
  const state = useSyncExternalStore(subscribe, getState, () => DEFAULT_STATE)

  const isOnboarding = state.welcomed && !state.completedAt && issueCount === 0

  const markWelcomed = useCallback(() => {
    setState({ ...getState(), welcomed: true })
  }, [])

  const markComplete = useCallback(() => {
    setState({ ...getState(), completedAt: new Date().toISOString() })
  }, [])

  return { state, isOnboarding, markWelcomed, markComplete }
}
```

**Key behaviors:**
- Reads/writes localStorage key `loop:onboarding`
- `isOnboarding` is true when: `welcomed === true` AND `completedAt === null` AND `issueCount === 0`
- Uses `useSyncExternalStore` for reactivity without `useState`
- Handles malformed JSON gracefully (falls back to defaults)
- Steps 1-3 completion is tracked in component-local state, not here

**Acceptance criteria:**
- Hook reads from localStorage on mount
- `markWelcomed()` sets `welcomed: true`
- `markComplete()` sets `completedAt` to ISO timestamp
- Falls back to defaults on malformed JSON
- `npm run typecheck` passes

### Task 1.3 — Create welcome modal component

Create `apps/app/src/components/welcome-modal.tsx`:

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface WelcomeModalProps {
  open: boolean
  onClose: () => void
}

/** One-time welcome dialog shown on first visit to the dashboard. */
export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="space-y-4 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary/10">
            <svg
              className="size-8 text-primary"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
              <path d="M8 12l2 2 4-4" />
            </svg>
          </div>
          <DialogTitle className="text-2xl font-bold">Welcome to Loop</DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-muted-foreground">
            Loop collects signals, organizes work into issues, and tells your AI
            agent what to do next.
            <br />
            <br />
            Let&apos;s get you connected.
          </DialogDescription>
        </DialogHeader>
        <Button className="mt-4 w-full" onClick={onClose}>
          Get Started
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

**Design notes:**
- Non-dismissible via backdrop click or Escape (user must click CTA)
- Uses shadcn/ui Dialog with `onPointerDownOutside` and `onEscapeKeyDown` preventDefault
- Centered content with icon, heading, description, and full-width CTA button
- `max-w-md` container

**Acceptance criteria:**
- Renders when `open={true}`, hidden when `open={false}`
- Cannot be dismissed by clicking outside or pressing Escape
- Calls `onClose` when "Get Started" is clicked
- `npm run typecheck` passes

### Task 1.4 — Create setup code snippet component

Create `apps/app/src/components/setup-code-snippet.tsx`:

```typescript
import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'

interface SetupCodeSnippetProps {
  apiUrl: string
  apiKey: string
  onCopy?: () => void
}

type Language = 'curl' | 'javascript' | 'python'

function buildSnippet(lang: Language, apiUrl: string, apiKey: string): string {
  switch (lang) {
    case 'curl':
      return `curl -X POST ${apiUrl}/api/issues \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My first issue",
    "type": "task",
    "status": "todo"
  }'`
    case 'javascript':
      return `const response = await fetch("${apiUrl}/api/issues", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "My first issue",
    type: "task",
    status: "todo",
  }),
});

const data = await response.json();
console.log(data);`
    case 'python':
      return `import requests

response = requests.post(
    "${apiUrl}/api/issues",
    headers={
        "Authorization": "Bearer ${apiKey}",
        "Content-Type": "application/json",
    },
    json={
        "title": "My first issue",
        "type": "task",
        "status": "todo",
    },
)

print(response.json())`
  }
}

/** Tabbed code block showing curl/JS/Python snippets with real API credentials injected. */
export function SetupCodeSnippet({ apiUrl, apiKey, onCopy }: SetupCodeSnippetProps) {
  const [copiedTab, setCopiedTab] = useState<Language | null>(null)
  const [activeTab, setActiveTab] = useState<Language>('curl')

  const handleCopy = useCallback(
    async (lang: Language) => {
      const snippet = buildSnippet(lang, apiUrl, apiKey)
      await navigator.clipboard.writeText(snippet)
      setCopiedTab(lang)
      onCopy?.()
      setTimeout(() => setCopiedTab(null), 2000)
    },
    [apiUrl, apiKey, onCopy],
  )

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Language)}>
      <TabsList className="h-auto bg-transparent p-0">
        <TabsTrigger value="curl" className="text-sm">curl</TabsTrigger>
        <TabsTrigger value="javascript" className="text-sm">JavaScript</TabsTrigger>
        <TabsTrigger value="python" className="text-sm">Python</TabsTrigger>
      </TabsList>
      {(['curl', 'javascript', 'python'] as const).map((lang) => (
        <TabsContent key={lang} value={lang} className="relative mt-2">
          <div className="relative rounded-md bg-muted p-4 font-mono text-sm">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 size-7"
              onClick={() => void handleCopy(lang)}
            >
              {copiedTab === lang ? (
                <Check className="size-3.5 text-green-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
            <pre className="overflow-x-auto whitespace-pre-wrap pr-10">
              {buildSnippet(lang, apiUrl, apiKey)}
            </pre>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
```

**Design notes:**
- Uses shadcn/ui Tabs with 3 tabs: curl, JavaScript, Python
- Injects real `apiUrl` and `apiKey` (from env vars) into snippets
- Copy button in top-right corner, shows checkmark for 2 seconds after copy
- No syntax highlighting — plain monospace
- Calls optional `onCopy` callback (used by checklist to mark step complete)

**Acceptance criteria:**
- All three tabs render with correct snippet content
- API URL and key are injected into snippets (no placeholders)
- Copy button calls `navigator.clipboard.writeText` with correct content
- Checkmark icon shows for 2 seconds after copy
- `npm run typecheck` passes

### Task 1.5 — Create setup checklist component

Create `apps/app/src/components/setup-checklist.tsx`:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from '@tanstack/react-router'
import { Check, Copy, Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupCodeSnippet } from '@/components/setup-code-snippet'
import { env } from '@/env'

interface SetupChecklistProps {
  onComplete: () => void
  issueCount: number
  firstIssueId?: string
}

/** FTUE setup checklist guiding users through their first API connection. */
export function SetupChecklist({ onComplete, issueCount, firstIssueId }: SetupChecklistProps) {
  const [copiedSteps, setCopiedSteps] = useState<Record<number, boolean>>({})
  const [showKey, setShowKey] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const celebrationFired = useRef(false)

  const apiUrl = env.VITE_API_URL
  const apiKey = env.VITE_LOOP_API_KEY

  const maskedKey = `${apiKey.slice(0, 3)}${'•'.repeat(Math.max(apiKey.length - 3, 8))}`

  const handleCopy = useCallback(async (step: number, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedSteps((prev) => ({ ...prev, [step]: true }))
    setTimeout(() => setCopiedSteps((prev) => ({ ...prev, [step]: false })), 2000)
  }, [])

  // Celebration trigger when first issue arrives
  useEffect(() => {
    if (issueCount === 0 || celebrationFired.current) return
    celebrationFired.current = true

    const fireCelebration = async () => {
      const confetti = (await import('canvas-confetti')).default
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
      setShowSuccess(true)
      onComplete()
    }

    if (document.visibilityState === 'visible') {
      void fireCelebration()
    } else {
      const handler = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', handler)
          void fireCelebration()
        }
      }
      document.addEventListener('visibilitychange', handler)
      return () => document.removeEventListener('visibilitychange', handler)
    }
  }, [issueCount, onComplete])

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border bg-card py-20 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-500/10">
          <Check className="size-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold">Loop is connected!</h2>
        <p className="text-muted-foreground">
          Your first issue just arrived. The loop is ready to run.
        </p>
        {firstIssueId && (
          <Button asChild className="mt-2">
            <Link to="/issues/$issueId" params={{ issueId: firstIssueId }}>
              View Issue
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Connect your AI agent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow these steps to send your first issue to Loop
        </p>
      </div>
      <div className="space-y-6">
        {/* Step 1: API Endpoint */}
        <SetupStep
          number={1}
          title="API Endpoint"
          completed={copiedSteps[1] ?? false}
        >
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-sm">{apiUrl}</code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleCopy(1, apiUrl)}
            >
              {copiedSteps[1] ? (
                <><Check className="mr-1 size-3.5 text-green-500" /> Copied!</>
              ) : (
                <><Copy className="mr-1 size-3.5" /> Copy</>
              )}
            </Button>
          </div>
        </SetupStep>

        {/* Step 2: API Key */}
        <SetupStep
          number={2}
          title="API Key"
          completed={copiedSteps[2] ?? false}
        >
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
              {showKey ? apiKey : maskedKey}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setShowKey((prev) => !prev)}
            >
              {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleCopy(2, apiKey)}
            >
              {copiedSteps[2] ? (
                <><Check className="mr-1 size-3.5 text-green-500" /> Copied!</>
              ) : (
                <><Copy className="mr-1 size-3.5" /> Copy</>
              )}
            </Button>
          </div>
        </SetupStep>

        {/* Step 3: Code Snippet */}
        <SetupStep
          number={3}
          title="Send your first issue"
          completed={copiedSteps[3] ?? false}
        >
          <SetupCodeSnippet
            apiUrl={apiUrl}
            apiKey={apiKey}
            onCopy={() => setCopiedSteps((prev) => ({ ...prev, [3]: true }))}
          />
        </SetupStep>

        {/* Step 4: Listening */}
        <SetupStep
          number={4}
          title="Listening for your first issue..."
          completed={false}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Polling every 3 seconds...</span>
          </div>
        </SetupStep>
      </div>
    </div>
  )
}

// ─── Sub-component ─────────────────────────────────────────────────────────────

interface SetupStepProps {
  number: number
  title: string
  completed: boolean
  children: React.ReactNode
}

function SetupStep({ number, title, completed, children }: SetupStepProps) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div
          className={`flex size-7 items-center justify-center rounded-full border text-xs font-medium ${
            completed
              ? 'border-green-500 bg-green-500/10 text-green-500'
              : 'border-border text-muted-foreground'
          }`}
        >
          {completed ? <Check className="size-3.5" /> : number}
        </div>
      </div>
      <div className="flex-1 space-y-2 pb-2">
        <p className={`text-sm font-medium ${completed ? 'text-muted-foreground' : ''}`}>
          {title}
        </p>
        {children}
      </div>
    </div>
  )
}
```

**Key behaviors:**
- 4 steps: API Endpoint (copy), API Key (copy with reveal/mask), Code Snippet (tabbed), Listening (animated spinner)
- Steps 1-3 mark as complete independently when copy buttons are clicked (component-local state)
- Step 4 auto-completes when `issueCount > 0`
- API key masked by default (`sk-••••••••`), toggleable with eye icon
- Copy always copies full key regardless of mask state
- When `issueCount` transitions from 0 to >0: fire confetti (lazy-loaded), show success UI
- Page Visibility API gates celebration (queues if tab is backgrounded)
- Success state shows "Loop is connected!" with optional "View Issue" link

**Acceptance criteria:**
- All 4 steps render correctly
- Copy buttons work and show checkmark feedback
- API key mask/reveal toggle works
- Confetti fires when first issue arrives
- Confetti queues when tab is not visible, fires on visibility change
- Success UI renders with "View Issue" link
- `npm run typecheck` passes

## Phase 2: Integration

### Task 2.1 — Add conditional polling to issue list query options

Modify `apps/app/src/lib/queries/issues.ts` to accept an optional `polling` parameter:

**Current code:**
```typescript
export const issueListOptions = (filters: Record<string, string>) =>
  queryOptions({
    queryKey: queryKeys.issues.list(filters),
    queryFn: () => issuesApi.list(filters),
    staleTime: 30_000,
  })
```

**Updated code:**
```typescript
/** Query options for the paginated/filtered issues list. */
export const issueListOptions = (
  filters: Record<string, string>,
  options?: { polling?: boolean }
) =>
  queryOptions({
    queryKey: queryKeys.issues.list(filters),
    queryFn: () => issuesApi.list(filters),
    staleTime: 30_000,
    refetchInterval: options?.polling
      ? (query) => {
          const hasData = (query.state.data?.data?.length ?? 0) > 0
          return hasData ? false : 3000
        }
      : undefined,
  })
```

**Behavior:**
- When `polling: true`, refetches every 3 seconds until data arrives
- Stops polling (`false`) once `data.length > 0`
- When `polling` is not provided or false, no `refetchInterval` (existing behavior unchanged)

**Acceptance criteria:**
- Existing callers (without `options`) are unaffected
- When `polling: true`, query refetches every 3s until data appears
- Polling stops when data arrives
- `npm run typecheck` passes

### Task 2.2 — Integrate FTUE into issues page

Modify `apps/app/src/routes/_dashboard/issues/index.lazy.tsx` to conditionally render the FTUE checklist or data table.

**Updated implementation:**
```typescript
import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { Inbox } from 'lucide-react'
import { issueListOptions } from '@/lib/queries/issues'
import { IssueDataTable } from '@/components/issue-table/data-table'
import { IssueFilters } from '@/components/issue-table/filters'
import { ErrorState } from '@/components/error-state'
import { WelcomeModal } from '@/components/welcome-modal'
import { SetupChecklist } from '@/components/setup-checklist'
import { useOnboarding } from '@/hooks/use-onboarding'

export const Route = createLazyFileRoute('/_dashboard/issues/')({
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

  const issueCount = data?.data?.length ?? 0
  const { state, isOnboarding, markWelcomed, markComplete } = useOnboarding(issueCount)

  const { data, isFetching, error } = useQuery(
    issueListOptions(filters, {
      polling: isOnboarding || (!state.welcomed),
    })
  )

  if (error) {
    return (
      <ErrorState
        message={`Failed to load issues: ${error.message}`}
        onRetry={() => window.location.reload()}
      />
    )
  }

  const firstIssueId = data?.data?.[0]?.id

  // Show welcome modal on first ever visit
  const showWelcome = !state.welcomed && issueCount === 0

  // Show checklist when onboarding in progress
  const showChecklist = isOnboarding || (!state.welcomed && issueCount === 0)

  // Show improved empty state when onboarding is done but no issues
  const showEmptyState = !showChecklist && issueCount === 0 && !isFetching

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Issues</h1>

      <WelcomeModal open={showWelcome} onClose={markWelcomed} />

      {showChecklist && !showWelcome ? (
        <SetupChecklist
          onComplete={markComplete}
          issueCount={issueCount}
          firstIssueId={firstIssueId}
        />
      ) : showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-center">
          <Inbox className="size-12 text-muted-foreground opacity-30" />
          <p className="text-base font-medium">No issues found</p>
          <p className="text-sm text-muted-foreground">
            Issues appear here as signals flow through the loop. Try adjusting
            your filters or send a new signal.
          </p>
        </div>
      ) : (
        <>
          <IssueFilters />
          <IssueDataTable
            data={data?.data ?? []}
            total={data?.total ?? 0}
            page={search.page}
            limit={search.limit}
            isLoading={isFetching && !data}
          />
        </>
      )}
    </div>
  )
}
```

**Note:** The variable ordering above has `issueCount` derived from `data` before `data` is declared. The actual implementation must declare `useQuery` first, then derive `issueCount`. The hook order must also be valid (no conditional hooks). Adjust accordingly:

1. Call `useQuery` first (with a temporary polling value)
2. Derive `issueCount` from the query result
3. Call `useOnboarding(issueCount)`

OR use a different approach: call `useOnboarding(0)` initially and update via effect. The simplest approach is to split: use `useOnboarding` with a ref or derive `isOnboarding` from query data directly.

**Recommended hook order fix:**
```typescript
function IssueListPage() {
  const search = Route.useSearch()
  const filters = useMemo(() => { /* same as before */ }, [search])

  // First query without polling to get initial data
  const { data, isFetching, error } = useQuery(issueListOptions(filters))

  const issueCount = data?.data?.length ?? 0
  const { state, isOnboarding, markWelcomed, markComplete } = useOnboarding(issueCount)

  // Enable polling when onboarding is active — this works because
  // TanStack Query's refetchInterval is reactive
  const { data: polledData } = useQuery({
    ...issueListOptions(filters),
    refetchInterval: (isOnboarding || !state.welcomed)
      ? (query) => {
          const hasData = (query.state.data?.data?.length ?? 0) > 0
          return hasData ? false : 3000
        }
      : undefined,
  })
```

Actually, simpler: just pass the polling option inline since `issueListOptions` returns the same queryKey and TanStack Query deduplicates. The cleanest approach:

```typescript
function IssueListPage() {
  const search = Route.useSearch()
  const filters = useMemo(() => { /* ... */ }, [search])

  // Read onboarding state directly (not from hook, to avoid circular dep)
  const onboardingState = useMemo(() => {
    try {
      const raw = localStorage.getItem('loop:onboarding')
      if (!raw) return { welcomed: false, completedAt: null }
      return JSON.parse(raw) as { welcomed: boolean; completedAt: string | null }
    } catch {
      return { welcomed: false, completedAt: null }
    }
  }, [])

  const shouldPoll = !onboardingState.completedAt

  const { data, isFetching, error } = useQuery(
    issueListOptions(filters, { polling: shouldPoll })
  )

  const issueCount = data?.data?.length ?? 0
  const { state, isOnboarding, markWelcomed, markComplete } = useOnboarding(issueCount)

  // ... rest of render
}
```

The implementer should resolve this hook ordering to ensure no Rules of Hooks violations. The key constraint is: `useOnboarding` needs `issueCount`, and `useQuery` needs `isOnboarding` for polling. Break the cycle by reading localStorage synchronously for the polling decision (since it only needs `completedAt`), and use the hook for reactive state.

**Acceptance criteria:**
- Welcome modal shows on first visit (no localStorage key)
- After clicking "Get Started", setup checklist replaces the empty state
- When issues exist, normal data table renders
- Polling is active during onboarding
- Post-onboarding empty state shows improved copy
- No Rules of Hooks violations
- `npm run typecheck` passes

### Task 2.3 — Remove empty state from data-table component

Modify `apps/app/src/components/issue-table/data-table.tsx` to remove the internal empty state rendering (lines 76-86 in the current file). The empty state is now handled at the page level in `issues/index.lazy.tsx`.

**Remove this block from `IssueDataTable`:**
```typescript
  if (!isLoading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-center">
        <Inbox className="size-12 text-muted-foreground opacity-30" />
        <p className="text-base font-medium">No issues found</p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters to see more results.
        </p>
      </div>
    )
  }
```

Also remove the `Inbox` import from `lucide-react` if it's no longer used in this file.

**Acceptance criteria:**
- `IssueDataTable` no longer renders its own empty state
- Empty state is handled by the parent page (`issues/index.lazy.tsx`)
- `Inbox` import is removed from data-table.tsx
- `npm run typecheck` passes

## Phase 3: Empty State Improvements

### Task 3.1 — Update activity page empty state copy

Modify `apps/app/src/routes/_dashboard/activity/index.lazy.tsx`.

**Current empty state (lines 33-37):**
```tsx
<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-muted-foreground">
  <Activity className="size-12 opacity-30" />
  <p className="text-lg">No activity yet</p>
  <p className="text-sm">The loop is waiting for signals</p>
</div>
```

**Updated empty state:**
```tsx
<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-center text-muted-foreground">
  <Activity className="size-12 opacity-30" />
  <p className="text-lg">No activity yet</p>
  <p className="max-w-sm text-sm">
    Activity shows the flow of signals through the loop. Once your agent starts
    creating issues, you&apos;ll see the timeline here.
  </p>
</div>
```

**Changes:**
- Added `text-center` to container
- Added `max-w-sm` to description for readability
- Updated description text to be more helpful and contextual

**Acceptance criteria:**
- Empty state shows updated copy
- Visual layout remains consistent with other empty states
- `npm run typecheck` passes

### Task 3.2 — Update goals page empty state copy

Modify `apps/app/src/routes/_dashboard/goals/index.lazy.tsx`.

**Current empty state (lines 47-50):**
```tsx
<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-muted-foreground">
  <Target className="size-12 opacity-30" />
  <p className="text-lg">No goals defined yet</p>
</div>
```

**Updated empty state:**
```tsx
<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-center text-muted-foreground">
  <Target className="size-12 opacity-30" />
  <p className="text-lg">No goals defined yet</p>
  <p className="max-w-sm text-sm">
    Goals track measurable outcomes for your projects. Create a project with a
    goal to see progress here.
  </p>
</div>
```

**Changes:**
- Added `text-center` to container
- Added description paragraph explaining what goals are and how to get started

**Acceptance criteria:**
- Empty state shows heading + new description
- `npm run typecheck` passes

### Task 3.3 — Update prompts page empty state copy

Modify `apps/app/src/routes/_dashboard/prompts/index.lazy.tsx`.

**Current empty state (lines 44-50):**
```tsx
<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-muted-foreground">
  <Sparkles className="size-12 opacity-30" />
  <p className="text-lg">No prompt templates yet</p>
  <p className="text-sm">
    Templates are created when the dispatch engine first runs
  </p>
</div>
```

**Updated empty state:**
```tsx
<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-center text-muted-foreground">
  <Sparkles className="size-12 opacity-30" />
  <p className="text-lg">No prompt templates yet</p>
  <p className="max-w-sm text-sm">
    Prompt templates tell your AI agent what to do. They&apos;re created when
    the dispatch engine runs for the first time.
  </p>
</div>
```

**Changes:**
- Added `text-center` and `max-w-sm` for consistency
- Updated description text to be warmer and more explanatory

**Acceptance criteria:**
- Empty state shows updated copy
- `npm run typecheck` passes

## Phase 4: Testing

### Task 4.1 — Write unit tests for use-onboarding hook

Create `apps/app/src/__tests__/hooks/use-onboarding.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnboarding } from '@/hooks/use-onboarding'

describe('useOnboarding', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns default state when localStorage is empty', () => {
    const { result } = renderHook(() => useOnboarding(0))
    expect(result.current.state).toEqual({ welcomed: false, completedAt: null })
  })

  it('returns stored state when localStorage has data', () => {
    localStorage.setItem('loop:onboarding', JSON.stringify({ welcomed: true, completedAt: null }))
    const { result } = renderHook(() => useOnboarding(0))
    expect(result.current.state.welcomed).toBe(true)
    expect(result.current.state.completedAt).toBeNull()
  })

  it('markWelcomed sets welcomed to true', () => {
    const { result } = renderHook(() => useOnboarding(0))
    act(() => result.current.markWelcomed())
    expect(result.current.state.welcomed).toBe(true)
  })

  it('markComplete sets completedAt to ISO string', () => {
    localStorage.setItem('loop:onboarding', JSON.stringify({ welcomed: true, completedAt: null }))
    const { result } = renderHook(() => useOnboarding(0))
    act(() => result.current.markComplete())
    expect(result.current.state.completedAt).toBeTruthy()
    expect(() => new Date(result.current.state.completedAt!)).not.toThrow()
  })

  it('isOnboarding is true when welcomed and no completedAt and no issues', () => {
    localStorage.setItem('loop:onboarding', JSON.stringify({ welcomed: true, completedAt: null }))
    const { result } = renderHook(() => useOnboarding(0))
    expect(result.current.isOnboarding).toBe(true)
  })

  it('isOnboarding is false when completedAt is set', () => {
    localStorage.setItem('loop:onboarding', JSON.stringify({ welcomed: true, completedAt: '2026-01-01T00:00:00Z' }))
    const { result } = renderHook(() => useOnboarding(0))
    expect(result.current.isOnboarding).toBe(false)
  })

  it('isOnboarding is false when issues exist', () => {
    localStorage.setItem('loop:onboarding', JSON.stringify({ welcomed: true, completedAt: null }))
    const { result } = renderHook(() => useOnboarding(5))
    expect(result.current.isOnboarding).toBe(false)
  })

  it('handles malformed localStorage JSON gracefully', () => {
    localStorage.setItem('loop:onboarding', 'not-json')
    const { result } = renderHook(() => useOnboarding(0))
    expect(result.current.state).toEqual({ welcomed: false, completedAt: null })
  })
})
```

**Dependencies:** `@testing-library/react` must be available (check if installed, add if needed).

**Acceptance criteria:**
- All 8 test cases pass
- Covers default state, stored state, mutations, derived `isOnboarding`, and malformed JSON
- `npx vitest run apps/app/src/__tests__/hooks/use-onboarding.test.ts` passes

### Task 4.2 — Write component tests for setup-code-snippet

Create `apps/app/src/__tests__/components/setup-code-snippet.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SetupCodeSnippet } from '@/components/setup-code-snippet'

describe('SetupCodeSnippet', () => {
  const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => {
    vi.stubGlobal('navigator', { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('renders all three tabs', () => {
    render(<SetupCodeSnippet apiUrl="http://localhost:5667" apiKey="sk-test-key" />)
    expect(screen.getByRole('tab', { name: /curl/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /javascript/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /python/i })).toBeInTheDocument()
  })

  it('injects API URL and API key into snippet content', () => {
    render(<SetupCodeSnippet apiUrl="http://test-api.com" apiKey="sk-my-secret" />)
    expect(screen.getByText(/http:\/\/test-api\.com\/api\/issues/)).toBeInTheDocument()
    expect(screen.getByText(/sk-my-secret/)).toBeInTheDocument()
  })

  it('copy button calls navigator.clipboard.writeText with correct curl content', async () => {
    render(<SetupCodeSnippet apiUrl="http://localhost:5667" apiKey="sk-test" />)
    const copyButtons = screen.getAllByRole('button')
    await fireEvent.click(copyButtons[0]) // First copy button (curl tab)
    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('curl -X POST http://localhost:5667/api/issues')
    )
  })

  it('tab switching shows the correct snippet', async () => {
    render(<SetupCodeSnippet apiUrl="http://localhost:5667" apiKey="sk-test" />)
    await fireEvent.click(screen.getByRole('tab', { name: /python/i }))
    expect(screen.getByText(/import requests/)).toBeInTheDocument()
  })
})
```

**Dependencies:** `@testing-library/react`, `@testing-library/jest-dom` (for `toBeInTheDocument`)

**Acceptance criteria:**
- All 4 test cases pass
- Tests verify tab rendering, credential injection, clipboard copy, and tab switching
- `npx vitest run apps/app/src/__tests__/components/setup-code-snippet.test.tsx` passes

### Task 4.3 — Write component tests for setup-checklist and welcome-modal

Create `apps/app/src/__tests__/components/setup-checklist.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SetupChecklist } from '@/components/setup-checklist'

// Mock env
vi.mock('@/env', () => ({
  env: {
    VITE_API_URL: 'http://localhost:5667',
    VITE_LOOP_API_KEY: 'sk-test-key-123',
  },
}))

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

describe('SetupChecklist', () => {
  const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }

  beforeEach(() => {
    vi.stubGlobal('navigator', { clipboard: mockClipboard })
    mockClipboard.writeText.mockClear()
  })

  it('renders all 4 steps', () => {
    render(<SetupChecklist onComplete={vi.fn()} issueCount={0} />)
    expect(screen.getByText('API Endpoint')).toBeInTheDocument()
    expect(screen.getByText('API Key')).toBeInTheDocument()
    expect(screen.getByText('Send your first issue')).toBeInTheDocument()
    expect(screen.getByText(/Listening for your first issue/)).toBeInTheDocument()
  })

  it('step 4 shows animated spinner', () => {
    render(<SetupChecklist onComplete={vi.fn()} issueCount={0} />)
    expect(screen.getByText(/Polling every 3 seconds/)).toBeInTheDocument()
  })

  it('calls onComplete when issueCount transitions from 0 to >0', async () => {
    const onComplete = vi.fn()
    // Mock confetti
    vi.mock('canvas-confetti', () => ({ default: vi.fn() }))
    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true })

    const { rerender } = render(
      <SetupChecklist onComplete={onComplete} issueCount={0} />
    )
    rerender(<SetupChecklist onComplete={onComplete} issueCount={1} firstIssueId="issue-1" />)

    // onComplete should be called after confetti (async)
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalled())
  })
})
```

Create `apps/app/src/__tests__/components/welcome-modal.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WelcomeModal } from '@/components/welcome-modal'

describe('WelcomeModal', () => {
  it('renders when open is true', () => {
    render(<WelcomeModal open={true} onClose={vi.fn()} />)
    expect(screen.getByText('Welcome to Loop')).toBeInTheDocument()
  })

  it('does not render content when open is false', () => {
    render(<WelcomeModal open={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Welcome to Loop')).not.toBeInTheDocument()
  })

  it('calls onClose when Get Started is clicked', () => {
    const onClose = vi.fn()
    render(<WelcomeModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /get started/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

**Acceptance criteria:**
- All setup-checklist tests pass (4 steps render, spinner shows, onComplete fires)
- All welcome-modal tests pass (open/close rendering, CTA callback)
- `npx vitest run apps/app/src/__tests__/components/` passes
