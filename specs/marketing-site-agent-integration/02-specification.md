---
slug: marketing-site-agent-integration
number: 16
created: 2026-02-23
status: specification
---

# Marketing Site — Agent Integration Showcase

**Status:** Draft
**Authors:** Claude Code, 2026-02-23
**Spec Number:** 16
**Related:** [Agent Integration Strategy](../agent-integration-strategy.md) (Task 8), [Ideation](./01-ideation.md)

---

## Overview

Update the Loop marketing site (looped.me) to showcase agent integration capabilities built in Features 1-6 of the Agent Integration Strategy. This adds a standalone `/integrations` page with agent setup guides and deeplink buttons, updates the homepage with an agent-ready value prop section, serves `llms.txt` for AI agent discovery, and introduces reusable marketing components for tabbed code snippets and deeplink generation.

## Background / Problem Statement

Loop has shipped MCP server support, agent discovery artifacts, a TypeScript SDK, a CLI, and a connect CLI — but none of these capabilities are visible on the marketing site. The current homepage only shows signal integrations (PostHog, GitHub, Sentry) and outdated CLI commands. Developers visiting looped.me have no way to discover that Loop works with their AI coding agent, no one-click setup path, and no code examples showing SDK/CLI usage alongside curl.

## Goals

- Make Loop's agent compatibility immediately visible from the homepage
- Provide one-click (deeplink) or one-command setup for Cursor, VS Code, and Claude Code
- Showcase `npx add-mcp` as the universal setup path for all MCP-capable agents
- Serve `llms.txt` at the marketing domain for AI agent discovery
- Demonstrate Loop's API via tabbed code examples (curl / SDK / CLI)
- Follow existing design system conventions (warm cream palette, Motion.js, IBM Plex fonts)

## Non-Goals

- Documentation content (Feature 7 — separate spec)
- Building integration surfaces themselves (Features 1-6 — already shipped)
- FTUE onboarding changes (Feature 9 — separate spec)
- Pricing page, blog posts, or changelog
- Claude Desktop `.mcpb` bundle creation (no documented toolchain)
- Agent user-agent detection for pre-selecting tabs
- Vercel Marketplace integration
- Dark mode for marketing site
- Interactive terminal demos or animated typing effects

## Technical Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `next` | 16.1.5 | Framework (already installed) |
| `react` | 19.2.4 | UI (already installed) |
| `motion` | 12.23.26 | Scroll-triggered animations (already installed) |
| `lucide-react` | 0.556.0 | Icons (already installed) |
| `@base-ui/react` | 1.0.0 | Headless tabs primitive (already installed) |
| `shiki` | 3.22.0 | Syntax highlighting (already installed) |
| `tailwindcss` | 4.1.18 | Styling (already installed) |

No new dependencies are required. All needed libraries are already in the `apps/web` package.

## Detailed Design

### Architecture

All changes are within the `apps/web/` app. No API, database, or backend changes. All content is static — no server-side data fetching.

```
apps/web/
├── public/
│   └── llms.txt                          # NEW: Static llms.txt file
├── src/
│   ├── app/(marketing)/
│   │   ├── page.tsx                      # MODIFY: Add AgentPlatforms section + nav link
│   │   └── integrations/
│   │       └── page.tsx                  # NEW: Integrations page route
│   ├── config/
│   │   └── site.ts                       # MODIFY: Update description
│   └── layers/features/marketing/
│       ├── index.ts                      # MODIFY: Export new components
│       ├── lib/
│       │   └── agents.ts                 # NEW: Agent data (names, logos, config)
│       └── ui/
│           ├── AgentGrid.tsx             # NEW: Agent logo bento grid
│           ├── AgentPlatforms.tsx         # NEW: Homepage agent strip section
│           ├── AgentSetupSection.tsx      # NEW: Per-agent setup instructions
│           ├── CodeTabs.tsx              # NEW: Tabbed code snippets
│           └── DeeplinkButton.tsx        # NEW: Deeplink URL generator
```

### Component Design

#### 1. `agents.ts` — Agent Data Module

Centralized data for all supported agents. Avoids duplicating agent info across components.

