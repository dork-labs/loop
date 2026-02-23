---
slug: ftue-agent-integration-update
number: 18
created: 2026-02-23
status: specification
---

# Specification: FTUE Update for Agent Integration

**Status:** Specification
**Authors:** Claude Code, 2026-02-23
**Related:** [Ideation](./01-ideation.md) | [Agent Integration Strategy](../agent-integration-strategy.md) (Feature 9) | [FTUE Onboarding](../ftue-onboarding/02-specification.md) (Spec #9)

---

## 1. Overview

Update the existing FTUE onboarding flow to auto-detect which agent platform the user came from and present the most relevant setup path prominently, with alternatives collapsed. This replaces the current curl/JS/Python tabbed code snippets with a context-aware setup experience that surfaces the new agent integration paths: connect CLI (`npx @dork-labs/loop-connect`), MCP server via Cursor deeplink, and Claude Code MCP command.

## 2. Background / Problem Statement

The current FTUE (spec #9, fully implemented) shows a 4-step checklist: copy API endpoint, copy API key, send your first issue (curl/JS/Python tabs), and a listening spinner. This treats every user as a generic API consumer manually constructing HTTP requests.

In reality, most users arriving at the dashboard are working inside a specific AI agent environment (Claude Code, Cursor, OpenHands). With the connect CLI, MCP server, and agent discovery layer now built (Features 2, 3, 5), users have far easier paths to connect — but the FTUE doesn't surface them.

The gap: users who just ran `npx @dork-labs/loop-connect` from a CLI or clicked a Cursor deeplink land on a setup page that asks them to manually construct curl commands. The FTUE should recognize how the user arrived and show the right next step.

## 3. Goals

- Auto-detect the user's agent platform from URL `?from=` params and persist the detection
- Show a single prominent CTA matching the detected platform, with alternatives collapsed
- Generate Cursor MCP install deeplinks client-side with the user's actual API credentials
- Update waiting and success state copy to be agent-centric
- Fold agent skill configuration guidance into the success state (not a separate blocking step)
- Preserve all existing FTUE behavior (welcome modal, confetti, polling)
- Append `?from=loop-connect` to the dashboard URL in the connect CLI

## 4. Non-Goals

- Building the connect CLI, MCP server, or agent skill (Features 2-5 — already built)
- Documentation updates (Feature 7) or marketing site updates (Feature 8)
- Full FTUE redesign — this is an incremental refinement of the existing flow
- `.mcpb` bundle generation in the web app (Claude Desktop uses file-based install)
- User-agent sniffing for Cursor (unreliable — Cursor webview UA is indistinguishable)
- Multi-key management, OAuth/session auth
- Adding new API endpoints — the existing polling logic handles everything

## 5. Technical Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `radix-ui` (Collapsible) | already installed | `Collapsible` primitive for "Other ways to connect" section |
| `@tanstack/react-query` | ^5.90.21 | Existing — polling for first issue arrival |
| `lucide-react` | ^0.575.0 | Existing — icons (ChevronDown, Terminal, Zap, etc.) |
| `canvas-confetti` | ^1.9.4 | Existing — celebration animation |

No new dependencies required.

## 6. Detailed Design

### 6.1 Architecture

```
apps/app/src/
├── hooks/
│   ├── use-onboarding.ts            # MODIFIED — extended state shape
│   └── use-agent-detection.ts       # NEW — detect + persist agent source
├── lib/
│   └── deeplink-builders.ts         # NEW — Cursor deeplink generation
├── components/
│   ├── agent-setup/
│   │   ├── agent-setup-step.tsx     # NEW — primary CTA + collapsible
│   │   ├── agent-path-card.tsx      # NEW — reusable path card
│   │   └── cursor-deeplink-button.tsx # NEW — "Add to Cursor" button
│   ├── setup-checklist.tsx          # MODIFIED — uses AgentSetupStep for Step 3
│   ├── setup-code-snippet.tsx       # UNCHANGED — preserved as manual fallback
│   └── welcome-modal.tsx            # UNCHANGED — copy already agent-aware
├── routes/_dashboard/issues/
│   └── index.lazy.tsx               # MODIFIED — wire up agent detection
└── __tests__/
    ├── hooks/
    │   ├── use-onboarding.test.ts   # MODIFIED — new state fields
    │   └── use-agent-detection.test.ts # NEW
    ├── lib/
    │   └── deeplink-builders.test.ts # NEW
    └── components/
        └── setup-checklist.test.tsx  # MODIFIED — AgentSetupStep paths

packages/loop-connect/src/
└── index.ts                         # MODIFIED — append ?from=loop-connect to URL
```

### 6.2 Agent Detection Hook

**File:** `apps/app/src/hooks/use-agent-detection.ts`

The `AgentSource` type represents all recognized agent platforms:

```typescript
export type AgentSource = 'loop-connect' | 'cursor' | 'claude-code' | 'openhands';
```

Detection priority chain (most reliable to least):

1. **URL `?from=` param** — Explicit, set by the linking surface (connect CLI, deeplinks, marketing site). Validated against a strict allowlist.
2. **`localStorage` persisted value** — Survives page reloads. Set on first detection.
3. **`document.referrer`** — Best-effort fallback. Blocked by many browser privacy settings. Only checks for `cursor.com`.
4. **`null`** — No detection signal available. Shows default recommended path.

```typescript
const VALID_SOURCES = new Set<AgentSource>([
  'loop-connect', 'cursor', 'claude-code', 'openhands',
]);
const STORAGE_KEY = 'loop:agent-source';

export function detectAgentSource(): AgentSource | null {
  // Priority 1: URL param
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  if (from && VALID_SOURCES.has(from as AgentSource)) return from as AgentSource;

  // Priority 2: Persisted value
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_SOURCES.has(stored as AgentSource)) return stored as AgentSource;
  } catch { /* localStorage unavailable */ }

  // Priority 3: Referrer (best-effort)
  try {
    if (document.referrer.includes('cursor.com')) return 'cursor';
  } catch { /* referrer unavailable */ }

  return null;
}
```

The `useAgentDetection` hook calls `detectAgentSource()` once on mount, persists the result to `localStorage`, and returns a stable value:

```typescript
export function useAgentDetection(): AgentSource | null {
  const [source] = useState<AgentSource | null>(() => {
    const detected = detectAgentSource();
    if (detected) {
      try { localStorage.setItem(STORAGE_KEY, detected); } catch {}
    }
    return detected;
  });
  return source;
}
```

Uses `useState` with an initializer function so detection runs exactly once (not on every render). The value is stable across re-renders because `useState` ignores the initializer after mount.

### 6.3 Extended Onboarding State

**File:** `apps/app/src/hooks/use-onboarding.ts`

Extend `OnboardingState` with two new fields:

```typescript
interface OnboardingState {
  welcomed: boolean;
  completedAt: string | null;
  agentSource: AgentSource | null;       // NEW — persisted detection result
  agentSetupDismissed: boolean;          // NEW — user skipped agent setup guidance
}

const DEFAULT_STATE: OnboardingState = {
  welcomed: false,
  completedAt: null,
  agentSource: null,
  agentSetupDismissed: false,
};
```

The `getState()` parser is updated to read the new fields from localStorage with safe defaults. The `agentSource` field is set by calling `setAgentSource(source)` from the issues route after `useAgentDetection()` returns.

Add a new `setAgentSource` callback to `UseOnboardingReturn`:

```typescript
const setAgentSource = useCallback((source: AgentSource | null) => {
  const current = getState();
  if (current.agentSource !== source) {
    setState({ ...current, agentSource: source });
  }
}, []);
```

### 6.4 Cursor Deeplink Generation

**File:** `apps/app/src/lib/deeplink-builders.ts`

Two pure functions for building Cursor MCP install deeplinks:

```typescript
/** Build a cursor:// protocol deeplink for MCP server install. */
export function buildCursorDeeplink(apiUrl: string, apiKey: string): string {
  const config = {
    command: 'npx',
    args: ['-y', '@dork-labs/loop-mcp', '--api-url', apiUrl, '--api-key', apiKey],
  };
  const encoded = btoa(JSON.stringify(config));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=${encoded}`;
}

/** Build an https:// fallback deeplink for environments without cursor:// handler. */
export function buildCursorWebDeeplink(apiUrl: string, apiKey: string): string {
  const config = {
    command: 'npx',
    args: ['-y', '@dork-labs/loop-mcp', '--api-url', apiUrl, '--api-key', apiKey],
  };
  const encoded = encodeURIComponent(btoa(JSON.stringify(config)));
  return `https://cursor.com/link/mcp/install?name=loop&config=${encoded}`;
}
```

**Note on encoding:** `btoa()` (no extra encoding) for the `cursor://` scheme. `encodeURIComponent(btoa())` for the `https://` web URL form. This matches the Cursor deeplink docs.

**Security:** The API key is embedded in the deeplink URL. This is acceptable because the URL is constructed client-side from values already visible to the authenticated user (same values shown in the existing curl/JS/Python snippets). These links are never generated server-side to avoid logging API keys in server request logs.

### 6.5 AgentSetupStep Component

**File:** `apps/app/src/components/agent-setup/agent-setup-step.tsx`

The main component that replaces Step 3 ("Send your first issue") in the setup checklist. It receives `agentSource`, `apiUrl`, and `apiKey` as props.

**Rendering logic by detected source:**

| `agentSource` | Primary Section | Primary CTA |
|--------------|----------------|-------------|
| `'loop-connect'` | Confirmation message | "Your agent is configured. Ask it to create an issue to verify the connection." |
| `'cursor'` | "Add to Cursor" card | Button with `cursor://` deeplink (triggers Cursor MCP install) |
| `'claude-code'` | Claude Code command | Copyable `claude mcp add` command snippet |
| `'openhands'` or `null` | Connect CLI (default recommended) | Copyable `npx @dork-labs/loop-connect` command |

Below the primary section, a `Collapsible` component labeled "Other ways to connect" (with a `ChevronDown` icon that rotates on open) reveals `AgentPathCard` components for all non-primary paths, plus the existing `SetupCodeSnippet` as the "Manual (curl/JS/Python)" fallback.

**Props interface:**

```typescript
interface AgentSetupStepProps {
  agentSource: AgentSource | null;
  apiUrl: string;
  apiKey: string;
  onCopy?: () => void;
}
```

### 6.6 AgentPathCard Component

**File:** `apps/app/src/components/agent-setup/agent-path-card.tsx`

A reusable card for displaying an integration path in the collapsible section:

```typescript
interface AgentPathCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode; // CTA button or code snippet
}
```

Renders as a bordered card with icon, title, description, and a CTA area. Styled consistently with the existing `bg-card border-border` pattern used throughout the FTUE.

### 6.7 CursorDeeplinkButton Component

**File:** `apps/app/src/components/agent-setup/cursor-deeplink-button.tsx`

A button that generates and links to the Cursor MCP install deeplink:

```typescript
interface CursorDeeplinkButtonProps {
  apiUrl: string;
  apiKey: string;
}
```

Renders an `<a>` tag styled as a button with the Cursor logo/icon and "Add to Cursor" text. The `href` is computed from `buildCursorDeeplink(apiUrl, apiKey)`. Opens in a new tab with `target="_blank" rel="noopener noreferrer"`.

Includes a smaller "Web link" fallback below the button that uses `buildCursorWebDeeplink()` for environments where the `cursor://` protocol handler may not be registered.

### 6.8 SetupChecklist Modifications

**File:** `apps/app/src/components/setup-checklist.tsx`

Changes to the existing component:

1. **Step 3** ("Send your first issue"): Replace the `SetupCodeSnippet` with `AgentSetupStep`. Pass `agentSource`, `apiUrl`, `apiKey`, and `onCopy` callback.

2. **Step 4** ("Listening"): Update copy from `"Listening for your first issue..."` to `"Waiting for your agent to send its first issue..."`. Update sub-text to be context-aware:
   - `'loop-connect'`: "loop-connect configured your agent. Create an issue to verify."
   - `'cursor'`: "Your Cursor MCP server is configured. Use Loop tools in a Cursor conversation."
   - `'claude-code'`: "Your Claude Code MCP server is configured. Ask Claude to create an issue."
   - `null`: "Send a signal via the API or run `npx @dork-labs/loop-connect` to configure your agent."

3. **Success state**: Update heading from `"Loop is connected!"` to `"Your agent is connected to Loop."`. Add a secondary line below the "View Issue" button: `"Next: Install the Loop Agent Skill for autonomous dispatch"` with a link to `/docs/agent-skill` (external docs URL).

**New prop:** `agentSource: AgentSource | null` added to `SetupChecklistProps`.

### 6.9 Issues Route Modifications

**File:** `apps/app/src/routes/_dashboard/issues/index.lazy.tsx`

1. Import and call `useAgentDetection()` to get the detected source.
2. Call `setAgentSource(detectedSource)` to persist it in onboarding state.
3. Pass `agentSource` to `SetupChecklist`.

```typescript
const detectedSource = useAgentDetection();
const { state, isOnboarding, markWelcomed, markComplete, setAgentSource } = useOnboarding(issueCount);

// Persist detected source into onboarding state
useEffect(() => {
  if (detectedSource && !state.agentSource) {
    setAgentSource(detectedSource);
  }
}, [detectedSource, state.agentSource, setAgentSource]);
```

The `agentSource` used for rendering comes from `state.agentSource ?? detectedSource` — preferring the persisted value but falling back to the fresh detection.

### 6.10 Connect CLI URL Update

**File:** `packages/loop-connect/src/index.ts`

In the `runInteractive` function, update the outro URL to append `?from=loop-connect`:

**Before:**
```typescript
const outroUrl = project
  ? `Connected! Visit https://app.looped.me/projects/${project.id}`
  : 'Connected! Visit https://app.looped.me';
```

**After:**
```typescript
const outroUrl = project
  ? `Connected! Visit https://app.looped.me/issues?from=loop-connect`
  : 'Connected! Visit https://app.looped.me/issues?from=loop-connect';
```

The URL now points to `/issues` (the FTUE landing page) with the `?from=loop-connect` param for detection. This change also applies to the `runNonInteractive` function's output message.

## 7. User Experience

### Current Flow

```
Welcome Modal → 4-Step Checklist → Listening Spinner → Confetti → "Loop is connected!"
                  Step 3: curl/JS/Python tabs
```

### Updated Flow

```
Welcome Modal → 4-Step Checklist → Listening Spinner → Confetti → Success + Agent Skill Guidance
                  Step 3: Auto-detected primary CTA
                         + "Other ways to connect" (collapsed)
                  Step 4: Context-aware waiting copy
```

### User Journeys by Platform

**Journey 1: User ran `npx @dork-labs/loop-connect`**
1. CLI completes setup, prints dashboard URL with `?from=loop-connect`
2. User opens URL → FTUE detects `loop-connect` source
3. Step 3 shows: "Your agent is configured — create your first issue"
4. Step 4 shows: "Waiting for your agent to send its first issue..."
5. Agent sends issue → confetti → success with Agent Skill link

**Journey 2: User clicks "Add to Cursor" on marketing site**
1. Marketing site links to `app.looped.me/issues?from=cursor`
2. FTUE detects `cursor` source
3. Step 3 shows: "Add to Cursor" deeplink button (one click to install MCP)
4. User clicks → Cursor prompts to install MCP server
5. Step 4 waits for first issue → confetti → success

**Journey 3: User navigates directly (no detection)**
1. User arrives at `/issues` with no `?from=` param
2. FTUE shows default: `npx @dork-labs/loop-connect` command (recommended)
3. "Other ways to connect" collapsible reveals Cursor, Claude Code, manual options
4. User picks a path → sends first issue → confetti → success

## 8. Testing Strategy

### Unit Tests

**`use-agent-detection.test.ts` (NEW)**
- `detectAgentSource()` returns correct source for each valid `?from=` value
- `detectAgentSource()` returns `null` for unknown/invalid `?from=` values
- `detectAgentSource()` reads from `localStorage` when no URL param present
- `detectAgentSource()` returns `null` when both URL param and localStorage are empty
- `detectAgentSource()` validates stored values against the allowlist
- `useAgentDetection()` persists detected source to localStorage
- `useAgentDetection()` returns stable value across re-renders

**`deeplink-builders.test.ts` (NEW)**
- `buildCursorDeeplink()` generates valid `cursor://` URL with base64 config
- `buildCursorDeeplink()` embeds correct API URL and key in config
- `buildCursorWebDeeplink()` generates valid `https://cursor.com/link/` URL
- `buildCursorWebDeeplink()` uses `encodeURIComponent(btoa())` encoding
- Both functions handle special characters in API URL/key

**`use-onboarding.test.ts` (EXTEND)**
- State includes `agentSource` and `agentSetupDismissed` fields with defaults
- `setAgentSource()` persists to localStorage and triggers re-render
- Backward compatibility: old localStorage format (without new fields) is parsed safely

### Component Tests

**`setup-checklist.test.tsx` (EXTEND)**
- Renders `AgentSetupStep` instead of `SetupCodeSnippet` for Step 3
- Passes `agentSource` to `AgentSetupStep`
- Updated waiting copy: "Waiting for your agent to send its first issue..."
- Updated success copy: "Your agent is connected to Loop."
- Success state includes Agent Skill guidance link

**`agent-setup-step.test.tsx` (NEW)**
- Shows `loop-connect` confirmation when `agentSource='loop-connect'`
- Shows Cursor deeplink button when `agentSource='cursor'`
- Shows Claude Code command when `agentSource='claude-code'`
- Shows default recommended path when `agentSource=null`
- "Other ways to connect" collapsible renders alternative paths
- Collapsible starts closed, opens on click

### Mocking Strategy

- `window.location.search` mocked via `vi.stubGlobal` or URL override for detection tests
- `localStorage` mocked via `vi.stubGlobal` for persistence tests
- `navigator.clipboard.writeText` mocked for copy button tests
- No API mocking needed — no new API calls

## 9. Performance Considerations

- **Detection runs once:** `useAgentDetection` uses `useState` initializer — detection logic executes only on mount, not on every render
- **Deeplinks generated inline:** `buildCursorDeeplink()` and `buildCursorWebDeeplink()` are pure, cheap functions — no memoization needed
- **No new API calls:** The existing polling logic in `issueListOptions` already handles "waiting for first issue"
- **Code splitting preserved:** New components are imported within the lazy-loaded issues route — no impact on initial bundle
- **canvas-confetti remains dynamic:** The celebration import is already lazy-loaded via dynamic `import()`

## 10. Security Considerations

- **API key in deeplinks:** The Cursor deeplink embeds `VITE_LOOP_API_KEY` in a base64-encoded URL parameter. This is the same value already visible in the existing curl/JS/Python snippets. Risk profile is identical. Links are generated client-side only — never server-side to avoid logging keys in server request logs.
- **URL parameter validation:** The `?from=` param is validated against a strict `Set<AgentSource>` allowlist. Raw param values are never rendered in the DOM without validation. The `AgentSource` union type serves as the type-level gate.
- **`btoa()` is encoding, not encryption:** The base64-encoded Cursor config is trivially decodable. This is by design — Cursor shows the decoded config to the user before installing.
- **Referrer privacy:** `document.referrer` is frequently blocked by modern browsers (Firefox ETP, Safari ITP). Treated as best-effort, never as a reliable gate. Wrapped in try/catch.

## 11. Documentation

No documentation updates are in scope for this spec (Feature 7 handles docs). However, the following should be noted for the docs spec:

- The `?from=` URL param contract should be documented for any surface linking to the dashboard
- The Cursor deeplink format should be documented in the MCP Server integration guide
- The Agent Skill guidance link in the success state should point to a real docs URL once available

## 12. Implementation Phases

### Phase 1: Core Detection + State

1. Create `use-agent-detection.ts` with `detectAgentSource()` and `useAgentDetection()` hook
2. Extend `use-onboarding.ts` with `agentSource` and `agentSetupDismissed` fields
3. Create `deeplink-builders.ts` with Cursor deeplink functions
4. Write unit tests for all three

### Phase 2: Components

5. Create `agent-path-card.tsx` reusable card component
6. Create `cursor-deeplink-button.tsx` with deeplink generation
7. Create `agent-setup-step.tsx` with primary CTA + collapsible alternatives
8. Write component tests

### Phase 3: Integration + Copy Updates

9. Modify `setup-checklist.tsx` — replace Step 3 content, update Step 4 + success copy
10. Modify `issues/index.lazy.tsx` — wire up `useAgentDetection` and pass source to checklist
11. Update existing tests for modified components

### Phase 4: External + Verification

12. Modify `packages/loop-connect/src/index.ts` — append `?from=loop-connect` to dashboard URL
13. Run full test suite, verify all FTUE behavior preserved

## 13. Open Questions

None — all decisions resolved during ideation.

## 14. Related ADRs

No existing ADRs directly constrain this feature. The localStorage-backed FTUE state pattern was established in the original FTUE implementation (spec #9) and is preserved here.

## 15. References

- [Ideation Document](./01-ideation.md) — full ideation with research synthesis
- [Research Report](../../research/20260223_ftue-agent-integration-update.md) — 14 sources on FTUE patterns, deeplink specs, detection strategies
- [Agent Integration Strategy](../agent-integration-strategy.md) — umbrella spec, this is Feature 9
- [FTUE Onboarding Spec](../ftue-onboarding/02-specification.md) — original FTUE spec (baseline)
- [Connect CLI Spec](../connect-cli/02-specification.md) — `@dork-labs/loop-connect` design
- [MCP Server Spec](../mcp-server/02-specification.md) — `@dork-labs/loop-mcp` design
- [Cursor MCP Install Links](https://cursor.com/docs/context/mcp/install-links) — deeplink format
- [Twilio Onboarding Redesign](https://www.twilio.com/en-us/blog/developers/redesigning-twilio-onboarding-experience-whats-new) — 62% activation improvement with auto-detect pattern
