# FTUE Onboarding Research: Loop Autonomous Improvement Engine

**Date:** 2026-02-22
**Feature Slug:** ftue-onboarding
**Research Depth:** Deep Research

---

## Research Summary

Best-in-class developer tool onboarding converges on two non-negotiable principles: minimize time to first successful API call, and never block the core UI. The most admired products (Stripe, Sentry, Hookdeck, Notion) layer a non-modal persistent checklist with contextual inline empty states, pre-populate code snippets with real credentials, and use lightweight polling to detect and celebrate the first data event. For Loop — a data layer that has no AI, requires zero configuration beyond an API key, and succeeds when an agent makes its first HTTP call — this approach translates directly into a three-phase onboarding: welcome + credentials, copy-paste setup instructions, and a live waiting-for-first-event detector that resolves into a success celebration.

---

## Key Findings

### 1. The "Anti-Onboarding" Principle (Linear)

Linear's FTUE is the most-studied in developer tooling. Rather than lengthy walkthroughs, it completes in 60 seconds by pre-populating the workspace with demo data that models ideal behavior. Empty states use subtle animations and a single, clear CTA rather than walls of instructional text. The philosophy: teach through structure, not tutorials. The take-away for Loop: expose a pre-populated dashboard with sample issues/signals so the user can see what success looks like, then overlay the setup checklist.

### 2. Pre-Populated Credentials Kill the Biggest Friction Point (Stripe)

Stripe's most cited developer experience innovation is inserting the user's real API key directly into code samples. The developer copies the snippet and it runs immediately — no manual credential lookup, no token substitution. This single decision is widely credited for Stripe's exceptional developer activation rate. For Loop, every code snippet shown during onboarding must have the user's `LOOP_API_KEY` pre-injected.

### 3. Persistent Non-Modal Checklists Outperform Wizards for Developer Tools

Research consistently shows that full-screen wizards are dismissed "almost instinctively" by developers. The winning pattern is a persistent, collapsible checklist (non-modal, never blocks the UI) with up to 7 accordions. Notion uses this pattern; Loom and Intercom have documented 15-30% activation lift from it. The checklist can be hidden and restored. Progress is tracked in localStorage. For a developer who wants to read docs in one tab and return to the dashboard in another, this is superior to a modal flow.

### 4. "Waiting for First Event" is a Solved UX Pattern

Products like Hookdeck, Sentry, and Segment all implement a live detection state:

