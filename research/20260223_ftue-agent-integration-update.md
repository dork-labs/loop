# FTUE Agent Integration Update — Research Report

**Feature:** ftue-agent-integration-update
**Date:** 2026-02-23
**Research Mode:** Deep Research
**Searches Performed:** 14

---

## Research Summary

The recommended approach for Loop's FTUE agent integration update is **Approach 3: Auto-detect with a single prominent recommended path and a collapsible "show all options" section**. This aligns with how leading developer tools (Vercel, Twilio, Stripe) handle multi-path setup: make the most likely path frictionless, reveal alternatives on demand, and never require the user to make a choice they don't understand. The existing `loop-connect` package's `detectEnvironment()` logic can be adapted to a web-side signal detection strategy using URL params (`?from=cursor`, `?from=claude-code`) as the primary vector, with `document.referrer` and a stored `localStorage` value as fallbacks.

---

## Key Findings

### 1. Multi-Path Setup: Card Grid vs Tabs vs Auto-Detect

Leading developer tools converge on a two-tier pattern:
- **Primary surface**: A single "recommended" action prominently displayed (large button or highlighted card)
- **Secondary surface**: Alternative paths behind a disclosure control ("Other options", "More ways to install", "Switch framework")

Vercel's framework selector uses a card grid with a highlighted "recommended" card. Twilio's 2024 onboarding redesign (which drove a **62% improvement in first-message activation**) uses a single recommended flow based on pre-gathered signals, with in-context access to alternative snippets via tabs. Stripe's quickstart docs use language/framework tabs but always pre-select the most common option.

The critical insight from Twilio's redesign: **users who have to choose are users who hesitate**. The best onboarding picks for them when it can, and asks when it must.

### 2. Platform Detection Signal Priority

For a React SPA, the detection signal hierarchy, from most reliable to least reliable, is:

| Priority | Signal | Reliability | Notes |
|---|---|---|---|
| 1 | URL query param (`?from=cursor`) | High | Explicit, set by the linking surface |
| 2 | `localStorage` persisted source | High | Survives page reloads, set on first load |
| 3 | `document.referrer` | Medium | Blocked by many browser privacy settings (Firefox, Safari) |
| 4 | `navigator.userAgent` sniffing | Low | Cursor's built-in browser does not expose a unique UA |

The practical recommendation is to **use UTM-style `?from=` params as the primary mechanism** and make referrer/UA detection a best-effort fallback. When `loop-connect` deeplinks into the app from the terminal, it can inject `?from=loop-connect`. When the Cursor deeplink fires, it can inject `?from=cursor`. This is the same pattern Mixpanel, Segment, and other analytics platforms use for UTM tracking in SPAs.

**Note on Cursor UA detection**: Cursor's webview does not expose a distinguishing `navigator.userAgent`. There is an open Cursor community forum thread documenting that the Extension Host `navigator.userAgent` doesn't match the renderer process, making UA sniffing for Cursor unreliable. Do not depend on it.

### 3. Deeplink Formats for the Key Integration Paths

#### Cursor MCP Install Deeplink

```
cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=BASE64_JSON
```

The `config` parameter is a base64-encoded JSON object. For Loop's stdio MCP server:

```json
{
  "command": "npx",
  "args": ["-y", "@dork-labs/loop-mcp", "--api-url", "LOOP_API_URL", "--api-key", "LOOP_API_KEY"]
}
```

This is the same format used by Smithery, mcp.run, and other MCP registries for their "Add to Cursor" buttons. Cursor prompts the user to confirm before installing — there is no silent installation.

**Web fallback**: `https://cursor.com/link/mcp/install?name=loop&config=BASE64_JSON`

Both formats work. The `cursor://` scheme requires Cursor to be installed. The `https://cursor.com/link/...` form is the fallback for environments where the protocol handler may not be registered (e.g., CI, web-only contexts).

#### Claude Desktop Extension (.mcpb)

