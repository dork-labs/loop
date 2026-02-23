---
slug: ftue-agent-integration-update
number: 18
created: 2026-02-23
status: tasks
---

# Tasks: FTUE Update for Agent Integration

**Decomposed:** 2026-02-23
**Source:** [Specification](./02-specification.md)

---

## Phase 1: Core Detection + State

### Task 1: [ftue-agent-integration-update] [P1] Create use-agent-detection hook

**File:** `apps/app/src/hooks/use-agent-detection.ts`
**Active form:** Creating agent detection hook

Create the agent detection hook that reads `?from=` URL params, falls back to localStorage, then document.referrer.

**Implementation:**

```typescript
import { useState } from 'react';

export type AgentSource = 'loop-connect' | 'cursor' | 'claude-code' | 'openhands';

const VALID_SOURCES = new Set<AgentSource>([
  'loop-connect', 'cursor', 'claude-code', 'openhands',
]);
const STORAGE_KEY = 'loop:agent-source';

/** Detect the agent source from URL params, localStorage, or referrer. */
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

/**
 * Detect agent source once on mount and persist to localStorage.
 *
 * Uses useState initializer so detection runs exactly once (not on every render).
 */
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

**Acceptance criteria:**
- `detectAgentSource()` returns correct `AgentSource` for valid `?from=` values
- Returns `null` for unknown/invalid `?from=` values
- Falls back to localStorage when no URL param
- Falls back to `document.referrer` checking for `cursor.com`
- Returns `null` when all sources are empty
- Validates stored values against the allowlist
- `useAgentDetection()` persists detected source to localStorage
- `useAgentDetection()` returns stable value across re-renders
- `VALID_SOURCES` contains exactly: `loop-connect`, `cursor`, `claude-code`, `openhands`
- `STORAGE_KEY` is `'loop:agent-source'`

---

### Task 2: [ftue-agent-integration-update] [P1] Extend use-onboarding hook with agent state fields

**File:** `apps/app/src/hooks/use-onboarding.ts`
**Active form:** Extending onboarding hook with agent state

Add `agentSource` and `agentSetupDismissed` fields to `OnboardingState`, update `DEFAULT_STATE`, update `getState()` parser for backward compatibility, and add `setAgentSource` callback.

**Changes to `OnboardingState` interface:**

```typescript
import type { AgentSource } from './use-agent-detection';

interface OnboardingState {
  welcomed: boolean;
  completedAt: string | null;
  agentSource: AgentSource | null;       // NEW
  agentSetupDismissed: boolean;          // NEW
}

const DEFAULT_STATE: OnboardingState = {
  welcomed: false,
  completedAt: null,
  agentSource: null,
  agentSetupDismissed: false,
};
```

**Update `getState()` parser** to safely read the new fields with defaults (backward compatibility with old localStorage format):

```typescript
function getState(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    if (raw === cachedRaw) return cachedState;
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    cachedRaw = raw;
    cachedState = {
      welcomed: parsed.welcomed === true,
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
      agentSource: typeof parsed.agentSource === 'string' ? (parsed.agentSource as AgentSource) : null,
      agentSetupDismissed: parsed.agentSetupDismissed === true,
    };
    return cachedState;
  } catch {
    return DEFAULT_STATE;
  }
}
```

**Add `setAgentSource` to `UseOnboardingReturn`:**

```typescript
interface UseOnboardingReturn {
  state: OnboardingState;
  isOnboarding: boolean;
  markWelcomed: () => void;
  markComplete: () => void;
  setAgentSource: (source: AgentSource | null) => void;  // NEW
}
```

**Add `setAgentSource` callback in `useOnboarding`:**

```typescript
const setAgentSource = useCallback((source: AgentSource | null) => {
  const current = getState();
  if (current.agentSource !== source) {
    setState({ ...current, agentSource: source });
  }
}, []);
```

**Update return:**

```typescript
return { state, isOnboarding, markWelcomed, markComplete, setAgentSource };
```

**Acceptance criteria:**
- `OnboardingState` has `agentSource: AgentSource | null` and `agentSetupDismissed: boolean`
- `DEFAULT_STATE` includes `agentSource: null` and `agentSetupDismissed: false`
- Old localStorage format (without new fields) parses safely with defaults
- `setAgentSource()` persists to localStorage and triggers re-render
- `setAgentSource()` is a no-op if source hasn't changed (avoids unnecessary writes)
- Import `AgentSource` type from `./use-agent-detection`

---

### Task 3: [ftue-agent-integration-update] [P1] Create deeplink-builders utility

**File:** `apps/app/src/lib/deeplink-builders.ts`
**Active form:** Creating Cursor deeplink builder functions

Create two pure functions for building Cursor MCP install deeplinks.

**Implementation:**

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

**Key details:**
- `btoa()` (no extra encoding) for the `cursor://` scheme
- `encodeURIComponent(btoa())` for the `https://` web URL form
- Config JSON: `{ command: 'npx', args: ['-y', '@dork-labs/loop-mcp', '--api-url', apiUrl, '--api-key', apiKey] }`

