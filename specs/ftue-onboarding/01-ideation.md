---
slug: ftue-onboarding
number: 9
created: 2026-02-22
status: ideation
---

# FTUE Onboarding — Guide New Users to Connect Their AI Agent

**Slug:** ftue-onboarding
**Author:** Claude Code
**Date:** 2026-02-22
**Branch:** preflight/ftue-onboarding
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** The Loop dashboard currently shows bare empty states ("No issues found", "No goals defined yet", etc.) with no guidance for new users. We need a world-class First Time User Experience (FTUE) that guides users through connecting their AI agent to Loop's API, provides copy-paste setup instructions, shows real-time feedback when the first data arrives, and celebrates success. The goal is to make setup feel effortless and delightful — like Stripe's developer onboarding.
- **Assumptions:**
  - Users arrive at the dashboard with a working API key already configured (set in env vars)
  - The primary activation event is receiving the first issue via the API
  - The app is dark-mode only, React 19 SPA with shadcn/ui components
  - No new API endpoints are needed — existing `/api/issues` can be polled
  - No authentication/signup flow is in scope (that's separate)
- **Out of scope:**
  - User authentication / account creation
  - CLI tool onboarding (separate spec #5)
  - Webhook setup (PostHog/GitHub/Sentry) — secondary flow after first connection
  - Marketing site changes
  - Backend/API changes

## 2) Pre-reading Log

- `apps/app/src/routes/_dashboard.tsx`: Dashboard layout with SidebarProvider, keyboard shortcuts, error boundary
- `apps/app/src/routes/_dashboard/index.tsx`: Redirects to `/issues` — potential intercept point for FTUE
- `apps/app/src/routes/_dashboard/issues/index.lazy.tsx`: Issues list with empty state (Inbox icon + "No issues found" + "Try adjusting your filters")
- `apps/app/src/routes/_dashboard/activity/index.lazy.tsx`: Empty state: "No activity yet. The loop is waiting for signals"
- `apps/app/src/routes/_dashboard/goals/index.lazy.tsx`: Empty state: "No goals defined yet"
- `apps/app/src/routes/_dashboard/prompts/index.lazy.tsx`: Empty state: "No prompt templates yet"
- `apps/app/src/components/issue-table/data-table.tsx`: IssueDataTable with empty state at lines 76-85
- `apps/app/src/components/app-sidebar.tsx`: Navigation sidebar with dashboard stats in footer
- `apps/app/src/lib/api-client.ts`: ky HTTP client with Bearer token auth
- `apps/app/src/lib/query-keys.ts`: TanStack Query key factory (structured keys for issues, dashboard, etc.)
- `apps/app/src/lib/queries/issues.ts`: `issueListOptions()` query factory with `staleTime: 30_000`
- `apps/app/src/lib/queries/dashboard.ts`: `dashboardStatsOptions()` for sidebar stats
- `apps/app/src/env.ts`: Zod validation for `VITE_API_URL` and `VITE_LOOP_API_KEY`
- `apps/app/src/components/ui/`: 15 shadcn/ui components installed (button, card, badge, skeleton, progress, tooltip, etc.)
- `research/20260222_ftue-onboarding.md`: Full research document with competitive analysis

## 3) Codebase Map

- **Primary components/modules:**
  - `apps/app/src/routes/_dashboard/issues/index.lazy.tsx` — Issues list page (primary landing, main empty state to replace)
  - `apps/app/src/routes/_dashboard/index.tsx` — Dashboard index (redirects to `/issues`)
  - `apps/app/src/routes/_dashboard.tsx` — Dashboard layout wrapper
  - `apps/app/src/components/issue-table/data-table.tsx` — Issue table with current empty state
  - `apps/app/src/components/app-sidebar.tsx` — Sidebar navigation
- **Shared dependencies:**
  - `apps/app/src/lib/api-client.ts` — HTTP client (ky + Bearer token)
  - `apps/app/src/lib/query-keys.ts` — Query key factory
  - `apps/app/src/lib/queries/` — Query option factories (issues, dashboard, goals, templates)
  - `apps/app/src/env.ts` — Environment variables (API URL, API key)
  - `apps/app/src/components/ui/` — shadcn/ui components
- **Data flow:** User opens app → `_dashboard.tsx` layout → redirects to `/issues` → `issueListOptions()` fires → empty array → shows empty state
- **Feature flags/config:** None. `VITE_LOOP_API_KEY` is the only relevant config.
- **Potential blast radius:**
  - Direct: 3-4 files (issues empty state, dashboard index, new FTUE components)
  - Indirect: sidebar (may show onboarding indicator), other empty states (may reference FTUE)
  - Tests: New test files needed for FTUE components

## 4) Root Cause Analysis

N/A — this is a feature, not a bug fix.

## 5) Research

### Potential Solutions

**1. Full-Page Wizard (Blocked UI)**
- Description: Dedicated `/onboarding` route that blocks access to the dashboard until complete. Multi-step form with progress indicator.
- Pros:
  - Focused attention — nothing else to click
  - Clear completion path
- Cons:
  - Developers abandon blocked UIs reflexively
  - No "come back later" path without state management
  - Feels heavy for what is ultimately a single curl command
  - Can't explore the dashboard while waiting for first event
- Complexity: Medium
- Maintenance: Medium

**2. Inline Empty States Only**
- Description: Replace each page's empty state with contextual guidance — issues page explains how to create issues, goals page explains goals, etc.
- Pros:
  - Contextual — guidance appears where it's relevant
  - No new routes or complex state
  - Each page teaches its own feature
- Cons:
  - No guided sequence — user wanders without direction
  - No mechanism for "waiting for first event" detection
  - No celebration moment
  - Duplicated setup instructions across pages
- Complexity: Low
- Maintenance: Low

**3. Sidebar Checklist (Persistent)**
- Description: Non-modal checklist card (like Linear/Notion) that persists alongside the real UI. Steps check off as completed. Collapsible.
- Pros:
  - Never blocks the UI — user can explore freely
  - Progress is always visible
  - Can persist across page navigation
  - Proven pattern (Linear, Notion, many SaaS products)
- Cons:
  - Cold start without welcome context feels jarring
  - Needs careful positioning (sidebar vs. overlay vs. bottom-right)
- Complexity: Medium
- Maintenance: Low

**4. Modal Overlay Only**
- Description: Welcome modal with steps, dismissible. Appears on first load.
- Pros:
  - Immediate attention capture
  - Simple to implement
- Cons:
  - Dismissed reflexively before reading (modal fatigue)
  - Can't persist in "waiting" state after dismissal
  - One shot — if user misses it, no recovery path
- Complexity: Low
- Maintenance: Low

**5. Hybrid: Welcome Modal → Persistent Checklist → Polling → Celebration (RECOMMENDED)**
- Description: Four-phase approach combining the best of each pattern:
  1. **Welcome modal** — one screen, 2 sentences, single CTA. Fires once. Sets framing.
  2. **Persistent checklist** — non-modal card on the issues page, 4 steps, never blocks dashboard. Shows API endpoint, API key, pre-populated curl command.
  3. **Polling** — TanStack Query `refetchInterval` on issues endpoint, auto-detects first arrival.
  4. **Celebration** — confetti burst + success toast + checklist collapses.
- Pros:
  - Matches Stripe/Sentry/Hookdeck/Notion patterns — proven at scale
  - Never blocks the UI
  - Pre-injected API key in curl snippet (the Stripe lesson — highest-impact activation optimization)
  - Auto-detects success without user action
  - Celebration creates a memorable moment
  - Graceful degradation — works even if user navigates away and comes back
- Cons:
  - Slightly more complex than single-pattern approaches
  - Needs localStorage for onboarding state tracking
- Complexity: Medium
- Maintenance: Low

### Security Considerations
- API key is already in the client env vars (`VITE_LOOP_API_KEY`); displaying it in the setup guide is not a new exposure
- Curl snippet should use the dashboard's own API URL, not hardcoded

### Performance Considerations
- Polling at 3-second interval on `/api/issues?limit=1` is negligible load
- `canvas-confetti` is 4.4KB gzipped, zero dependencies
- localStorage reads are synchronous but fast for single boolean checks

### Recommendation

**Recommended Approach:** Hybrid (Welcome Modal → Persistent Checklist → Polling → Celebration)

**Rationale:** This approach maps perfectly to Loop's activation event (first issue arriving via API). The pre-injected curl command eliminates the biggest friction point in developer onboarding (Stripe proved this). TanStack Query polling requires zero new infrastructure. The celebration moment creates an emotional anchor that converts "setup task" into "product experience."

**Caveats:**
- The welcome modal must be truly minimal (2 sentences max) to avoid modal fatigue
- Onboarding state should be stored in localStorage, not server-side — keeps it simple and avoids API changes
- The curl snippet must inject the real API key and API URL from env vars — placeholder keys kill activation rates

### Technical Implementation Details

**Polling mechanism:** Use TanStack Query's `refetchInterval` as a function:
```tsx
refetchInterval: (query) => {
  // Stop polling once we have data
  return query.state.data?.data?.length > 0 ? false : 3000
}
```

**Onboarding state:** localStorage key `loop:onboarding` with shape:
```json
{
  "welcomed": true,
  "dismissed": false,
  "completedAt": "2026-02-22T..."
}
```

**Confetti:** `canvas-confetti` package — the ecosystem standard for this moment. Single burst, 2-3 seconds, auto-cleans.

**Pre-populated curl command:**
```bash
curl -X POST ${API_URL}/api/issues \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My first issue",
    "type": "task",
    "status": "todo"
  }'
```

## 6) Clarification (Resolved)

1. **Welcome modal copy:** **Warm & explanatory.** Friendly copy that briefly explains what Loop does: "Loop collects signals, organizes work into issues, and tells your AI agent what to do next. Let's get you connected."

2. **Checklist location:** **Inline on issues page.** Replace the issues empty state with the setup checklist card. It lives where the user naturally lands. When issues arrive, the checklist naturally gives way to the real content.

3. **Other empty states:** **Yes, improve all empty states.** Update Goals, Activity, and Prompts empty states with helpful, contextual copy that explains what will appear and how.

4. **Skip/dismiss behavior:** **Auto-hide on first issue only.** No dismiss button. The checklist IS the empty state — there's nothing else to show on the issues page anyway. When the first issue arrives, the checklist disappears and the issues table appears.

5. **Multiple setup paths:** **Tabbed: curl + JavaScript + Python.** Three language tabs covering the most common AI agent languages. Pre-injected API key in all snippets.

6. **Celebration:** **Confetti burst.** canvas-confetti (4.4KB) fires a 2-3 second burst + "Loop is connected! Your first issue just arrived." + "View Issue" CTA. **Requirement:** Celebration must only fire when the browser tab is visible/focused. Use `document.visibilityState === 'visible'` (Page Visibility API) to gate the confetti. If the first issue arrives while the tab is backgrounded, queue the celebration and fire it on the next `visibilitychange` event when the tab becomes visible.