As of September 2025, Claude Desktop uses `.mcpb` (MCP Bundle) files for one-click extension installation. The flow:
1. User downloads a `.mcpb` file (ZIP archive containing `manifest.json` + server code)
2. Double-click opens it in Claude Desktop
3. User clicks "Install" in Claude Desktop's extension UI

There is **no `claude://` deeplink for remote MCP installation** comparable to Cursor's. The Claude Desktop install path requires a `.mcpb` file download or manual `claude mcp add` CLI command.

For Claude Code (the CLI tool), the command is:
```
claude mcp add --transport http loop https://your-loop-api-url
```

#### npx loop-connect (Recommended Path)

```
npx @dork-labs/loop-connect
```

This is the highest-value path for the FTUE because it:
- Handles all environments (Claude Code, Cursor, OpenHands) via the existing `detectEnvironment()` CLI logic
- Injects MCP config, writes CLAUDE.md/cursor rules, and handles API key setup interactively
- Requires no UI decision-making from the user — the CLI detects and configures automatically
- Is a single command copy-paste, usable in any terminal

### 4. Progressive Disclosure in Setup Wizards

The Interaction Design Foundation, GitHub Primer, and Mirakl design systems all document the same principle: **show only what the user needs to act on right now; reveal the rest on demand**.

For a setup wizard, this means:
- Step 1 shows only the recommended action
- "Other ways to connect" is a collapsible/expandable section below the primary action
- The expanded section reveals alternative integration cards
- The user who doesn't need to see alternatives never encounters them

This is sometimes called "staged disclosure" (revealing all options in sequence) vs "progressive disclosure" (revealing options based on user action). For integration setup, progressive disclosure (click to expand) outperforms staged disclosure (walk through all options) because most users only need one path.

### 5. "Add to X" Button Patterns