**Acceptance criteria:**
- `buildCursorDeeplink()` generates valid `cursor://anysphere.cursor-deeplink/mcp/install` URL with base64 config
- `buildCursorDeeplink()` embeds correct API URL and key in config
- `buildCursorWebDeeplink()` generates valid `https://cursor.com/link/mcp/install` URL
- `buildCursorWebDeeplink()` uses `encodeURIComponent(btoa())` encoding
- Both functions handle special characters in API URL/key

---

### Task 4: [ftue-agent-integration-update] [P1] Write unit tests for Phase 1 modules

**Files:**
- `apps/app/src/__tests__/hooks/use-agent-detection.test.ts` (NEW)
- `apps/app/src/__tests__/lib/deeplink-builders.test.ts` (NEW)
- `apps/app/src/__tests__/hooks/use-onboarding.test.ts` (EXTEND)

**Active form:** Writing unit tests for detection hook, deeplink builders, and onboarding state

**`use-agent-detection.test.ts` — NEW file:**

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { detectAgentSource, useAgentDetection } from '@/hooks/use-agent-detection';

const STORAGE_KEY = 'loop:agent-source';

describe('detectAgentSource', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    // Reset URL after each test
    window.history.replaceState({}, '', '/');
  });

  it('returns correct source for each valid ?from= value', () => {
    for (const source of ['loop-connect', 'cursor', 'claude-code', 'openhands']) {
      window.history.replaceState({}, '', `/?from=${source}`);
      expect(detectAgentSource()).toBe(source);
    }
  });

  it('returns null for unknown ?from= values', () => {
    window.history.replaceState({}, '', '/?from=unknown-agent');
    expect(detectAgentSource()).toBeNull();
  });

  it('returns null for empty ?from= param', () => {
    window.history.replaceState({}, '', '/?from=');
    expect(detectAgentSource()).toBeNull();
  });

  it('reads from localStorage when no URL param present', () => {
    localStorage.setItem(STORAGE_KEY, 'cursor');
    expect(detectAgentSource()).toBe('cursor');
  });

  it('returns null when both URL param and localStorage are empty', () => {
    expect(detectAgentSource()).toBeNull();
  });

  it('validates stored values against the allowlist', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid-source');
    expect(detectAgentSource()).toBeNull();
  });

  it('URL param takes priority over localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'cursor');
    window.history.replaceState({}, '', '/?from=claude-code');
    expect(detectAgentSource()).toBe('claude-code');
  });
});

describe('useAgentDetection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('persists detected source to localStorage', () => {
    window.history.replaceState({}, '', '/?from=cursor');
    renderHook(() => useAgentDetection());
    expect(localStorage.getItem(STORAGE_KEY)).toBe('cursor');
  });

  it('returns stable value across re-renders', () => {
    window.history.replaceState({}, '', '/?from=loop-connect');
    const { result, rerender } = renderHook(() => useAgentDetection());
    const firstValue = result.current;
    rerender();
    expect(result.current).toBe(firstValue);
  });

  it('returns null when no detection signal available', () => {
    const { result } = renderHook(() => useAgentDetection());
    expect(result.current).toBeNull();
  });
});
```

**`deeplink-builders.test.ts` — NEW file:**

```typescript
import { describe, it, expect } from 'vitest';
import { buildCursorDeeplink, buildCursorWebDeeplink } from '@/lib/deeplink-builders';