- **Display:** spinner or pulsing indicator + "Listening for events..." copy
- **Detection mechanism:** polling at 3-5 second intervals using `refetchInterval` in TanStack Query (already in Loop's stack) — no SSE or WebSocket infrastructure needed at this stage
- **Trigger:** the API endpoint `/api/issues` returns a non-empty list = first event detected
- **Transition:** confetti + success screen + "You're live" message

Sentry's wizard explicitly adds an intentional error to the project and then waits for it to appear in the dashboard. This exact pattern maps to Loop: instruct the user to run a `curl` POST to `/api/issues`, then poll until it appears.

### 5. Success Celebration is Expected and Increases Retention

Confetti and animation upon completing setup creates a positive emotional anchor associated with the product. `canvas-confetti` (4.4KB gzipped, zero dependencies) is the standard choice in the React ecosystem. Magic UI has a pre-built Confetti component that wraps it. Linear uses a "first issue created" celebration. The celebration should be brief (2-3 seconds), then auto-resolve to the populated dashboard.

### 6. TanStack Query's `refetchInterval` is the Right Technical Choice for Polling

Loop already uses TanStack Query for data fetching. The `refetchInterval` option accepts a function that receives the latest data, enabling conditional polling: poll every 3 seconds until data exists, then stop. This requires zero new infrastructure — no SSE endpoint, no WebSocket, no additional server code. A simple GET to `/api/issues?limit=1` reveals whether any data has arrived.

```typescript
useQuery({
  queryKey: queryKeys.issues.list({ limit: 1 }),
  queryFn: () => apiClient.issues.list({ limit: 1 }),
  refetchInterval: (data) => {
    // Stop polling once we have at least one issue
    if (data?.issues?.length > 0) return false;
    return 3000; // Poll every 3 seconds while empty
  },
});
```

---

## Detailed Analysis

### Analyzed Products

#### Linear — Anti-Onboarding + Pre-Populated Demo Data

- **FTUE duration:** ~60 seconds
- **Approach:** No role selection, no tutorial, no wizard. Pre-populated workspace with correctly structured sample projects and issues.
- **Empty states:** Each empty state has one CTA and a subtle animation (pulsing icon, rotating elements). Never more than one action.
- **Philosophy:** "Build products so aligned with user needs that teaching becomes unnecessary." — Candu teardown
- **Lesson for Loop:** Show a pre-populated view of what a healthy Loop looks like (sample issues, signals, activity). Let the user delete sample data after setup is complete.

#### Stripe — Pre-Injected API Keys in Code Samples

- **Key innovation:** Code samples in documentation and onboarding contain the developer's actual API key, not a placeholder.
- **Effect:** Developer copies snippet, pastes into terminal, it works. Zero steps between "I got my key" and "my first API call succeeded."
- **Test mode:** Full sandbox before production. Mistakes are safe.
- **Lesson for Loop:** Pre-inject `LOOP_API_KEY` into every `curl` and `fetch` example shown during onboarding. The user should be able to copy-paste the curl command exactly and have it work.

#### Sentry — CLI Wizard + Verification Step

- **Flow:** CLI wizard (`npx @sentry/wizard`) automates SDK installation → instructs user to trigger a test error → polls dashboard for first event → confirms "Your installation is working"
- **Empty state:** "Listening for events..." with a spinner while waiting
- **Key pattern:** The wizard deliberately causes an error in the user's project to prove the integration works. The deliberate test event is the key teaching moment.
- **Lesson for Loop:** The onboarding should instruct users to run a specific `curl` command (a known test issue creation) rather than waiting passively for their agent to send something. The deliberate, guided first event beats "set up your agent and wait."

#### Hookdeck — Immediate Feedback via Test Webhook

- **Flow:** Create a source → send a POST to source URL → immediately see the event in the Requests section
- **What's great:** No "waiting for first event" state — they give the user a test URL and show results within seconds of the setup step
- **Progressive complexity:** Mock API destination for testing, real destination for production
- **Lesson for Loop:** Give users a test command immediately after showing the API URL. Don't make them configure an agent first. The `curl` test comes before the "connect your agent" instruction.

#### Notion — Functional Checklist as the Getting Started Page

- **FTUE:** A fully functional checklist (not a modal, not a wizard) embedded in the workspace as a document
- **Contextual tooltips:** High-contrast tooltips on hover, not interrupting flow
- **Personalization:** Templates filtered by role entered during signup
- **Lesson for Loop:** The onboarding widget should be a collapsible sidebar card (or panel), not a full-page modal. Developers need to be able to reference docs in another tab without losing their place.

#### PostHog — First Event as Activation Metric

- Built dedicated infrastructure (`first-time-event-tracker` library) for knowing when a user's first event arrives
- Onboarding explicitly waits for the first captured event before unlocking full functionality
- Planned to enable first-event tracking plugin by default during onboarding
- **Lesson for Loop:** First issue received from the user's agent is the activation event. Everything in the FTUE drives toward this specific moment.

---

### Approach Comparison

#### Approach 1: Full-Page Wizard (Dedicated setup flow, blocks dashboard)

**Description:** A multi-step wizard occupies the full viewport. The dashboard is inaccessible until setup completes. Steps: Welcome → API Key → Copy Code → Verify → Done.

**Pros:**

- Highest completion rates when it works — no distractions
- Clear linear progress
- Simple to implement

**Cons:**

- Developers resist blocked UIs intensely — abandonment rate is high if any step is confusing
- Can't reference the product while setting it up
- If the user's agent isn't ready yet, they're stuck — no way to "come back later"
- Research shows interactive walkthroughs are "dismissed almost instinctively" by developers (Smart Interface Design Patterns)

**Verdict:** Appropriate for consumer apps. Wrong for developer tools. Avoid.

---

#### Approach 2: Inline Empty States (Each page has its own contextual empty state)

**Description:** The dashboard works immediately. Each page (Issues, Signals, Activity) has a contextual empty state with relevant setup guidance. No wizard. No checklist. Users discover onboarding content by navigating around.

**Pros:**

- Zero friction — dashboard is immediately usable
- Context-appropriate guidance (Issues empty state explains how to create issues)
- Best approach for experienced developers who prefer self-directed exploration

**Cons:**

- No guided sequence — users may miss critical steps
- No sense of progress toward "you're set up"
- Doesn't work for Loop's specific problem: users need to configure an external agent, not just learn the UI
- No mechanism for the "first event received" celebration

**Verdict:** Necessary but not sufficient. Use as part of a hybrid, not as the sole strategy. Every page still needs a good empty state.

---

#### Approach 3: Persistent Sidebar Checklist (Non-modal, collapsible, alongside real UI)

**Description:** A checklist widget (card or panel) appears in the dashboard for new users. Steps: Welcome ✓ → Copy API key ✓ → Copy curl command ✓ → Waiting for first issue... → Complete ✓. The checklist is collapsible and persists across page navigation. The dashboard is fully functional behind it.

**Pros:**

- Never blocks the product — developer can switch tabs and return
- Clear progress — psychological "completion pull" effect
- Can be hidden and restored (localStorage)
- Progress persists across page refreshes
- Pairs well with inline empty states

**Cons:**

- Requires more implementation work than a simple modal
- Checklist widget competes for screen real estate
- Must be carefully designed so it's dismissible without losing progress

**Verdict:** Best standalone pattern for developer tools. Recommended by multiple UX research sources for API-first products. The non-modal requirement is critical.

---

#### Approach 4: Modal Overlay (Welcome modal with steps, dismissible)

**Description:** A modal dialog with steps appears on first login. Users progress through steps (or dismiss). Steps: Welcome → Show API key → Show curl example → Done button.

**Pros:**

- Simple to implement
- Immediately visible — can't miss it
- Good for a very short, 2-3 step flow

**Cons:**

- Developers dismiss modals reflexively before reading them
- Dismissal = lost onboarding state
- Can't return to modal if dismissed accidentally without a trigger mechanism
- No "waiting for event" mechanism — modals can't persist in a waiting state

**Verdict:** Only appropriate as the first step of a hybrid (welcome message), not as the primary onboarding container. A brief welcome modal (one screen, 2-3 sentences, single CTA to "start setup") is acceptable as an entry point.

---

#### Approach 5: Hybrid (Welcome modal → Persistent checklist → Success celebration)

**Description:** Three phases:

1. **Welcome modal** (one screen): Brief intro, what Loop does, single CTA "Get started" → transitions to checklist
2. **Persistent sidebar checklist**: Collapsible, tracks progress step by step through API key copy, curl test, and "waiting for first issue"
3. **Success screen / confetti**: Fires when first issue is detected by polling, auto-resolves to the normal dashboard with a populated state

**Pros:**

- Combines the attention-grabbing quality of a modal (only for the first ~3 seconds) with the persistent, non-blocking checklist
- The welcome modal sets framing without trapping the user
- The checklist gives clear progress and can be dismissed and restored
- The polling + celebration creates a satisfying closure moment
- The whole thing completes in under 5 minutes for a developer who's ready

**Cons:**

- More implementation complexity
- Three pieces to build and coordinate
- Welcome modal must be very short (1 screen) or users will dismiss it

**Verdict:** This is the recommended approach. It matches what the best developer tools (Stripe, Sentry, Hookdeck, Notion) do and maps cleanly to Loop's specific needs.

---

### Technical Pattern Recommendations

#### Real-Time Detection: Polling via TanStack Query

For "waiting for first event," polling beats SSE and WebSockets for this specific use case:

| Factor                    | Polling                                     | SSE                           | WebSocket                 |
| ------------------------- | ------------------------------------------- | ----------------------------- | ------------------------- |
| Infrastructure cost       | Zero — uses existing `/api/issues` endpoint | Requires SSE endpoint in Hono | Requires WebSocket server |
| Implementation complexity | Low — 5 lines of TanStack Query config      | Medium                        | High                      |
| Appropriate for           | Low-frequency events (first API call)       | Continuous streams            | Bidirectional real-time   |
| Already in Loop's stack   | Yes                                         | No                            | No                        |

**Polling interval:** 3 seconds during setup. The user is watching the screen, so 3-second feedback is acceptable. After first event arrives, `refetchInterval` returns `false` to stop.

#### Step Tracking: localStorage

```typescript
// Onboarding state management
const ONBOARDING_KEY = 'loop_onboarding_v1';
type OnboardingState = {
  dismissed: boolean;
  completedAt: string | null;
  steps: {
    welcomed: boolean;
    apiKeyCopied: boolean;
    curlCopied: boolean;
    firstEventReceived: boolean;
  };
};
```

No server state needed. The "first event received" step is verified by polling the API, not by a user click. The checklist auto-advances when the API returns data.

#### Code Snippet Display: Shiki or Prism

For syntax-highlighted, copy-able code snippets:

- `shiki` — server-side, best quality highlighting, can highlight Hono/TypeScript syntax
- `react-syntax-highlighter` — simpler, client-side
- Recommendation: A simple pre-formatted `<pre>` block with a copy button is sufficient for curl examples. Full syntax highlighting is a nice-to-have, not a requirement.

#### Success Celebration: canvas-confetti

```bash
npm install canvas-confetti
npm install -D @types/canvas-confetti
```

Trigger once when polling detects the first issue. Duration: 2-3 seconds. Then redirect or animate to the normal dashboard. `magicui` has a pre-built `<Confetti>` component if MagicUI is added to the stack.

#### Stepper Component: Stepperize (shadcn-compatible)

The project uses shadcn/ui. Stepperize is a shadcn-compatible stepper library with a simple `defineStepper` + `useStepper` API. Alternative: build a simple custom stepper using shadcn `Card` components with state-driven styling (not worth adding a dependency for a one-time flow).

---

## Recommended Approach: Hybrid (Welcome Modal + Persistent Checklist + Polling + Celebration)

### The Four Phases

**Phase 1: Welcome Modal (first login only)**

- Single modal dialog, ~300px wide
- Headline: "Welcome to Loop"
- 2-sentence description of what Loop does and what they're about to do
- Single CTA: "Get started →"
- Dismissing the modal or clicking "Get started" both transition to Phase 2
- Show once, never again (localStorage flag)

**Phase 2: Persistent Setup Checklist**

- Collapsible card fixed to the bottom-right of the dashboard (or top of sidebar)
- Header: "Connect your agent" with progress indicator (e.g., "2 of 4 complete")
- 4 steps:
  1. **Copy your API URL** — shows `https://your-loop-instance.com` with copy button
  2. **Copy your API key** — shows `LOOP_API_KEY=•••••••••` with reveal + copy button
  3. **Make your first API call** — shows pre-populated `curl` command with the real API key injected, copy button
  4. **Waiting for first issue...** — spinner, auto-advances when polling detects data

Steps 1 and 2 auto-complete on copy click. Step 3 auto-completes on copy click (optimistic) but real verification happens via polling in Step 4. Steps are checked off with a green checkmark and animation.

The checklist persists across page navigation. User can minimize it. Clicking the minimized pill restores it.

**Phase 3: Waiting for First Event**

- Step 4 of the checklist enters an animated "listening" state
- Pulsing indicator + copy: "Listening for your first issue..."
- Sub-copy: "Run the curl command above. It should appear here in seconds."
- TanStack Query polls `/api/issues?limit=1` every 3 seconds
- If 10 minutes pass with no event, show a help link: "Need help? See the docs →"

**Phase 4: Success Celebration**

- When polling returns data, trigger:
  1. Confetti (canvas-confetti, 2-3 second burst)
  2. Checklist step 4 checks off with a green animation
  3. A toast/banner: "Your first issue arrived! Loop is live."
  4. After 3 seconds, checklist auto-collapses to a "Setup complete" state
  5. The dashboard is now fully populated and functional

### The curl Command to Show

This is the exact command users need to see with their credentials pre-injected:

```bash
curl -X POST https://app.looped.me/api/issues \
  -H "Authorization: Bearer YOUR_LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My first Loop issue",
    "type": "task",
    "status": "triage"
  }'
```

This should render with the actual API key substituted. The user can run it from any terminal to verify their connection before configuring their agent.

---

## Content Recommendations

### Welcome Modal Copy

```
Headline: "Loop is ready."
Body: "Loop collects signals from your stack and turns them into prioritized work for your AI agent. Connect your agent in the next few steps."
CTA: "Connect my agent →"
```

### Step 1: API URL

```
Heading: "Your API endpoint"
Sub: "Your agent will POST issues and signals here."
```

### Step 2: API Key

```
Heading: "Your API key"
Sub: "Pass this as a Bearer token. Keep it secret."
Warning: "Never commit this to version control."
```

### Step 3: First API Call

```
Heading: "Make your first call"
Sub: "Run this from any terminal to verify your connection:"
[curl command block]
Sub: "Or skip ahead and configure your agent directly."
```

### Step 4: Waiting

```
Heading: "Listening for your first issue..."
Sub: "Run the command above or have your agent POST to /api/issues."
```

### Success

```
Toast: "Your first issue arrived. Loop is connected."
Dashboard headline: "Loop is live."
```

---

## Research Gaps & Limitations

- Direct screencasts of Stripe's new-user onboarding UI were not accessible (requires an account). The curl-with-API-key pattern is well-documented in third-party reviews.
- Vercel's specific success animation/celebration on first deployment was not found in public sources.
- PostHog's current (2026) onboarding flow was not directly observed — only their GitHub issues and changelog were available.
- Linear's exact "first issue created" celebration is documented in teardowns but not described with enough technical specificity to copy directly.

---

## Contradictions & Disputes

- **Wizard vs. Checklist:** Some conversion optimization sources argue full-page wizards outperform checklists for first-time completion rates. However, this finding applies to consumer SaaS (e.g., e-commerce onboarding), not developer tools. Developer tool research consistently favors non-blocking patterns.
- **Demo data vs. empty state:** Linear pre-populates with demo data; other tools (Stripe, Sentry) start from a truly empty state with guided setup. For Loop, the "no data" state is inherently meaningful (the loop isn't closed yet), so starting empty with a visible setup guide is appropriate — demo data would confuse whether the issues are real.
- **SSE vs. polling:** SSE is strictly superior for ongoing real-time updates. For the specific "detect first event" use case in onboarding (a one-time event that resolves the polling), polling is simpler, already supported by TanStack Query, and requires no server-side changes to the Hono API.

---

## Search Methodology

- **Number of searches performed:** 17
- **Most productive search terms:** "Linear onboarding teardown anti-onboarding", "Stripe developer onboarding API keys pre-populated", "Sentry setup wizard verify installation", "TanStack Query refetchInterval waiting for first data", "persistent sidebar checklist SaaS onboarding pattern"
- **Primary information sources:** candu.ai (Linear teardown), betta.io (Stripe DX review), develop.sentry.dev (Sentry wizard docs), hookdeck.com (quickstart docs), smart-interface-design-patterns.com (onboarding UX patterns), appcues.com (SaaS onboarding guide), tanstack.com (query docs)

---

## Sources

- [Linear Onboarding Teardown: How Anti-Onboarding Drives Adoption](https://www.candu.ai/blog/linear-onboarding-teardown)
- [The Anti-Onboarding Strategy: How Linear Converts Philosophy into Product Adoption](https://www.candu.ai/blog/the-anti-onboarding-strategy-how-linear-converts-philosophy-into-product-adoption)
- [Developer Experience Review: Stripe](https://betta.io/blog/2016/10/16/developer-experience-review-stripe/)
- [Setup Wizards - Sentry Developer Documentation](https://develop.sentry.dev/sdk/expected-features/setup-wizards/)
- [Hookdeck Quickstart: Receive Webhooks](https://hookdeck.com/docs/use-cases/receive-webhooks/quickstart)
- [Onboarding UX: Ultimate Guide to Designing for User Experience](https://www.appcues.com/blog/user-onboarding-ui-ux-patterns)
- [Onboarding UX — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/onboarding-ux/)
- [Notion's Clever Onboarding and Inspirational Templates](https://goodux.appcues.com/blog/notions-lightweight-onboarding)
- [TanStack Query: Auto Refetching Example](https://tanstack.com/query/v4/docs/framework/react/examples/auto-refetching)
- [Polling until data is ready — TanStack Query Discussion](https://github.com/TanStack/query/discussions/3755)
- [WebSockets vs Server-Sent Events: Key differences and which to use](https://ably.com/blog/websockets-vs-sse)
- [Polling vs. Long Polling vs. SSE vs. WebSockets vs. Webhooks](https://blog.algomaster.io/p/polling-vs-long-polling-vs-sse-vs-websockets-webhooks)
- [GitHub: react-canvas-confetti](https://github.com/ulitcos/react-canvas-confetti)
- [Confetti - Magic UI](https://magicui.design/docs/components/confetti)
- [Stepperize - shadcn/ui Template](https://www.shadcn.io/template/damianricobelli-stepperize)
- [Empty State UX Examples and Design Rules](https://www.eleken.co/blog-posts/empty-state-ux)
- [The Role of Empty States In User Onboarding](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/)
- [API Onboarding: Strategies for smooth integration success](https://tyk.io/blog/api-onboarding-strategies-for-smooth-integration-success/)
- [Using a Progress Bar (UI) in SaaS: 5 Types + Examples](https://userpilot.com/blog/progress-bar-ui-ux-saas/)
- [PostHog: first-time-event-tracker](https://github.com/PostHog/first-time-event-tracker)