The established pattern across the MCP ecosystem (Smithery, mcp.run, liblab, and Cursor's own docs) is:

```tsx
<a href={cursorDeeplink} className="button">
  <CursorIcon /> Add to Cursor
</a>
```

Where `cursorDeeplink` is the `cursor://anysphere.cursor-deeplink/mcp/install?...` URL with the user's actual API key and endpoint injected at render time.

Security consideration: the API key is embedded in the deeplink URL. This is acceptable for MCP install links because:
1. The URL is constructed client-side from values the user already has access to (`env.VITE_LOOP_API_KEY`)
2. The link is shown only to the authenticated user
3. Cursor prompts for user confirmation before installation

Do NOT generate these deeplinks server-side and cache them. Generate them client-side from `env` values, same as the existing `SetupCodeSnippet` does for curl/JS/Python snippets.

---

## Detailed Analysis

### Current FTUE Flow (As-Is)

```
WelcomeModal (dismissable dialog)
  -> SetupChecklist (4-step list)
     -> Step 1: Copy API endpoint
     -> Step 2: Copy API key (masked)
     -> Step 3: SetupCodeSnippet (curl/JS/Python tabs)
     -> Step 4: Listening spinner (polls every 3s)
  -> Success state (confetti + "Loop is connected!")
```

The current flow is clean and functional. The key gap: it treats the user as a generic API consumer, not as someone working inside a specific AI agent environment. Most users arriving at this dashboard are Claude Code or Cursor users who just ran `npx @dork-labs/loop-connect` — they want one-click confirmation, not a multi-step manual curl tutorial.

### Proposed FTUE Flow (To-Be)

```
WelcomeModal (unchanged — brief, non-modal-blocking)
  -> AgentSetupStep (NEW — replaces SetupChecklist as the primary surface)
     -> Auto-detected path shown prominently (based on ?from= param)
     -> "Other ways to connect" collapsible (secondary paths)
  -> WaitingStep (replaces the current "Step 4: Listening" with a full-screen waiting state)
  -> Success state (unchanged confetti pattern)
```

The `useOnboarding` hook needs a new field: `detectedSource` (`'loop-connect' | 'cursor' | 'claude-code' | 'manual' | null`). This is read from URL params on first load and persisted to `localStorage` so it survives refreshes.

### Approach Comparison

#### Approach 1: Tabbed Interface (Current Pattern Extended)
**Tabs: loop-connect | Cursor | Claude Code | Manual**

- Pros: Familiar (existing tab UI is already present), easy to implement, no detection logic needed
- Cons: Requires user to read and choose; equal visual weight across all options implies no recommendation; "Manual" tab (curl/JS/Python) is likely the least-used path but gets equal billing
- Verdict: Acceptable but suboptimal. Better than the current flow, but misses the auto-detect opportunity.

#### Approach 2: Card Grid with Recommended Badge
**4 cards: loop-connect (Recommended), Cursor (deeplink), Claude Code (.mcpb), Manual (curl/JS/Python)**

- Pros: Clear visual hierarchy with the recommended badge; scannable at a glance; consistent with Vercel's framework selector pattern
- Cons: 4 cards is a lot for a modal/inline context; requires user to make a choice before proceeding; doesn't leverage signal detection
- Verdict: Good for users who know what they want, but still adds decision friction for first-time users.

#### Approach 3: Auto-Detect with Single Recommended Path + Collapsible Alternatives (RECOMMENDED)
**Single primary action, expandable "Other ways to connect"**

- Pros: Zero friction for the majority case (user came from loop-connect or Cursor deeplink); alternatives available without being distracting; mirrors Twilio's high-performing onboarding redesign; detection logic is straightforward (URL params)
- Cons: Requires detection logic; if detection is wrong, user must expand to find the right path (low cost)
- Verdict: Best overall. Optimal for the AI-native developer audience who expects smart defaults.

#### Approach 4: Wizard Flow ("Which agent are you using?")
**Question screen -> Platform-specific instructions**

- Pros: 100% accurate path selection; no detection complexity
- Cons: Adds an extra screen/step; asking users to identify their tool creates friction; most users don't think of themselves as "using an agent", they're just coding with Claude or Cursor
- Verdict: Anti-pattern for this audience. AI-native developers have low tolerance for wizard flows. Reserve this pattern for onboarding flows that have no detection signal available.

### Detection Implementation

The `detectedSource` logic should live in a new `useAgentDetection` hook. Here is the implementation pattern:

```typescript
// Detect once on mount, persist to localStorage under 'loop:agent-source'
// Priority: URL param > localStorage > document.referrer (best-effort) > null

type AgentSource = 'loop-connect' | 'cursor' | 'claude-code' | 'openhands' | null;

function detectAgentSource(): AgentSource {
  // Priority 1: URL param (most reliable, set by linking surface)
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  if (from === 'loop-connect') return 'loop-connect';
  if (from === 'cursor') return 'cursor';
  if (from === 'claude-code') return 'claude-code';
  if (from === 'openhands') return 'openhands';

  // Priority 2: Persisted value from a prior session
  try {
    const stored = localStorage.getItem('loop:agent-source');
    if (stored) return stored as AgentSource;
  } catch { /* ignore */ }

  // Priority 3: document.referrer (best-effort, often blocked)
  if (document.referrer.includes('cursor.com')) return 'cursor';

  return null;
}
```

The `loop-connect` CLI should be updated to append `?from=loop-connect` to the dashboard URL it opens post-setup. Cursor deeplinks already include the source context. Claude Code MCP installs can be linked from the dashboard with a `?from=claude-code` query param.

### Cursor Deeplink Generation (Client-Side)

```typescript
function buildCursorDeeplink(apiUrl: string, apiKey: string): string {
  const config = {
    command: 'npx',
    args: ['-y', '@dork-labs/loop-mcp', '--api-url', apiUrl, '--api-key', apiKey],
  };
  const encoded = btoa(JSON.stringify(config));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=${encoded}`;
}