describe('buildCursorDeeplink', () => {
  it('generates valid cursor:// URL with base64 config', () => {
    const result = buildCursorDeeplink('http://localhost:5667', 'loop_test123');
    expect(result).toMatch(/^cursor:\/\/anysphere\.cursor-deeplink\/mcp\/install\?name=loop&config=/);
  });

  it('embeds correct API URL and key in config', () => {
    const result = buildCursorDeeplink('http://localhost:5667', 'loop_test123');
    const configParam = new URL(result.replace('cursor://', 'https://')).searchParams.get('config')!;
    const config = JSON.parse(atob(configParam));
    expect(config).toEqual({
      command: 'npx',
      args: ['-y', '@dork-labs/loop-mcp', '--api-url', 'http://localhost:5667', '--api-key', 'loop_test123'],
    });
  });

  it('handles special characters in API URL', () => {
    const result = buildCursorDeeplink('https://api.example.com/v1?foo=bar&baz=1', 'loop_key');
    expect(result).toContain('cursor://');
    const configParam = new URL(result.replace('cursor://', 'https://')).searchParams.get('config')!;
    const config = JSON.parse(atob(configParam));
    expect(config.args).toContain('https://api.example.com/v1?foo=bar&baz=1');
  });
});

describe('buildCursorWebDeeplink', () => {
  it('generates valid https://cursor.com/link/ URL', () => {
    const result = buildCursorWebDeeplink('http://localhost:5667', 'loop_test123');
    expect(result).toMatch(/^https:\/\/cursor\.com\/link\/mcp\/install\?name=loop&config=/);
  });

  it('uses encodeURIComponent(btoa()) encoding', () => {
    const result = buildCursorWebDeeplink('http://localhost:5667', 'loop_test123');
    const url = new URL(result);
    const encodedConfig = url.searchParams.get('config')!;
    // The config should be decodable as URI component then base64
    const config = JSON.parse(atob(decodeURIComponent(encodedConfig)));
    expect(config.command).toBe('npx');
    expect(config.args).toContain('@dork-labs/loop-mcp');
  });
});
```

**`use-onboarding.test.ts` — EXTEND existing file with these additional tests:**

```typescript
it('state includes agentSource and agentSetupDismissed with defaults', () => {
  const { result } = renderHook(() => useOnboarding(0));
  expect(result.current.state.agentSource).toBeNull();
  expect(result.current.state.agentSetupDismissed).toBe(false);
});

it('setAgentSource persists to localStorage and triggers re-render', () => {
  const { result } = renderHook(() => useOnboarding(0));
  act(() => {
    result.current.setAgentSource('cursor');
  });
  expect(result.current.state.agentSource).toBe('cursor');
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
  expect(stored.agentSource).toBe('cursor');
});

it('backward compatibility: old localStorage format parses safely', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ welcomed: true, completedAt: null }));
  const { result } = renderHook(() => useOnboarding(0));
  expect(result.current.state.agentSource).toBeNull();
  expect(result.current.state.agentSetupDismissed).toBe(false);
  expect(result.current.state.welcomed).toBe(true);
});
```

**Acceptance criteria:**
- All `detectAgentSource()` test cases pass (valid sources, invalid, null, priority chain)
- All `useAgentDetection()` test cases pass (persistence, stability, null)
- All `buildCursorDeeplink()` test cases pass (URL format, config content, special chars)
- All `buildCursorWebDeeplink()` test cases pass (URL format, encoding)
- Extended `use-onboarding.test.ts` passes with new state field assertions
- Backward compatibility test passes (old format without new fields)

---

## Phase 2: Components

### Task 5: [ftue-agent-integration-update] [P2] Create agent-path-card component

**File:** `apps/app/src/components/agent-setup/agent-path-card.tsx`
**Active form:** Creating reusable agent path card component

Create a reusable card for displaying an integration path in the collapsible "Other ways to connect" section.

**Implementation:**

```typescript
interface AgentPathCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode; // CTA button or code snippet
}

