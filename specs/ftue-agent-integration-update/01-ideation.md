---
slug: ftue-agent-integration-update
number: 18
created: 2026-02-23
status: specification
---

# FTUE Update for Agent Integration

**Slug:** ftue-agent-integration-update
**Author:** Claude Code
**Date:** 2026-02-23
**Branch:** preflight/ftue-agent-integration-update
**Related:** [Agent Integration Strategy](../agent-integration-strategy.md) (Feature 9) | [FTUE Onboarding Spec](../ftue-onboarding/02-specification.md) (Spec #9)

---

## 1) Intent & Assumptions

- **Task brief:** Update the FTUE onboarding flow to surface new agent integration paths (connect CLI, MCP server, Cursor deeplink) instead of only showing curl/JS/Python snippets. The FTUE should auto-detect which agent platform the user came from and present the most relevant setup path prominently, with alternatives collapsed.
- **Assumptions:**
  - Features 2 (MCP Server — `@dork-labs/loop-mcp`), 3 (Agent Discovery Layer), and 5 (Connect CLI — `@dork-labs/loop-connect`) are built and published
  - The existing FTUE (spec #9) is fully implemented — 14 tasks complete, welcome modal + 4-step checklist + confetti celebration all working
  - The dashboard SPA is dark-mode only, React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui
  - `?from=` URL params are the primary detection mechanism (set by connect CLI, deeplinks, marketing site)
  - No new API endpoints are needed — the existing polling logic in `issueListOptions` handles "waiting for first issue"
- **Out of scope:**
  - Building the connect CLI, MCP server, or agent skill themselves (Features 2-5)
  - Documentation updates (Feature 7)
  - Marketing site updates (Feature 8)
  - Full FTUE redesign — this is an incremental refinement
  - Multi-key management, OAuth/session auth
  - `.mcpb` bundle generation in the web app
  - User-agent sniffing for Cursor (unreliable — Cursor's webview UA is indistinguishable)

---

## 2) Pre-reading Log

- `specs/ftue-onboarding/02-specification.md`: Full FTUE spec — 4-step checklist with welcome modal, setup code snippet tabs (curl/JS/Python), polling, confetti celebration
- `specs/ftue-onboarding/04-implementation.md`: Implementation complete — all 14 tasks done, tests passing
- `specs/connect-cli/02-specification.md`: Connect CLI (`npx @dork-labs/loop-connect`) — interactive prompts via @clack/prompts, auto-detects agent environments, writes config files
- `specs/mcp-server/02-specification.md`: MCP Server (`@dork-labs/loop-mcp`) — 9 agent-intent tools, stdio + HTTP transports, `loop_get_next_task` as signature tool
- `specs/agent-discovery-layer/02-specification.md`: 5 discovery artifacts (llms.txt, SKILL.md, AGENTS.md, Cursor rules, OpenHands microagent)
- `apps/app/src/hooks/use-onboarding.ts`: FTUE state management — localStorage + useSyncExternalStore, `{ welcomed, completedAt }` state shape
- `apps/app/src/components/setup-checklist.tsx`: 4-step setup guide with confetti celebration, steps: copy API endpoint, copy API key, send first issue (code snippet tabs), listening spinner
- `apps/app/src/components/setup-code-snippet.tsx`: Tabbed code snippets — curl/JS/Python tabs with credential injection from env vars
- `apps/app/src/components/welcome-modal.tsx`: One-time welcome dialog — "tells your AI agent what to do next"
- `apps/app/src/routes/_dashboard/issues/index.lazy.tsx`: Issues page with FTUE integration — conditional rendering based on `useOnboarding` state
- `apps/app/src/lib/queries/issues.ts`: Query options with conditional polling — `refetchInterval: 3000` when `polling: true` and no data
- `packages/loop-connect/src/lib/detectors.ts`: Environment detection — `detectEnvironment()` checks for CLAUDE.md, .cursor/, .openhands/, .mcp.json
- `research/20260223_ftue-agent-integration-update.md`: Research report with deeplink specs, detection patterns, UX recommendations

---

## 3) Codebase Map

**Primary Components/Modules:**

| File | Role |
|------|------|
| `apps/app/src/hooks/use-onboarding.ts` | FTUE state management (localStorage + useSyncExternalStore) |
| `apps/app/src/components/welcome-modal.tsx` | One-time welcome dialog |
| `apps/app/src/components/setup-checklist.tsx` | 4-step setup guide with confetti celebration |
| `apps/app/src/components/setup-code-snippet.tsx` | Tabbed code snippets (curl/JS/Python) |
| `apps/app/src/routes/_dashboard/issues/index.lazy.tsx` | Issues page — FTUE integration point |
| `apps/app/src/lib/queries/issues.ts` | Query options with conditional polling |

**Shared Dependencies:**

- `apps/app/src/components/ui/dialog.tsx` — Modal for welcome screen
- `apps/app/src/components/ui/tabs.tsx` — Language selection in code snippet
- `apps/app/src/components/ui/button.tsx` — Copy buttons, CTA buttons
- `apps/app/src/components/ui/collapsible.tsx` — Will use for "Other ways to connect"
- `canvas-confetti` — Confetti animation on celebration
- `@tanstack/react-query` — Query management with polling
- `lucide-react` — Icons throughout FTUE
- `apps/app/src/env.ts` — Environment variables (`VITE_API_URL`, `VITE_LOOP_API_KEY`)

**Data Flow:**

```
User opens /issues page
  → Route reads localStorage for onboarding state
  → useAgentDetection() reads ?from= param, persists to localStorage
  → useOnboarding(issueCount) derives isOnboarding & celebration triggers
  → Conditional rendering:
    ├─ !welcomed → WelcomeModal
    ├─ isOnboarding → AgentSetupStep (auto-detected primary path + collapsible alternatives)
    │   └─ Polling active (refetchInterval: 3000)
    ├─ issueCount === 0 → Empty state
    └─ issueCount > 0 → IssueDataTable
  → First issue arrives → confetti → success state (with agent skill guidance)
```

**Feature Flags/Config:**

- No feature flags — FTUE controlled via `localStorage` key `loop:onboarding`
- State shape: `{ welcomed: boolean, completedAt: string | null }`
- Will extend to: `{ welcomed, completedAt, agentSource, agentSetupDismissed }`

**Potential Blast Radius:**

- Direct changes: 4-5 files (setup-checklist, welcome-modal, issues route, use-onboarding hook, + new agent-setup components)
- Indirect: 0 files (existing empty states and query logic unchanged)
- Tests: 3-4 test files need updates (hook tests, component tests)
- External: `packages/loop-connect/src/index.ts` — append `?from=loop-connect` to dashboard URL

---

## 4) Root Cause Analysis

N/A — this is a feature enhancement, not a bug fix.

---

## 5) Research

Full research report: `research/20260223_ftue-agent-integration-update.md`

### Potential Solutions

**1. Tabbed Interface (Current Pattern Extended)**

Replace curl/JS/Python tabs with loop-connect/Cursor/Claude Code/Manual tabs. Keep the existing 4-step checklist.

- Pros: Familiar pattern (existing tab UI), easy to implement, no detection logic
- Cons: Requires user to read and choose; equal visual weight across all options implies no recommendation; "Manual" tab (curl/JS/Python) gets equal billing despite being least-used
- Complexity: Low
- Maintenance: Low

**2. Auto-Detect + Collapsible Alternatives (RECOMMENDED)**

Replace the setup checklist's "send your first issue" step with a single prominent CTA based on detected agent source, with "Other ways to connect" collapsible section below.

- Pros: Zero friction for the majority case; alternatives available without being distracting; mirrors Twilio's high-performing onboarding redesign (62% improvement in first-message activation); detection logic is straightforward (URL params)
- Cons: Requires new detection hook and component architecture; if detection is wrong, user must expand alternatives (low recovery cost)
- Complexity: Medium
- Maintenance: Low (detection is URL-param-based, not UA-based)

**3. Card Grid with Recommended Badge**

Show 4 cards (loop-connect, Cursor, Claude Code, Manual) with a "Recommended" badge on the primary option.

- Pros: Clear visual hierarchy; scannable; consistent with Vercel's framework selector
- Cons: 4 cards is a lot for inline context; requires user choice before proceeding; doesn't leverage detection
- Complexity: Medium
- Maintenance: Low

**4. Wizard Flow ("Which agent are you using?")**

Add a question screen before instructions. User picks their platform, then sees tailored setup.

- Pros: 100% accurate path selection; no detection complexity
- Cons: Extra step; AI-native developers have low tolerance for wizard flows; asking users to identify their tool creates friction
- Complexity: Medium-High
- Maintenance: Medium (new platforms require new wizard options)

### Recommendation

**Solution 2: Auto-Detect + Collapsible Alternatives.** This eliminates decision friction for the majority of users (who arrive via `loop-connect` or Cursor deeplink) while keeping all paths accessible. The detection logic is simple, reliable (URL params, not UA sniffing), and matches patterns validated by Twilio and Vercel.

---

## 6) Clarifications & Decisions

**Decisions made:**

1. **FTUE layout:** Auto-detect + collapse approach (single prominent CTA based on detected source, "Other ways to connect" collapsible). Chosen over extended tabs for higher impact and better UX.

2. **Agent Setup step:** Fold agent configuration guidance (install Agent Skill, configure CLAUDE.md) into the success state rather than adding a separate blocking step. After the first issue arrives, the success screen shows "Next: configure your agent skill" with a link to docs. This avoids adding friction before the user sees "done".

**Open questions:** None.

---

## Technical Design Notes

### Detection Implementation

```typescript
type AgentSource = 'loop-connect' | 'cursor' | 'claude-code' | 'openhands' | null;

// Priority: URL param > localStorage > document.referrer > null
function detectAgentSource(): AgentSource {
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  if (['loop-connect', 'cursor', 'claude-code', 'openhands'].includes(from ?? ''))
    return from as AgentSource;

  const stored = localStorage.getItem('loop:agent-source');
  if (stored) return stored as AgentSource;

  if (document.referrer.includes('cursor.com')) return 'cursor';

  return null;
}
```

### Primary CTA by Detected Source

| Source | Primary CTA | Description |
|--------|------------|-------------|
| `loop-connect` | "Your agent is configured — create your first issue" | User already ran connect CLI |
| `cursor` | "Add to Cursor" deeplink button | One-click MCP install via `cursor://` protocol |
| `claude-code` | `claude mcp add` command snippet | Copy-pasteable terminal command |
| `openhands` | `npx @dork-labs/loop-connect` command | Connect CLI is the best path for OpenHands |
| `null` (default) | `npx @dork-labs/loop-connect` command | Recommended default for unknown users |

### Cursor Deeplink Format

```
cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=BASE64_JSON
```

Where BASE64_JSON encodes:
```json
{
  "command": "npx",
  "args": ["-y", "@dork-labs/loop-mcp", "--api-url", "LOOP_API_URL", "--api-key", "LOOP_API_KEY"]
}
```

Generated client-side from `env.VITE_API_URL` and `env.VITE_LOOP_API_KEY`. Web fallback: `https://cursor.com/link/mcp/install?name=loop&config=...`

### Component Architecture

```
components/
  agent-setup/
    agent-setup-step.tsx       # Main component (orchestrates paths + collapsible)
    agent-path-card.tsx        # Reusable card for each integration path
    cursor-deeplink-button.tsx # "Add to Cursor" button with deeplink generation
  setup-checklist.tsx          # Modified — delegates to AgentSetupStep
  setup-code-snippet.tsx       # Preserved as manual fallback option
  welcome-modal.tsx            # Updated copy mentioning agent compatibility

hooks/
  use-onboarding.ts            # Extended with agentSource field
  use-agent-detection.ts       # NEW: detects + persists agent source

lib/
  deeplink-builders.ts         # NEW: buildCursorDeeplink(), buildCursorWebDeeplink()
```

### Extended Onboarding State

```typescript
interface OnboardingState {
  welcomed: boolean;
  completedAt: string | null;
  agentSource: AgentSource | null;       // NEW
  agentSetupDismissed: boolean;          // NEW
}
```

### Updated Copy

- **Welcome modal:** Keep current copy (already agent-aware: "tells your AI agent what to do next")
- **Waiting state:** "Waiting for your agent to send its first issue..." with context-aware sub-line per detected source
- **Success state:** "Your agent is connected to Loop." + "Next: Install the Loop Agent Skill for autonomous dispatch" with docs link

### External Change

- `packages/loop-connect/src/index.ts`: Append `?from=loop-connect` to the dashboard URL opened after successful connection