function buildCursorWebDeeplink(apiUrl: string, apiKey: string): string {
  // Web fallback for environments without the cursor:// protocol handler
  const config = {
    command: 'npx',
    args: ['-y', '@dork-labs/loop-mcp', '--api-url', apiUrl, '--api-key', apiKey],
  };
  const encoded = encodeURIComponent(btoa(JSON.stringify(config)));
  return `https://cursor.com/link/mcp/install?name=loop&config=${encoded}`;
}
```

Note: Use `encodeURIComponent(btoa(...))` for the web URL form and `btoa(...)` (no extra encoding) for the `cursor://` protocol form. Cursor's deeplink docs show the config parameter unencoded in the `cursor://` scheme.

### Agent Setup Step — Component Architecture

Given the existing code quality rules (50-line function limit, 300-line file limit, extraction patterns), the new component should be structured as:

```
components/
  agent-setup/
    agent-setup-step.tsx       # Main component (orchestrates sub-components)
    agent-path-card.tsx        # Reusable card for each integration path
    cursor-deeplink-button.tsx # "Add to Cursor" button with deeplink logic
    use-agent-detection.ts     # Hook: detects + persists agent source
    deeplink-builders.ts       # Pure functions: buildCursorDeeplink, etc.
```

This keeps each file well under 300 lines and separates the detection logic from the presentation.

### Updated `useOnboarding` Hook

The existing `useOnboardingState` interface should be extended:

```typescript
interface OnboardingState {
  welcomed: boolean;
  completedAt: string | null;
  agentSource: AgentSource | null;  // NEW: persisted detection result
  agentSetupDismissed: boolean;     // NEW: user explicitly skipped agent setup step
}
```

The `agentSetupDismissed` flag allows users who configured their agent out-of-band to skip the agent setup step without completing it. This prevents the step from blocking users who already connected via a different path.

### Empty State / Waiting State Copy

Current copy: "Listening for your first issue... Polling every 3 seconds..."
Proposed copy: "Waiting for your agent to send its first issue..."

The sub-line should be context-aware based on `detectedSource`:
- `loop-connect`: "loop-connect has been configured. Ask your agent to create an issue to verify the connection."
- `cursor`: "Your Cursor MCP server is configured. Use the `get_next_task` tool in a Cursor conversation to send your first issue."
- `claude-code`: "Your Claude Code MCP server is configured. Ask Claude to create an issue using the Loop tools."
- `null`: "Send a signal via the API or run `npx @dork-labs/loop-connect` to configure your agent."

---

## Potential Solutions

### Solution A: Minimal Change (Tabbed Agent Setup)

Extend `SetupCodeSnippet` with new tabs for agent platforms. Replace the current "curl / JavaScript / Python" tabs with "loop-connect (Recommended) / Cursor / Claude Code / Manual". Keep the existing 4-step checklist structure.

- **Effort:** Low (1-2 days)
- **Impact:** Medium — improves discoverability of agent paths without adding complexity
- **Tradeoff:** No auto-detection; user must choose; "Manual" tab preserves the raw API option

### Solution B: Auto-Detect + New AgentSetupStep Component (RECOMMENDED)

Replace `SetupChecklist` with a new `AgentSetupStep` that:
1. Detects source from URL params / localStorage
2. Shows the detected path as the primary action with a large CTA button
3. Collapses alternative paths under "Other ways to connect"
4. Preserves the existing waiting/success states

- **Effort:** Medium (3-4 days)
- **Impact:** High — eliminates decision friction for the majority path, aligns with Twilio/Vercel patterns
- **Tradeoff:** Requires detection logic and new hook state; detection can be wrong (recoverable with "show all options")

### Solution C: Full Wizard with Platform Question Screen

Add a new wizard step before the checklist that asks "How are you connecting?" with 4 platform cards. Answer determines the instructions shown.

- **Effort:** Medium-High (4-5 days)
- **Impact:** Medium — reliable path selection but adds friction
- **Tradeoff:** Extra step; poor fit for AI-native developer audience; detection can be added later to skip the question screen automatically