```typescript
export interface AgentPlatform {
  id: string;
  name: string;
  // SVG component rendered inline (same pattern as IntegrationsBar.tsx)
  Logo: React.FC<{ className?: string }>;
  // Setup method
  setup:
    | { type: 'deeplink'; protocol: 'cursor' | 'vscode'; config: Record<string, unknown> }
    | { type: 'cli'; command: string }
    | { type: 'config'; filename: string; content: string };
  // Anchor id for scroll-to
  anchor: string;
}

export const AGENTS: AgentPlatform[] = [
  // Cursor, VS Code, Claude Code, Windsurf, Codex CLI, OpenHands, Goose, Gemini CLI
];

export const MCP_SERVER_CONFIG = {
  name: 'loop',
  url: 'https://mcp.looped.me/mcp',
};
```

#### 2. `AgentGrid.tsx` — Agent Logo Bento Grid

Responsive grid of agent logos for the integrations page hero.

- **Layout:** 4 columns on desktop, 3 on tablet, 2 on mobile
- **Logo style:** Monochrome warm-gray (#7A756A) SVGs. On hover, transition to brand color (same pattern as `IntegrationsBar.tsx`)
- **Interaction:** Each logo is an anchor link (`<a href="#cursor">`) that smooth-scrolls to the per-agent setup section
- **Animation:** `motion.div` container with `STAGGER` variant, each child with `REVEAL` variant, triggered by `whileInView` + `VIEWPORT`
- **Props:** `agents: AgentPlatform[]`

#### 3. `AgentPlatforms.tsx` — Homepage Agent Strip

A horizontal strip of agent logos for the homepage (lighter treatment than the full grid).

- **Layout:** Horizontal row with flex-wrap, centered
- **Content:** 4-6 primary agent logos + "Works with every AI coding agent" text + CTA button linking to `/integrations`
- **Background:** `bg-cream-secondary` (matches existing section backgrounds)
- **Animation:** `STAGGER` + `REVEAL` on scroll
- **Props:** None (uses `AGENTS` data directly)

#### 4. `AgentSetupSection.tsx` — Per-Agent Setup Instructions

Anchor-linked section for each agent with setup instructions.

- **Structure:** Section with `id={agent.anchor}` for anchor linking
- **Content per agent:**
  - Agent name + logo (large)
  - Primary setup method: DeeplinkButton (if deeplink available) or CLI command with copy-to-clipboard
  - Fallback: JSON config snippet in a code block with copy button
- **Copy-to-clipboard:** Button that copies command/config text, shows "Copied!" feedback for 2 seconds using `useState` + `setTimeout`
- **Animation:** `REVEAL` on scroll
- **Props:** `agent: AgentPlatform`

#### 5. `CodeTabs.tsx` — Tabbed Code Snippets

Client component showing code examples in multiple formats.

```typescript
'use client';

interface CodeTab {
  label: string;       // "curl" | "TypeScript SDK" | "CLI"
  language: string;    // Shiki language identifier
  code: string;        // Raw code string
}

interface CodeTabsProps {
  tabs: CodeTab[];
  groupId?: string;    // localStorage key for persisting selection
}
```

- **Tab UI:** Uses `@base-ui/react/tabs` (already wrapped in `apps/web/src/components/ui/tabs.tsx`)
- **Syntax highlighting:** Pre-render code with Shiki at build time via a server component wrapper, or use `shiki/bundle/web` for client-side highlighting. Since this is a marketing page (not MDX), use `shiki` directly with `codeToHtml()`.
- **Persistence:** Save active tab index to `localStorage` under `groupId` key. Restore on mount. Default to first tab if no stored preference.
- **Copy button:** Per-tab copy-to-clipboard button in the code block header
- **Styling:** Dark code block background (`#1a1814`, matching `QuickStartSection.tsx`), cream text, warm-gray line numbers

**Shiki Integration Approach:**

Since this is a client component (`'use client'`), use `shiki/bundle/web` for lightweight client-side highlighting:

```typescript
import { codeToHtml } from 'shiki/bundle/web';

// Highlight on mount/tab change
useEffect(() => {
  codeToHtml(activeTab.code, {
    lang: activeTab.language,
    theme: 'github-dark',
  }).then(setHighlightedHtml);
}, [activeTab]);
```

This avoids SSR complexity while keeping bundle size minimal (Shiki's web bundle only loads grammars on demand).

#### 6. `DeeplinkButton.tsx` — Deeplink URL Generator

Generates protocol-specific deeplink URLs and renders styled buttons.

```typescript
interface DeeplinkButtonProps {
  agent: 'cursor' | 'vscode';
  serverName: string;
  serverUrl: string;
}
```

**URL generation:**

- **Cursor:** `cursor://anysphere.cursor-deeplink/mcp/install?name=${serverName}&config=${btoa(JSON.stringify({ url: serverUrl }))}`
- **VS Code:** `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: serverName, url: serverUrl }))}`

**Rendering:**

- Styled as a prominent CTA button using `marketing-btn` utility class
- Agent brand icon (from `lucide-react` or inline SVG)
- Text: "Add to Cursor" / "Add to VS Code"
- Rendered as `<a href={deeplinkUrl}>` (opens the native app)
- Fallback text below: "Or configure manually:" with JSON snippet

### Page Composition

#### `/integrations` Page

```
IntegrationsPage
├── <section> Hero
│   ├── <h1> "Works with every AI coding agent"
│   ├── <p> Subtext about MCP server and universal compatibility
│   └── Universal CTA: `npx add-mcp https://mcp.looped.me/mcp` (copy-to-clipboard)
├── <AgentGrid agents={AGENTS} />
├── {AGENTS.map(agent => <AgentSetupSection agent={agent} />)}
└── <section> Code Examples
    └── <CodeTabs tabs={[curl, sdk, cli]} groupId="integrations-code" />
```

**Metadata:**

```typescript
export const metadata: Metadata = {
  title: 'Integrations — Loop',
  description: 'Connect Loop to Claude Code, Cursor, VS Code, and any MCP-capable AI coding agent.',
};
```

#### Homepage Updates

Add `<AgentPlatforms />` between `<HowItWorksFlow />` and `<QuickStartSection />` in the homepage composition. Add `{ label: 'Integrations', href: '#integrations' }` to the `navLinks` array (or link to `/integrations` if preferred as a separate page).

### Static `llms.txt` File

Place at `apps/web/public/llms.txt`. Content sourced from `packages/loop-skill/references/api.md` and agent discovery artifacts:

```
# Loop

> The Autonomous Improvement Engine — collects signals, organizes work, and tells AI agents what to do next.

## Overview

Loop is an open-source data layer and prompt engine for AI-powered development. It turns raw signals (errors, metrics, user feedback) into prioritized, actionable work items with fully prepared agent instructions.

## API

Base URL: https://app.looped.me
Auth: Bearer token via LOOP_API_KEY header

## Key Endpoints

- GET /api/dispatch/next — Get highest-priority unblocked issue with instructions
- POST /api/issues — Create an issue
- PATCH /api/issues/:id — Update an issue
- POST /api/signals — Ingest a signal
- POST /api/issues/:id/comments — Add a comment

## MCP Server

Install: npx add-mcp https://mcp.looped.me/mcp
Package: @dork-labs/loop-mcp

## Documentation

- [Getting Started](https://www.looped.me/docs/getting-started)
- [API Reference](https://www.looped.me/docs/api)
- [CLI Reference](https://www.looped.me/docs/cli)
- [MCP Server](https://www.looped.me/docs/integrations)

## SDK

Package: @dork-labs/loop-sdk
```

### Site Config Update

Update `apps/web/src/config/site.ts` description:

```typescript
description: 'Loop collects signals, organizes work into issues, and tells AI agents exactly what to do next. Works with Claude Code, Cursor, VS Code, and any MCP-capable agent.',
```

## User Experience

### Developer Journey

1. Developer lands on looped.me homepage
2. Sees "Works with every AI coding agent" section with familiar agent logos
3. Clicks "View all integrations" CTA → arrives at `/integrations`
4. Sees their agent (e.g., Cursor) in the grid, clicks it
5. Scrolls to Cursor section, clicks "Add to Cursor" deeplink button
6. Cursor opens with Loop MCP server pre-configured
7. Developer can also browse tabbed code examples at the bottom

### Universal Fallback

Developers whose agent isn't listed can use the universal CTA:

```bash
npx add-mcp https://mcp.looped.me/mcp
```

This detects all installed MCP-capable agents and configures them automatically.

## Testing Strategy

Marketing pages are static content with no business logic. The testing approach is:

### Manual Testing

- Verify all deeplink URLs open the correct application (Cursor, VS Code)
- Verify copy-to-clipboard works on all code blocks
- Verify anchor scroll from agent grid to setup sections
- Verify responsive layout at mobile (375px), tablet (768px), desktop (1280px)
- Verify `prefers-reduced-motion` disables animations
- Verify `llms.txt` is accessible at `/llms.txt`
- Verify tab persistence across page navigation (localStorage)

### Build Verification

- `npm run build` succeeds with no TypeScript errors in new files
- `npm run typecheck` passes
- `npm run lint` passes

### Visual Verification

- New sections match existing warm cream design system
- Agent logos render correctly in monochrome and hover states
- Code blocks use consistent dark theme matching QuickStartSection
- Deeplink buttons are visually prominent as CTAs

No unit or integration tests are required for static marketing components. This matches the existing pattern — no test files exist for any current marketing components.

## Performance Considerations

- **LCP:** No impact — hero section is above the fold and doesn't change. New sections are below the fold and lazy-loaded via `whileInView`.
- **Bundle size:** Shiki web bundle loads grammars on demand (~20-50KB per language). Only loaded when `CodeTabs` is visible. Consider using `next/dynamic` with `ssr: false` for the `CodeTabs` component to avoid SSR cost.
- **Images:** Agent logos are inline SVGs (same as `IntegrationsBar.tsx`), so no image loading overhead.
- **Static `llms.txt`:** Served from `public/` directory by CDN. Zero server cost, maximum cache efficiency.
- **CLS:** Code blocks render with fixed height to prevent layout shift (same pattern as `QuickStartSection.tsx` which uses `min-h` to prevent CLS).

## Security Considerations

- **Deeplink URLs:** Generated client-side from static config. No user input is included in deeplink URLs, eliminating injection risk.
- **Copy-to-clipboard:** Uses `navigator.clipboard.writeText()` which requires user gesture (click) and Secure Context (HTTPS). No security concerns.
- **`llms.txt`:** Contains only public information (API endpoints, documentation links). No secrets, keys, or internal URLs.
- **No server-side routes:** All content is static. No API calls from the marketing site. No user data collection beyond existing PostHog analytics.

## Documentation

No documentation changes in this spec. Documentation updates are handled by the separate "Documentation Update" spec (Task 7 in the Agent Integration Strategy).

The `/integrations` page itself serves as discoverable documentation for agent setup.

## Implementation Phases

### Phase 1: Core Infrastructure

- Create `agents.ts` data module with agent definitions and MCP config
- Create `CodeTabs.tsx` client component with Shiki highlighting and tab persistence
- Create `DeeplinkButton.tsx` with Cursor and VS Code URL generation
- Place `llms.txt` in `public/` directory

### Phase 2: Integrations Page

- Create `/integrations` page route with metadata
- Create `AgentGrid.tsx` with logo grid and anchor links
- Create `AgentSetupSection.tsx` with per-agent setup instructions
- Compose the full integrations page with hero, grid, setup sections, and code examples

### Phase 3: Homepage & Polish

- Create `AgentPlatforms.tsx` homepage section
- Add `AgentPlatforms` to homepage composition between existing sections
- Update `IntegrationsBar.tsx` section label to clarify "Signal Integrations"
- Add "Integrations" nav link to homepage
- Update barrel exports in `index.ts`
- Update `site.ts` description
- Responsive testing and animation polish

## Open Questions

None. All decisions were resolved during ideation:
- Standalone `/integrations` page (not embedded in homepage)
- Solution 2 (Standard) from ideation — deeplinks for Cursor + VS Code, CLI for Claude Code
- `llms.txt` served from `public/` (static, CDN-cached)

## Related ADRs

- [ADR 0023: Use `loop_` Prefix for API Keys](../../decisions/0023-use-loop-prefix-for-api-keys.md) — API key format shown in setup instructions
- [ADR 0031: Hand-Written SDK Over Generation](../../decisions/0031-hand-written-sdk-over-generation.md) — SDK code examples reference hand-written SDK
- [ADR 0033: Use ky for SDK HTTP Layer](../../decisions/0033-use-ky-for-sdk-http-layer.md) — SDK examples use ky-based client

## References

- [Ideation Document](./01-ideation.md) — Full ideation with research and codebase map
- [Agent Integration Strategy](../agent-integration-strategy.md) — Parent strategy document (Task 8)
- [Research: Marketing Site Agent Integration](../../research/20260223_marketing_site_agent_integration.md) — Deeplink protocols, integration page patterns
- [Research: Developer Onboarding](../../research/20260222_loop_developer_onboarding.md) — Vibe coder personas, `npx init` patterns
- [Cursor Deeplink Docs](https://docs.cursor.com/tools/deeplinks) — `cursor://` protocol specification
- [VS Code MCP Install](https://code.visualstudio.com/docs/copilot/chat/mcp-servers) — `vscode:mcp/install` protocol
- [npx add-mcp](https://github.com/nichochar/add-mcp) — Universal MCP installer by Neon
- [llmstxt.org](https://llmstxt.org) — llms.txt specification