/** Reusable card for displaying an agent integration path. */
export function AgentPathCard({ icon, title, description, children }: AgentPathCardProps) {
  return (
    <div className="bg-card border-border rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="bg-muted flex size-8 items-center justify-center rounded-md">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}
```

**Styling details:**
- Bordered card using `bg-card border-border` pattern (consistent with existing FTUE)
- Icon in an 8x8 muted background rounded container
- Title as `text-sm font-medium`, description as `text-xs text-muted-foreground`
- Children slot for CTA button or code snippet

**Acceptance criteria:**
- Renders icon, title, description, and children
- Uses `bg-card border-border` styling consistent with FTUE
- Children are rendered in a dedicated CTA area below the header

---

### Task 6: [ftue-agent-integration-update] [P2] Create cursor-deeplink-button component

**File:** `apps/app/src/components/agent-setup/cursor-deeplink-button.tsx`
**Active form:** Creating Cursor deeplink button component

Create a button that generates and links to the Cursor MCP install deeplink.

**Implementation:**

```typescript
import { buildCursorDeeplink, buildCursorWebDeeplink } from '@/lib/deeplink-builders';

interface CursorDeeplinkButtonProps {
  apiUrl: string;
  apiKey: string;
}

/** Button that links to a Cursor MCP install deeplink with web fallback. */
export function CursorDeeplinkButton({ apiUrl, apiKey }: CursorDeeplinkButtonProps) {
  const deeplinkHref = buildCursorDeeplink(apiUrl, apiKey);
  const webHref = buildCursorWebDeeplink(apiUrl, apiKey);

  return (
    <div className="space-y-2">
      <a
        href={deeplinkHref}
        target="_blank"
        rel="noopener noreferrer"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
      >
        Add to Cursor
      </a>
      <p className="text-muted-foreground text-xs">
        Doesn't work?{' '}
        <a
          href={webHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Try the web link
        </a>
      </p>
    </div>
  );
}
```

**Key details:**
- Primary button renders as `<a>` tag with `cursor://` deeplink
- Opens in new tab with `target="_blank" rel="noopener noreferrer"`
- Smaller "web link" fallback below using `buildCursorWebDeeplink()`
- Styled as a primary button matching existing shadcn/ui patterns

**Acceptance criteria:**
- Renders "Add to Cursor" as a styled anchor tag
- `href` uses `buildCursorDeeplink(apiUrl, apiKey)`
- Opens in new tab
- Renders web link fallback using `buildCursorWebDeeplink()`
- Both links include correct `rel` attributes

---

### Task 7: [ftue-agent-integration-update] [P2] Create agent-setup-step component

**File:** `apps/app/src/components/agent-setup/agent-setup-step.tsx`
**Active form:** Creating agent setup step with primary CTA and collapsible alternatives

Create the main component that replaces Step 3 in the setup checklist. Shows context-aware primary CTA based on detected agent source, with collapsed alternatives.

**Props interface:**

```typescript
import type { AgentSource } from '@/hooks/use-agent-detection';

interface AgentSetupStepProps {
  agentSource: AgentSource | null;
  apiUrl: string;
  apiKey: string;
  onCopy?: () => void;
}
```

**Rendering logic by detected source:**

| `agentSource` | Primary Section | Primary CTA |
|--------------|----------------|-------------|
| `'loop-connect'` | Confirmation message | "Your agent is configured. Ask it to create an issue to verify the connection." |
| `'cursor'` | "Add to Cursor" card | `CursorDeeplinkButton` with `cursor://` deeplink |
| `'claude-code'` | Claude Code command | Copyable `claude mcp add loop --transport stdio -- npx -y @dork-labs/loop-mcp --api-url {apiUrl} --api-key {apiKey}` command snippet |
| `'openhands'` or `null` | Connect CLI (default recommended) | Copyable `npx @dork-labs/loop-connect` command |

**Below the primary section:** A `Collapsible` component (from radix-ui, already installed) labeled "Other ways to connect" with a `ChevronDown` icon that rotates on open. The collapsible reveals `AgentPathCard` components for all non-primary paths, plus the existing `SetupCodeSnippet` as the "Manual (curl/JS/Python)" fallback.

**Component structure:**

```typescript
import { useState } from 'react';
import { ChevronDown, Terminal, Zap, Monitor } from 'lucide-react';
import * as Collapsible from '@radix-ui/react-collapsible';
import type { AgentSource } from '@/hooks/use-agent-detection';
import { AgentPathCard } from './agent-path-card';
import { CursorDeeplinkButton } from './cursor-deeplink-button';
import { SetupCodeSnippet } from '@/components/setup-code-snippet';

export function AgentSetupStep({ agentSource, apiUrl, apiKey, onCopy }: AgentSetupStepProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Primary CTA based on agentSource */}
      {renderPrimaryCTA(agentSource, apiUrl, apiKey, onCopy)}

      {/* Collapsible alternatives */}
      <Collapsible.Root open={isOpen} onOpenChange={setIsOpen}>
        <Collapsible.Trigger className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors">
          <ChevronDown
            className={`size-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
          Other ways to connect
        </Collapsible.Trigger>
        <Collapsible.Content className="mt-3 space-y-3">
          {/* Render AgentPathCard for each non-primary path */}
          {/* Always include SetupCodeSnippet as "Manual" fallback */}
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  );
}
```

The `renderPrimaryCTA` helper function switches on `agentSource` to return the appropriate primary section. Non-primary paths are rendered as `AgentPathCard` components inside the collapsible.

**Acceptance criteria:**
- Shows loop-connect confirmation when `agentSource='loop-connect'`
- Shows Cursor deeplink button when `agentSource='cursor'`
- Shows Claude Code command when `agentSource='claude-code'`
- Shows default recommended path (connect CLI) when `agentSource=null`
- "Other ways to connect" collapsible renders alternative paths
- Collapsible starts closed, opens on click
- `SetupCodeSnippet` always appears as "Manual" fallback in alternatives
- `ChevronDown` icon rotates when collapsible opens

---

### Task 8: [ftue-agent-integration-update] [P2] Write component tests for agent-setup components

**File:** `apps/app/src/__tests__/components/agent-setup-step.test.tsx` (NEW)
**Active form:** Writing component tests for agent setup step

**Test cases:**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AgentSetupStep } from '@/components/agent-setup/agent-setup-step';

vi.mock('@/env', () => ({
  env: {
    VITE_API_URL: 'http://localhost:5667',
    VITE_LOOP_API_KEY: 'sk-test-key-123',
  },
}));

describe('AgentSetupStep', () => {
  const defaultProps = {
    apiUrl: 'http://localhost:5667',
    apiKey: 'loop_test123',
  };

  it('shows loop-connect confirmation when agentSource is loop-connect', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="loop-connect" />);
    expect(screen.getByText(/your agent is configured/i)).toBeInTheDocument();
  });

  it('shows Cursor deeplink button when agentSource is cursor', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="cursor" />);
    expect(screen.getByText(/add to cursor/i)).toBeInTheDocument();
  });

  it('shows Claude Code command when agentSource is claude-code', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="claude-code" />);
    expect(screen.getByText(/claude mcp add/i)).toBeInTheDocument();
  });

  it('shows default recommended path when agentSource is null', () => {
    render(<AgentSetupStep {...defaultProps} agentSource={null} />);
    expect(screen.getByText(/npx @dork-labs\/loop-connect/i)).toBeInTheDocument();
  });

  it('renders "Other ways to connect" collapsible', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="cursor" />);
    expect(screen.getByText(/other ways to connect/i)).toBeInTheDocument();
  });

  it('collapsible starts closed and opens on click', () => {
    render(<AgentSetupStep {...defaultProps} agentSource="cursor" />);
    const trigger = screen.getByText(/other ways to connect/i);
    // Content should not be visible initially (Collapsible starts closed)
    // Click to open
    fireEvent.click(trigger);
    // After opening, alternative paths should be visible
  });
});
```

**Acceptance criteria:**
- Tests for all 4 `agentSource` values verify correct primary CTA rendering
- Tests for `null` source verify default path
- Tests for collapsible behavior (starts closed, opens on click)
- Tests for "Other ways to connect" label presence

---

## Phase 3: Integration + Copy Updates

### Task 9: [ftue-agent-integration-update] [P3] Modify setup-checklist to use AgentSetupStep and update copy

**File:** `apps/app/src/components/setup-checklist.tsx`
**Active form:** Modifying setup checklist to integrate agent setup step

**Changes:**

1. **Add new prop** `agentSource: AgentSource | null` to `SetupChecklistProps`:

```typescript
import type { AgentSource } from '@/hooks/use-agent-detection';

interface SetupChecklistProps {
  onComplete: () => void;
  issueCount: number;
  firstIssueId?: string;
  agentSource: AgentSource | null;  // NEW
}
```

2. **Replace Step 3** — swap `SetupCodeSnippet` with `AgentSetupStep`:

```typescript
// BEFORE:
<SetupStep number={3} title="Send your first issue" completed={copiedSteps[3] ?? false}>
  <SetupCodeSnippet
    apiUrl={apiUrl}
    apiKey={apiKey}
    onCopy={() => setCopiedSteps((prev) => ({ ...prev, [3]: true }))}
  />
</SetupStep>

// AFTER:
<SetupStep number={3} title="Connect your agent" completed={copiedSteps[3] ?? false}>
  <AgentSetupStep
    agentSource={agentSource}
    apiUrl={apiUrl}
    apiKey={apiKey}
    onCopy={() => setCopiedSteps((prev) => ({ ...prev, [3]: true }))}
  />
</SetupStep>
```

3. **Update Step 4 title and sub-text:**

```typescript
// BEFORE:
<SetupStep number={4} title="Listening for your first issue..." completed={false}>
  <div className="text-muted-foreground flex items-center gap-2 text-sm">
    <Loader2 className="size-4 animate-spin" />
    <span>Polling every 3 seconds...</span>
  </div>
</SetupStep>

// AFTER:
<SetupStep number={4} title="Waiting for your agent to send its first issue..." completed={false}>
  <div className="text-muted-foreground flex items-center gap-2 text-sm">
    <Loader2 className="size-4 animate-spin" />
    <span>{getWaitingSubtext(agentSource)}</span>
  </div>
</SetupStep>
```

**`getWaitingSubtext` helper:**

```typescript
function getWaitingSubtext(agentSource: AgentSource | null): string {
  switch (agentSource) {
    case 'loop-connect':
      return 'loop-connect configured your agent. Create an issue to verify.';
    case 'cursor':
      return 'Your Cursor MCP server is configured. Use Loop tools in a Cursor conversation.';
    case 'claude-code':
      return 'Your Claude Code MCP server is configured. Ask Claude to create an issue.';
    default:
      return 'Send a signal via the API or run `npx @dork-labs/loop-connect` to configure your agent.';
  }
}
```

4. **Update success state:**

```typescript
// BEFORE:
<h2 className="text-2xl font-bold">Loop is connected!</h2>
<p className="text-muted-foreground">
  Your first issue just arrived. The loop is ready to run.
</p>

// AFTER:
<h2 className="text-2xl font-bold">Your agent is connected to Loop.</h2>
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
<p className="text-muted-foreground mt-4 text-sm">
  Next: Install the{' '}
  <a
    href="https://www.looped.me/docs/agent-skill"
    target="_blank"
    rel="noopener noreferrer"
    className="text-primary hover:underline"
  >
    Loop Agent Skill
  </a>
  {' '}for autonomous dispatch
</p>
```

**Acceptance criteria:**
- `SetupChecklistProps` includes `agentSource: AgentSource | null`
- Step 3 renders `AgentSetupStep` instead of `SetupCodeSnippet`
- Step 3 title changes to "Connect your agent"
- Step 4 title changes to "Waiting for your agent to send its first issue..."
- Step 4 subtext is context-aware based on `agentSource`
- Success heading changes to "Your agent is connected to Loop."
- Success state includes Agent Skill guidance link to `/docs/agent-skill`
- Existing behavior (confetti, view issue button, polling) preserved

---

### Task 10: [ftue-agent-integration-update] [P3] Wire up agent detection in issues route

**File:** `apps/app/src/routes/_dashboard/issues/index.lazy.tsx`
**Active form:** Wiring up agent detection in issues route

**Changes:**

1. **Add imports:**

```typescript
import { useEffect } from 'react';  // add useEffect to existing import
import { useAgentDetection } from '@/hooks/use-agent-detection';
```

2. **Add detection and persistence logic** inside `IssueListPage()`:

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

3. **Compute effective agent source** for rendering:

```typescript
const agentSource = state.agentSource ?? detectedSource;
```

4. **Pass `agentSource` to `SetupChecklist`:**

```typescript
<SetupChecklist
  onComplete={markComplete}
  issueCount={issueCount}
  firstIssueId={firstIssueId}
  agentSource={agentSource}
/>
```

**Full modified component flow:**
- `useAgentDetection()` detects source once on mount from URL/localStorage/referrer
- `useOnboarding()` now returns `setAgentSource`
- `useEffect` persists the detected source into onboarding state (one-time write)
- `agentSource` prefers persisted value, falls back to fresh detection
- Passed to `SetupChecklist` as a prop

**Acceptance criteria:**
- `useAgentDetection()` is called in the component
- Detected source is persisted to onboarding state via `setAgentSource()`
- `useEffect` only writes if `detectedSource` is truthy and `state.agentSource` is null
- `agentSource` prop passed to `SetupChecklist` prefers persisted value
- Existing functionality (polling, error handling, empty state, filters) unchanged
- `useEffect` import added

---

### Task 11: [ftue-agent-integration-update] [P3] Update existing tests for modified components

**Files:**
- `apps/app/src/__tests__/components/setup-checklist.test.tsx` (MODIFY)

**Active form:** Updating existing tests for modified setup checklist

**Changes to `setup-checklist.test.tsx`:**

All existing `render(<SetupChecklist ...>)` calls need the new `agentSource` prop:

```typescript
// BEFORE:
render(<SetupChecklist onComplete={vi.fn()} issueCount={0} />);

// AFTER:
render(<SetupChecklist onComplete={vi.fn()} issueCount={0} agentSource={null} />);
```

**Update existing assertions:**

```typescript
// Step 3 title changed:
// BEFORE: expect(screen.getByText('Send your first issue')).toBeInTheDocument();
// AFTER:
expect(screen.getByText('Connect your agent')).toBeInTheDocument();

// Step 4 title changed:
// BEFORE: expect(screen.getByText('Listening for your first issue...')).toBeInTheDocument();
// AFTER:
expect(screen.getByText('Waiting for your agent to send its first issue...')).toBeInTheDocument();

// Success text changed:
// BEFORE: expect(screen.getByText('Loop is connected!')).toBeInTheDocument();
// AFTER:
expect(screen.getByText('Your agent is connected to Loop.')).toBeInTheDocument();
```

**Add new test cases:**

```typescript
it('renders AgentSetupStep for Step 3 when agentSource is provided', () => {
  render(<SetupChecklist onComplete={vi.fn()} issueCount={0} agentSource="cursor" />);
  expect(screen.getByText(/add to cursor/i)).toBeInTheDocument();
});

it('shows context-aware waiting copy for loop-connect source', () => {
  render(<SetupChecklist onComplete={vi.fn()} issueCount={0} agentSource="loop-connect" />);
  expect(screen.getByText(/loop-connect configured your agent/i)).toBeInTheDocument();
});

it('shows agent skill guidance link in success state', async () => {
  render(
    <SetupChecklist onComplete={vi.fn()} issueCount={1} firstIssueId="issue-1" agentSource={null} />
  );
  await waitFor(() => {
    expect(screen.getByText(/loop agent skill/i)).toBeInTheDocument();
  });
});
```

**Acceptance criteria:**
- All existing tests pass with `agentSource={null}` added to renders
- Assertions updated for new Step 3, Step 4, and success copy
- New tests verify agent-source-specific rendering
- New test for Agent Skill link in success state

---

## Phase 4: External + Verification

### Task 12: [ftue-agent-integration-update] [P4] Update connect CLI to append ?from=loop-connect to dashboard URL

**File:** `packages/loop-connect/src/index.ts`
**Active form:** Updating connect CLI dashboard URL with detection param

**Changes:**

In the `runInteractive` function (around line 353), update the outro URL:

```typescript
// BEFORE:
const outroUrl = project
  ? `Connected! Visit https://app.looped.me/projects/${project.id}`
  : 'Connected! Visit https://app.looped.me';

// AFTER:
const outroUrl = project
  ? `Connected! Visit https://app.looped.me/issues?from=loop-connect`
  : 'Connected! Visit https://app.looped.me/issues?from=loop-connect';
```

The URL now always points to `/issues` (the FTUE landing page) with the `?from=loop-connect` param for detection, regardless of whether a project was selected. This is intentional — the FTUE lives on the issues page, not the project detail page.

Also update the `runNonInteractive` function's output. At the end of `runNonInteractive` (around line 408), add or update the output message:

```typescript
console.log(`\nConnected! Visit https://app.looped.me/issues?from=loop-connect`);
```

**Acceptance criteria:**
- `runInteractive` outro URL is `https://app.looped.me/issues?from=loop-connect` (both branches)
- `runNonInteractive` output message includes `?from=loop-connect`
- URL always points to `/issues`, not `/projects/:id`
- No other changes to the connect CLI

---

### Task 13: [ftue-agent-integration-update] [P4] Run full test suite and verify all FTUE behavior

**Active form:** Running full test suite and verifying FTUE behavior

Run the full test suite across the monorepo and verify:

```bash
npm test
npm run typecheck
npm run lint
```

**Verification checklist:**
- All existing tests pass (no regressions)
- New unit tests for `use-agent-detection` pass
- New unit tests for `deeplink-builders` pass
- Extended `use-onboarding` tests pass
- New component tests for `agent-setup-step` pass
- Updated `setup-checklist` tests pass
- TypeScript compiles cleanly (`npm run typecheck`)
- ESLint passes (`npm run lint`)
- Manual verification: existing FTUE behavior preserved (welcome modal, confetti, polling)

**Acceptance criteria:**
- `npm test` exits with 0
- `npm run typecheck` exits with 0
- `npm run lint` exits with 0
- No regressions in existing functionality

---

## Dependency Graph

```
Phase 1 (parallel):
  Task 1: use-agent-detection.ts
  Task 2: use-onboarding.ts extension
  Task 3: deeplink-builders.ts
  Task 4: Phase 1 unit tests (depends on Tasks 1, 2, 3)

Phase 2 (depends on Phase 1):
  Task 5: agent-path-card.tsx
  Task 6: cursor-deeplink-button.tsx (depends on Task 3)
  Task 7: agent-setup-step.tsx (depends on Tasks 5, 6)
  Task 8: Phase 2 component tests (depends on Task 7)

Phase 3 (depends on Phase 2):
  Task 9: setup-checklist.tsx modifications (depends on Task 7)
  Task 10: issues/index.lazy.tsx wiring (depends on Tasks 1, 2, 9)
  Task 11: Update existing tests (depends on Task 9)

Phase 4 (depends on Phase 3):
  Task 12: loop-connect URL update (independent, but sequenced for safety)
  Task 13: Full test suite (depends on all above)
```

## Parallel Execution Opportunities

- **Phase 1:** Tasks 1, 2, 3 can run in parallel. Task 4 depends on all three.
- **Phase 2:** Tasks 5 and 6 can run in parallel. Task 7 depends on both. Task 8 depends on Task 7.
- **Phase 3:** Tasks 9, 10, 11 are mostly sequential (10 depends on 9 for the new prop).
- **Phase 4:** Task 12 is independent of frontend tasks and could theoretically run earlier, but is sequenced here for clean verification. Task 13 depends on everything.

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| P1 | 1-4 | Core detection hook, onboarding state extension, deeplink builders, unit tests |
| P2 | 5-8 | AgentPathCard, CursorDeeplinkButton, AgentSetupStep, component tests |
| P3 | 9-11 | SetupChecklist integration, issues route wiring, test updates |
| P4 | 12-13 | Connect CLI URL update, full test suite verification |
| **Total** | **13 tasks** | |