---

## Security Considerations

1. **API key in deeplinks**: The Cursor deeplink embeds the `VITE_LOOP_API_KEY` in a base64-encoded URL parameter. This is the same value already visible in the curl/JS/Python snippets and stored in the user's browser via `env.ts`. The risk profile is identical. Do not generate these links server-side to avoid inadvertently logging API keys in server request logs.

2. **URL parameter injection**: The `?from=` param is user-controlled and must be validated against a strict allowlist (`'loop-connect' | 'cursor' | 'claude-code' | 'openhands'`). Never use the raw URL param value in rendered output without validation — use the typed `AgentSource` union type as the gate.

3. **btoa() encoding**: `btoa()` is a character encoding function, not encryption. The base64-encoded Cursor config is trivially decodable. This is by design — Cursor shows the user the decoded config before installing. Do not encode secrets beyond what is already in the user's environment.

4. **Referrer header privacy**: `document.referrer` is frequently blocked or truncated by modern browsers (Firefox Enhanced Tracking Protection, Safari ITP). Treat it as a best-effort signal, never as a reliable gate.

---

## Performance Considerations

1. **Detection runs once**: The `useAgentDetection` hook should detect on first render and write to `localStorage`. On subsequent renders, it reads from `localStorage` only (avoids URL parsing on every render).

2. **Deeplinks are generated lazily**: The `buildCursorDeeplink()` and `buildCursorWebDeeplink()` functions are pure and cheap — call them inline in JSX, no memoization needed unless profiling shows a problem.

3. **No new API calls**: The FTUE update requires zero new API calls. The existing polling logic in `issueListOptions` already handles the "waiting for first issue" state.

4. **Code splitting**: The `AgentSetupStep` component and its sub-components should be co-located with the existing lazy route (`issues/index.lazy.tsx`) so they are loaded only when the issues page renders — consistent with the existing approach.

5. **canvas-confetti remains dynamic**: The celebration import (`const confetti = (await import('canvas-confetti')).default`) is already dynamic and should remain so.

---

## Recommendation

**Implement Solution B: Auto-Detect + New AgentSetupStep Component.**

### Specific Implementation Plan

#### Step 1: Add `useAgentDetection` Hook
Create `/apps/app/src/hooks/use-agent-detection.ts` with:
- `detectAgentSource()` pure function (URL param > localStorage > referrer > null)
- `useAgentDetection()` hook that detects once and persists to `localStorage`
- Strict `AgentSource` type: `'loop-connect' | 'cursor' | 'claude-code' | 'openhands' | null`

#### Step 2: Extend `useOnboarding`
Add `agentSource: AgentSource` and `agentSetupDismissed: boolean` to `OnboardingState`. Wire in `useAgentDetection` so the hook owns the full FTUE state.

#### Step 3: Create `AgentSetupStep` Component
Structure: `components/agent-setup/`

Primary action rendering by `detectedSource`:

| Source | Primary CTA | Secondary |
|---|---|---|
| `loop-connect` | "loop-connect is configured — run your agent" | Cursor deeplink, manual curl |
| `cursor` | "Add to Cursor" button (deeplink) | loop-connect npx command, manual curl |
| `claude-code` | `claude mcp add` command snippet | loop-connect npx, Cursor deeplink |
| `null` | `npx @dork-labs/loop-connect` command (default recommended) | Cursor deeplink, Claude Code, manual curl |

The "Other ways to connect" collapsible should use the existing `Collapsible` shadcn/ui component (already in the component library at `src/components/ui/collapsible.tsx`).

#### Step 4: Update Copy
- Welcome modal: keep current copy (it is already agent-aware: "tells your AI agent what to do next")
- Waiting state: "Waiting for your agent to send its first issue..." with context-aware sub-line
- Success state: "Your agent is connected to Loop." (remove the generic "Loop is connected!")

