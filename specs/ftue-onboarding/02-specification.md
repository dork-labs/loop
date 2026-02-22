---
slug: ftue-onboarding
number: 9
created: 2026-02-22
status: draft
---

# Specification: FTUE Onboarding

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-22
**Ideation:** [01-ideation.md](./01-ideation.md)

---

## Overview

Build a First Time User Experience (FTUE) that guides new users through connecting their AI agent to Loop's API. The current dashboard shows bare empty states ("No issues found") with no guidance. This spec defines a 4-phase onboarding flow — Welcome Modal, Inline Setup Checklist, Polling for First Issue, Confetti Celebration — plus improved empty states across all pages.

The primary activation event is receiving the first issue via the API. Everything is designed to get the user from "empty dashboard" to "first issue received" as fast as possible.

## Background / Problem Statement

When a new user opens the Loop dashboard for the first time, they see empty pages with no guidance on what to do next. The issues page shows "No issues found — Try adjusting your filters," which is incorrect (there are no filters to adjust — there's no data). Goals shows "No goals defined yet" with no explanation of what goals are. Activity says "The loop is waiting for signals" but doesn't explain how to send signals.

This is the critical drop-off point. Users who don't connect their AI agent in the first session rarely come back. The FTUE must:
1. Explain what Loop does (warm framing)
2. Give copy-paste instructions to send the first issue (activation)
3. Confirm the connection worked (validation)
4. Celebrate success (emotional anchor)

## Goals

- Guide new users from empty dashboard to first issue received in under 2 minutes
- Provide copy-paste code snippets with pre-injected API credentials (no placeholder keys)
- Auto-detect when the first issue arrives via polling (no manual refresh)
- Celebrate success with confetti when the tab is visible
- Improve all empty states across the app with contextual, helpful copy
- Zero backend changes — frontend only

## Non-Goals

- User authentication / account creation
- CLI tool onboarding (separate spec #5)
- Webhook setup (PostHog/GitHub/Sentry) — secondary flow
- Marketing site changes
- Server-side onboarding state tracking
- Onboarding analytics / tracking events

## Technical Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `canvas-confetti` | latest | Celebration animation (4.4KB, zero deps) |
| `@shadcn/ui` Dialog | - | Welcome modal (needs installation) |
| `@shadcn/ui` Tabs | - | Code snippet language tabs (needs installation) |

**Existing dependencies used:** React 19, TanStack Query v5, TanStack Router, ky, Lucide React, Tailwind CSS v4, Zod

**Note:** Dialog and Tabs are not currently installed in the shadcn/ui component set. They need to be added via `npx shadcn@latest add dialog tabs`.

## Detailed Design

### Architecture Overview

```
User opens app
    │
    ▼
_dashboard.tsx layout
    │
    ▼
Redirect to /issues
    │
    ▼
IssueListPage checks: has issues?
    │
    ├── YES → Normal issues table
    │
    └── NO → Check localStorage: welcomed?
              │
              ├── NO → Show WelcomeModal
              │         User clicks "Get Started"
              │         Set localStorage welcomed=true
              │         Show SetupChecklist
              │
              └── YES → Show SetupChecklist
                         │
                         Steps 1-3: Copy API URL, Key, Snippet
                         Step 4: Polling (refetchInterval: 3s)
                         │
                         First issue arrives
                         │
                         ▼
                         Is tab visible?
                         ├── YES → Fire confetti + success message
                         └── NO → Queue, fire on visibilitychange
                                   │
                                   ▼
                                   Show normal issues table
```

### Component Hierarchy

```
IssueListPage (issues/index.lazy.tsx)
├── IssueFilters
├── [data.length === 0 && !onboarding.completedAt]
│   └── SetupChecklist
│       ├── SetupStep (API Endpoint — copy)
│       ├── SetupStep (API Key — copy with reveal)
│       ├── SetupCodeSnippet (tabbed: curl/JS/Python)
│       └── SetupStep (Listening... — animated)
├── [data.length === 0 && onboarding.completedAt]
│   └── Empty state: "No issues found"
└── [data.length > 0]
    └── IssueDataTable
```

### New Files

| File | Purpose |
|---|---|
| `components/welcome-modal.tsx` | One-time welcome dialog |
| `components/setup-checklist.tsx` | Main FTUE checklist (4 steps) |
| `components/setup-code-snippet.tsx` | Tabbed code block with copy button |
| `hooks/use-onboarding.ts` | Onboarding state management (localStorage + polling detection) |

### Modified Files

| File | Change |
|---|---|
| `routes/_dashboard/issues/index.lazy.tsx` | Conditional render: FTUE checklist vs. data table when empty |
| `components/issue-table/data-table.tsx` | Remove internal empty state (moved to page level) |
| `routes/_dashboard/activity/index.lazy.tsx` | Update empty state copy |
| `routes/_dashboard/goals/index.lazy.tsx` | Update empty state copy |
| `routes/_dashboard/prompts/index.lazy.tsx` | Update empty state copy |
| `lib/queries/issues.ts` | Add conditional `refetchInterval` to `issueListOptions` |

### Component Specifications

#### 1. `hooks/use-onboarding.ts`

```typescript
interface OnboardingState {
  welcomed: boolean
  completedAt: string | null
}

interface UseOnboardingReturn {
  state: OnboardingState
  isOnboarding: boolean       // welcomed && !completedAt && no issues
  markWelcomed: () => void
  markComplete: () => void
}
```

**Behavior:**
- Reads/writes localStorage key `loop:onboarding`
- `isOnboarding` is true when: `welcomed === true` AND `completedAt === null` AND issue count is 0
- `markWelcomed()` sets `welcomed: true` in localStorage
- `markComplete()` sets `completedAt` to current ISO timestamp
- Defaults to `{ welcomed: false, completedAt: null }` if key missing
- Does NOT use React state for the localStorage values — reads synchronously on mount, writes on action

**Step completion tracking:**
- Steps 1-3 (copy actions) are tracked in component-local state, not localStorage
- Step 4 (first issue) is derived from query data, not stored
- No need to persist step completion — if user refreshes, steps reset but the checklist still shows

#### 2. `components/welcome-modal.tsx`

**Props:** `{ open: boolean; onClose: () => void }`

**Design:**
- Uses shadcn/ui `Dialog` component
- Non-dismissible via backdrop click (user must click CTA)
- Single screen, no multi-step

**Content:**
```
┌─────────────────────────────────────────────┐
│                                             │
│           ◯ (Loop icon or subtle graphic)   │
│                                             │
│         Welcome to Loop                     │
│                                             │
│  Loop collects signals, organizes work      │
│  into issues, and tells your AI agent       │
│  what to do next.                           │
│                                             │
│  Let's get you connected.                   │
│                                             │
│            [ Get Started ]                  │
│                                             │
└─────────────────────────────────────────────┘
```

**Styling:**
- Container: `max-w-md` centered
- Heading: `text-2xl font-bold`
- Body: `text-muted-foreground text-base leading-relaxed`
- CTA: shadcn `Button` default variant, full width or auto

#### 3. `components/setup-checklist.tsx`

**Props:** `{ onComplete: () => void; issueCount: number }`

**Design:**
- Replaces the issues page empty state
- Uses the existing empty state container pattern: `rounded-lg border border-border bg-card`
- 4 sequential steps with checkmarks
- No dismiss/skip button — auto-hides when `issueCount > 0`

**Step layout:**
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Connect your AI agent                               │
│  Follow these steps to send your first issue to Loop │
│                                                      │
│  ────────────────────────────────────────────────     │
│                                                      │
│  ✓  1. API Endpoint                                  │
│     http://localhost:5667    [ Copy ✓ ]               │
│                                                      │
│  ✓  2. API Key                                       │
│     ••••••••••••••••  [👁] [ Copy ✓ ]                │
│                                                      │
│  ○  3. Send your first issue                         │
│     [curl] [JavaScript] [Python]                     │
│     ┌──────────────────────────────────────┐         │
│     │ curl -X POST http://localhost:5667/  │  [ ⧉ ]  │
│     │   api/issues \                       │         │
│     │   -H "Authorization: Bearer sk-..." │         │
│     │   -H "Content-Type: application/   │         │
│     │       json" \                        │         │
│     │   -d '{"title": "My first issue",  │         │
│     │        "type": "task",              │         │
│     │        "status": "todo"}'           │         │
│     └──────────────────────────────────────┘         │
│                                                      │
│  ◌  4. Listening for your first issue...             │
│     ◠ (animated spinner)                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Step states:**
- `pending` — circle outline (`○`), muted text
- `active` — circle outline, normal text, expanded content
- `complete` — green checkmark (`✓`), muted text, content collapsed or minimal

**Step progression logic:**
- Steps 1 and 2 start as `active` (both visible with copy buttons)
- Step 3 starts as `active` (code snippet always visible — it's the main action)
- Step 4 starts as `active` with animated spinner (polling is always on)
- Steps 1-3 mark as `complete` independently when their copy button is clicked
- Step 4 marks as `complete` when `issueCount > 0`
- Steps don't block each other — user can copy in any order

**API Key display:**
- Masked by default: `sk-••••••••••••` (show first 3 chars + dots)
- Toggle reveal via eye icon button
- Copy button copies the full key regardless of mask state

**Copy button behavior:**
- Default state: clipboard icon
- After copy: checkmark icon with "Copied!" tooltip, reverts after 2 seconds
- Uses `navigator.clipboard.writeText()`

#### 4. `components/setup-code-snippet.tsx`

**Props:** `{ apiUrl: string; apiKey: string }`

**Design:**
- Uses shadcn/ui `Tabs` component with 3 tabs: curl, JavaScript, Python
- Each tab shows a pre-formatted code block with the real API URL and key injected
- Copy button in the top-right corner of the code block
- Code uses monospace font (`font-mono`) with a darker background (`bg-muted`)

**Code snippets:**

**curl:**
```bash
curl -X POST {API_URL}/api/issues \
  -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My first issue",
    "type": "task",
    "status": "todo"
  }'
```

**JavaScript:**
```javascript
const response = await fetch("{API_URL}/api/issues", {
  method: "POST",
  headers: {
    "Authorization": "Bearer {API_KEY}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "My first issue",
    type: "task",
    status: "todo",
  }),
});

const data = await response.json();
console.log(data);
```

**Python:**
```python
import requests

response = requests.post(
    "{API_URL}/api/issues",
    headers={
        "Authorization": "Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    json={
        "title": "My first issue",
        "type": "task",
        "status": "todo",
    },
)

print(response.json())
```

**Styling:**
- Tab triggers: `text-sm` with underline active indicator
- Code block container: `relative rounded-md bg-muted p-4 font-mono text-sm`
- Copy button: `absolute right-2 top-2` ghost button with clipboard/check icon
- No syntax highlighting library — plain monospace text is sufficient for 3 small snippets

#### 5. Celebration (in `setup-checklist.tsx` or `issues/index.lazy.tsx`)

**Trigger conditions:**
1. `issueCount` transitions from `0` to `> 0`
2. `document.visibilityState === 'visible'`

**If tab is NOT visible when issue arrives:**
- Store a flag: `pendingCelebration = true`
- Add `visibilitychange` event listener
- When tab becomes visible and `pendingCelebration === true`: fire celebration
- Clean up listener after firing

**Celebration sequence:**
1. Fire `confetti()` burst from `canvas-confetti` (default settings, 2-3 seconds)
2. Show success UI replacing the checklist:

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│  🎉 (confetti particles above)                       │
│                                                      │
│         ✓ Loop is connected!                         │
│                                                      │
│  Your first issue just arrived.                      │
│  The loop is ready to run.                           │
│                                                      │
│            [ View Issue → ]                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

3. After 3-5 seconds OR on "View Issue" click: transition to normal issues table
4. Set `completedAt` in localStorage so checklist never shows again

**"View Issue" button:** Links to `/issues/{firstIssueId}` using TanStack Router `Link`

### Polling Implementation

Modify `issueListOptions` in `lib/queries/issues.ts` to accept an optional `polling` parameter:

```typescript
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

In `issues/index.lazy.tsx`, pass `{ polling: true }` when onboarding is active:

```typescript
const { data, isFetching, error } = useQuery(
  issueListOptions(filters, {
    polling: onboarding.isOnboarding,
  })
)
```

### Improved Empty States

These changes apply to the empty states shown when data is empty but onboarding is already complete (user has previously connected and the data was deleted, or they're viewing a page that's naturally empty).

**Goals page** (`goals/index.lazy.tsx`):
```
Before: "No goals defined yet"
After:  "No goals defined yet"
        "Goals track measurable outcomes for your projects. Create a project with a goal to see progress here."
```

**Activity page** (`activity/index.lazy.tsx`):
```
Before: "No activity yet" / "The loop is waiting for signals"
After:  "No activity yet"
        "Activity shows the flow of signals through the loop. Once your agent starts creating issues, you'll see the timeline here."
```

**Prompts page** (`prompts/index.lazy.tsx`):
```
Before: "No prompt templates yet" / "Templates are created when the dispatch engine first runs"
After:  "No prompt templates yet"
        "Prompt templates tell your AI agent what to do. They're created when the dispatch engine runs for the first time."
```

**Issues page (post-onboarding empty state):**
```
Before: "No issues found" / "Try adjusting your filters to see more results."
After:  "No issues found"
        "Issues appear here as signals flow through the loop. Try adjusting your filters or send a new signal."
```

The visual pattern remains the same: icon + heading + subtext in the bordered card container.

### State Flow Diagram

```
localStorage: loop:onboarding
──────────────────────────────

Initial state (key missing):
  { welcomed: false, completedAt: null }
  → Shows welcome modal

After "Get Started" click:
  { welcomed: true, completedAt: null }
  → Shows setup checklist with polling

After first issue arrives + celebration:
  { welcomed: true, completedAt: "2026-02-22T..." }
  → Shows normal dashboard forever

User clears localStorage:
  → Back to welcome modal (intentional reset path)
```

## User Experience

### Happy Path

1. User opens `app.looped.me` for the first time
2. Welcome modal appears: "Welcome to Loop — Loop collects signals, organizes work into issues, and tells your AI agent what to do next. Let's get you connected."
3. User clicks "Get Started"
4. Issues page shows the setup checklist with 4 steps
5. User copies the API endpoint URL (step 1 checks off)
6. User copies the API key (step 2 checks off)
7. User selects their preferred language tab (curl/JS/Python)
8. User copies the code snippet and runs it in their terminal
9. The "Listening..." step detects the new issue within 3 seconds
10. Confetti fires, success message appears
11. User clicks "View Issue" or waits — normal issues table renders

### Edge Cases

| Scenario | Behavior |
|---|---|
| User refreshes during setup | Checklist reappears (step completion resets, but that's fine — steps are instant to re-complete) |
| User navigates to Goals/Activity during setup | Other pages show their improved empty states. Returning to Issues shows the checklist. |
| First issue arrives while tab is backgrounded | Celebration queues and fires when tab becomes visible |
| User sends multiple issues before seeing celebration | Celebration fires once for the transition from 0 to >0 |
| API key is invalid | The curl command will fail on the user's end. The checklist keeps polling. No special error handling in the dashboard — the issue list query will keep returning empty. |
| User has already sent issues (e.g., via API before opening dashboard) | Welcome modal shows, user clicks "Get Started", checklist immediately detects existing issues, celebration fires |
| User clears browser localStorage | Onboarding resets to welcome modal. If issues exist, celebration fires immediately after "Get Started" |

## Testing Strategy

### Unit Tests

**`__tests__/hooks/use-onboarding.test.ts`**
- Returns `{ welcomed: false, completedAt: null }` when localStorage is empty
- Returns stored state when localStorage has data
- `markWelcomed()` sets `welcomed: true`
- `markComplete()` sets `completedAt` to ISO string
- `isOnboarding` is true when welcomed and no completedAt and no issues
- `isOnboarding` is false when completedAt is set
- Handles malformed localStorage JSON gracefully (falls back to defaults)

**Purpose:** Validates the core state machine that drives all FTUE behavior.

**`__tests__/components/setup-code-snippet.test.tsx`**
- Renders all three tabs (curl, JavaScript, Python)
- Injects API URL and API key into snippet content
- Copy button calls `navigator.clipboard.writeText` with correct content
- Tab switching shows the correct snippet

**Purpose:** The code snippets with pre-injected keys are the highest-impact activation element. Must verify real values are injected, not placeholders.

**`__tests__/components/setup-checklist.test.tsx`**
- Renders all 4 steps
- Steps 1-3 mark as complete when copy buttons are clicked
- Step 4 shows animated spinner
- Calls `onComplete` when `issueCount` transitions from 0 to >0

**Purpose:** Validates the complete checklist interaction flow.

**`__tests__/components/welcome-modal.test.tsx`**
- Renders when `open={true}`
- Calls `onClose` when "Get Started" is clicked
- Does not render when `open={false}`

**Purpose:** Ensures the welcome modal fires once and dismisses correctly.

### Integration Tests

**Issues page FTUE flow:**
- When no issues exist and localStorage is empty: welcome modal shows
- After welcome modal dismissed: setup checklist shows instead of "No issues found"
- When issues exist: normal table renders (no checklist, no modal)
- When onboarding is complete (localStorage has completedAt): shows "No issues found" empty state if no issues, normal table if issues exist

**Purpose:** Validates the conditional rendering logic that drives which UI shows on the issues page.

### Mocking Strategy

- Mock `navigator.clipboard.writeText` for copy button tests
- Mock `localStorage` via `vi.stubGlobal` or setup/teardown
- Mock `document.visibilityState` for celebration visibility tests
- Use existing TanStack Query test patterns (mock `issuesApi.list` return values)

## Performance Considerations

| Concern | Impact | Mitigation |
|---|---|---|
| Polling at 3s interval | Negligible — single `GET /api/issues?limit=50` per 3s | Stops immediately when data arrives |
| canvas-confetti bundle size | 4.4KB gzipped | Zero deps, one-time use, can lazy-import |
| localStorage reads | Synchronous but < 1ms | Single read on mount, writes only on user action |
| Dialog + Tabs shadcn components | Small addition to bundle | Tree-shaken, only loaded on issues page |

**Lazy loading confetti:** Import `canvas-confetti` dynamically only when celebration triggers:
```typescript
const confetti = (await import('canvas-confetti')).default
confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
```

## Security Considerations

- **API key exposure:** The API key is already present in client-side env vars (`VITE_LOOP_API_KEY`). Displaying it in the setup guide is not a new exposure vector. The key is masked by default with a reveal toggle.
- **Clipboard access:** Uses `navigator.clipboard.writeText()` which requires secure context (HTTPS) in production. Works on localhost in development.
- **No new API endpoints:** All data comes from existing authenticated endpoints. No new attack surface.
- **localStorage:** Stores only onboarding state (`welcomed`, `completedAt`). No sensitive data.

## Documentation

No documentation changes required for this spec. The FTUE itself IS the documentation — it teaches users how to connect their agent inline.

Future consideration: The code snippets shown in the FTUE should match the API documentation on the marketing site. If the API changes, both need updating.

## Implementation Phases

### Phase 1: Core FTUE Components

1. Install shadcn/ui Dialog and Tabs components
2. Install `canvas-confetti`
3. Create `hooks/use-onboarding.ts`
4. Create `components/welcome-modal.tsx`
5. Create `components/setup-code-snippet.tsx`
6. Create `components/setup-checklist.tsx`

### Phase 2: Integration & Polling

7. Modify `lib/queries/issues.ts` — add conditional `refetchInterval`
8. Modify `routes/_dashboard/issues/index.lazy.tsx` — conditional FTUE vs. table
9. Move empty state logic out of `components/issue-table/data-table.tsx` to page level
10. Wire celebration with Page Visibility API gating

### Phase 3: Empty State Improvements

11. Update `routes/_dashboard/activity/index.lazy.tsx` empty state copy
12. Update `routes/_dashboard/goals/index.lazy.tsx` empty state copy
13. Update `routes/_dashboard/prompts/index.lazy.tsx` empty state copy
14. Update issues page post-onboarding empty state copy

### Phase 4: Testing

15. Write unit tests for `use-onboarding` hook
16. Write component tests for setup checklist and code snippet
17. Write integration test for issues page FTUE flow

## Open Questions

None — all clarifications were resolved during ideation.

## Related ADRs

- `decisions/0012-use-tanstack-router-for-dashboard.md` — File-based routing pattern used for all dashboard routes
- `decisions/0020-use-raw-zod-for-env-validation.md` — Env validation pattern for accessing `VITE_API_URL` and `VITE_LOOP_API_KEY`

## References

- [Ideation document](./01-ideation.md) — Full research with competitive analysis
- [Research document](../../research/20260222_ftue-onboarding.md) — Detailed competitive analysis (Stripe, Sentry, Hookdeck, Notion, Linear)
- [Loop Litepaper](../../meta/loop-litepaper.md) — Product vision and architecture
- [canvas-confetti](https://github.com/catdad/canvas-confetti) — Celebration animation library
- [TanStack Query refetchInterval](https://tanstack.com/query/v5/docs/framework/react/guides/polling) — Polling pattern documentation
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) — Tab visibility detection