#### Step 5: Update `loop-connect` CLI
Append `?from=loop-connect` to the dashboard URL opened after successful connection. This single change activates the auto-detection path for the highest-volume FTUE scenario.

#### Step 6: Write Tests
Extend `__tests__/hooks/use-onboarding.test.ts` to cover:
- `detectAgentSource()` with each URL param value
- `detectAgentSource()` with invalid/unknown `?from=` values (should return `null`)
- `detectAgentSource()` localStorage persistence
- `useOnboarding` with new `agentSource` field

### What NOT to Build

- Do not add a "which agent are you using?" question screen (Approach 4). The audience will find it patronizing.
- Do not make the 4-path choice mandatory before showing the waiting state. The waiting state should be reachable immediately.
- Do not attempt UA sniffing for Cursor. It is unreliable.
- Do not build a `.mcpb` bundle generation flow in the web app. Claude Desktop extension installation requires a file download + double-click; it is better served by documentation or a separate distribution artifact.

---

## Research Gaps and Limitations

- **Claude Code deeplink format**: There is no documented `claude://` URL scheme for one-click MCP installation comparable to Cursor's. The Anthropic engineering blog covers `.mcpb` desktop extension bundles, but not a web-initiated deeplink. The `claude mcp add` CLI command is the current best path for Claude Code users.
- **OpenHands FTUE path**: The `loop-connect` package has an OpenHands detector (`hasOpenHands: existsSync(join(cwd, '.openhands'))`), but there are no publicly documented deeplink or one-click install patterns for OpenHands. The `loop-connect` CLI is the right path for OpenHands users.
- **Referrer reliability data**: No controlled experiments on referrer detection rates in 2025-era browsers were found. Treat referrer as decoration, not signal.

---

## Search Methodology

- Number of searches performed: 14 (8 WebSearch + 6 WebFetch)
- Most productive search terms: "cursor deeplink MCP install", "mcp install links cursor docs", "Twilio onboarding redesign", "Smithery deep linking"
- Primary information sources: cursor.com/docs, smithery.ai/docs, anthropic.com/engineering, Twilio engineering blog, MDN (referrer docs), codebase analysis

---

## Sources

- [MCP Install Links | Cursor Docs](https://cursor.com/docs/context/mcp/install-links)
- [Deeplinks | Cursor Docs](https://cursor.com/docs/integrations/deeplinks)
- [One-Click MCP Install with Cursor Deeplinks](https://aiengineerguide.com/blog/cursor-mcp-deeplink/)
- [Deep Linking - Smithery Documentation](https://smithery.ai/docs/use/deep-linking)
- [One-click MCP server installation for Claude Desktop](https://www.anthropic.com/engineering/desktop-extensions)
- [Connect Claude Code to tools via MCP - Claude Code Docs](https://code.claude.com/docs/en/mcp)
- [Twilio's New Onboarding: Fast, Personalized, and Developer-Friendly](https://www.twilio.com/en-us/blog/developers/redesigning-twilio-onboarding-experience-whats-new)
- [Document: referrer property - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/referrer)
- [Extension Host navigator.userAgent doesn't match renderer process - Cursor Forum](https://forum.cursor.com/t/extension-host-navigator-useragent-doesnt-match-renderer-process-breaking-vs-code-extension-compatibility/148095)
- [Progressive Disclosure | IxDF](https://www.interaction-design.org/literature/topics/progressive-disclosure)
- [Progressive disclosure | Primer (GitHub)](https://primer.style/product/ui-patterns/progressive-disclosure/)
- [UX Onboarding Best Practices in 2025](https://www.uxdesigninstitute.com/blog/ux-onboarding-best-practices-guide/)
- [Progressive Disclosure Examples - Userpilot](https://userpilot.com/blog/progressive-disclosure-examples/)
- [Cursor → Create 1-click MCP Install Deeplink - Xano](https://www.xano.com/actions/run/xano/cursor-1-click-mcp)
