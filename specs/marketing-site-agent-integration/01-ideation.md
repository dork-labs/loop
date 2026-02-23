---
slug: marketing-site-agent-integration
number: 16
created: 2026-02-23
status: ideation
---

# Marketing Site — Agent Integration Showcase

**Slug:** marketing-site-agent-integration
**Author:** Claude Code
**Date:** 2026-02-23
**Branch:** preflight/marketing-site-agent-integration
**Related:** [Agent Integration Strategy](../../specs/agent-integration-strategy.md) (Task 8)

---

## 1) Intent & Assumptions

- **Task brief:** Update the Loop marketing site (looped.me) to showcase agent integration capabilities built in Features 1-6. Add a new `/integrations` page with agent grid and deeplink buttons, update the homepage with agent value props, implement deeplink buttons for Cursor and VS Code, serve `llms.txt`, add tabbed code snippets, and include a "Compatible with" logo grid.
- **Assumptions:**
  - Features 1-6 are complete (API Key DX, MCP Server, Agent Discovery Layer, TypeScript SDK, Connect CLI, Loop CLI)
  - The MCP server is deployed at `mcp.looped.me/mcp` (or equivalent endpoint)
  - The `llms.txt` content exists from Feature 3 (Agent Discovery Layer)
  - The `@dork-labs/loop-sdk` and `@dork-labs/loop-mcp` npm packages are published
  - The existing marketing site design system (warm cream palette, IBM Plex fonts, Motion.js animations) is maintained
  - Dark mode is not required for the marketing site (current site is light/cream only)
- **Out of scope:**
  - Documentation content (Feature 7 — separate task)
  - Building integration surfaces (Features 1-6)
  - FTUE changes (Feature 9 — separate task)
  - Pricing page, blog posts
  - Claude Desktop `.mcpb` bundle creation (no documented third-party toolchain)
  - Agent user-agent detection for pre-selecting tabs (nice-to-have for future)
  - Vercel Marketplace integration

## 2) Pre-reading Log

- `apps/web/src/app/(marketing)/page.tsx`: Homepage composition — imports LoopHero, IntegrationsBar, HowItWorksFlow, LoopValueProps, QuickStartSection, ContactSection
- `apps/web/src/layers/features/marketing/ui/IntegrationsBar.tsx`: Current integration logos — PostHog, GitHub, Sentry as inline SVGs in warm-gray monochrome
- `apps/web/src/layers/features/marketing/ui/LoopHero.tsx`: Split-panel hero with FeedbackLoopDiagram; LCP-optimized
- `apps/web/src/layers/features/marketing/ui/QuickStartSection.tsx`: Terminal-style code block with static CLI commands
- `apps/web/src/layers/features/marketing/ui/LoopValueProps.tsx`: 4-pillar value prop cards (Data/Prompt/Dashboard/CLI)
- `apps/web/src/layers/features/marketing/ui/HowItWorksFlow.tsx`: 4-step horizontal flow (Signal → Issue → Prompt → Dispatch)
- `apps/web/src/layers/features/marketing/lib/motion-variants.ts`: Reusable animation variants (REVEAL, STAGGER, SCALE_IN, DRAW_PATH, VIEWPORT)
- `apps/web/src/layers/features/marketing/index.ts`: Barrel export for all marketing components
- `apps/web/src/config/site.ts`: Site-wide config (name, description, URLs, contactEmail, github)
- `apps/web/src/app/globals.css`: Design tokens (cream palette, charcoal, warm-gray, brand-orange), marketing-btn utility, section-label utility
- `specs/mvp-homepage-update/02-specification.md`: Detailed MVP homepage rewrite spec (comprehensive design + components)
- `specs/agent-discovery-layer/02-specification.md`: Agent discovery artifacts (llms.txt, SKILL.md, AGENTS.md, Cursor rules, OpenHands)
- `packages/loop-skill/SKILL.md`: Existing agent skill file (agentskills.io format)
- `packages/mcp/.mcp.json.example`: MCP server config example
- `research/20260222_loop_developer_onboarding.md`: Vibe coder personas, Convex/Clerk patterns, `npx init` patterns
- `research/20260223_marketing_site_agent_integration.md`: Deeplink protocols, integration page patterns, tabbed code snippets

## 3) Codebase Map

- **Primary components/modules:**
  - `apps/web/src/app/(marketing)/page.tsx` — Homepage composition (to modify)
  - `apps/web/src/layers/features/marketing/ui/IntegrationsBar.tsx` — Current signal integration logos (to update or replace)
  - `apps/web/src/layers/features/marketing/ui/QuickStartSection.tsx` — Terminal code block (to extend with tabs)
  - `apps/web/src/layers/features/marketing/ui/LoopValueProps.tsx` — Value prop cards (to update messaging)
  - `apps/web/src/layers/features/marketing/index.ts` — Barrel exports (to add new components)
  - `apps/web/src/config/site.ts` — Site config (to update description)

- **Shared dependencies:**
  - `apps/web/src/layers/features/marketing/lib/motion-variants.ts` — Animation system (REVEAL, STAGGER, VIEWPORT)
  - `apps/web/src/app/globals.css` — Design tokens and utility classes
  - `apps/web/src/components/ui/` — 40+ shadcn/ui primitives (Tabs, Card, Badge, Button available)
  - `motion/react` v12.x — GPU-accelerated animations
  - `lucide-react` — Icon library

- **Data flow:**
  - Static content → React components → Motion.js entrance animations → Client render
  - No server data fetching needed — all content is static/hardcoded
  - Deeplink URLs are computed client-side (base64/URL encoding)

- **Feature flags/config:**
  - `siteConfig` in `apps/web/src/config/site.ts` — site-wide metadata
  - No feature flags system on the marketing site

- **Potential blast radius:**
  - **Direct:** 3-4 existing files modified (homepage, IntegrationsBar, QuickStartSection, barrel exports)
  - **New files:** 4-6 new components + 1 new page route + 1 llms.txt file
  - **Indirect:** Marketing layout and nav links need updating for /integrations route
  - **Tests:** No test files exist for marketing components (none needed — static content)

## 4) Root Cause Analysis

N/A — not a bug fix.

## 5) Research

### Potential Solutions

**1. Minimal — Static page, no deeplinks (1-2 days)**
- Single `/integrations` page with static agent logo grid
- Copy-to-clipboard code blocks per agent (no deeplink buttons)
- `npx add-mcp` universal command prominently featured
- `llms.txt` served from `public/llms.txt`
- No homepage changes
- Pros: Fast to ship, low maintenance
- Cons: Missing deeplink buttons misses conversion opportunity; no per-agent CTAs; homepage doesn't reflect new capabilities
- Complexity: Low
- Maintenance: Low

**2. Standard — Deeplinks + homepage updates (3-5 days) ← RECOMMENDED**
- Standalone `/integrations` page with:
  - Hero: "Works with every AI coding agent"
  - Compatible agents bento grid (8-12 agents with logos)
  - Universal quick-start: `npx add-mcp https://mcp.looped.me/mcp`
  - "Add to Cursor" deeplink button (`cursor://` protocol)
  - "Add to VS Code" deeplink button (`vscode:mcp/install` protocol)
  - Claude Code copy-paste CLI command
  - Per-agent anchor-linked setup sections
  - Tabbed code snippets (curl / SDK / CLI) using custom `<CodeTabs>` component
- Homepage: agent logo strip in hero section + "AI-Agent Ready" value prop
- `llms.txt` in `public/` directory
- Pros: Covers the two deeplink-capable agents; solid developer UX; homepage reflects new capabilities
- Cons: Claude Code has no deeplink (CLI command is fine for that audience)
- Complexity: Medium
- Maintenance: Medium

**3. Comprehensive — Full ecosystem (1 week)**
- Everything in Solution 2, plus:
  - Per-agent expandable sections for 12+ agents (Windsurf, Codex, OpenHands, Gemini CLI, Goose, etc.)
  - Interactive `loop next` terminal demo on homepage
  - Agent count badge ("Works with 12+ AI coding agents")
  - `.mcpb` bundle for Claude Desktop one-click install
  - Dynamic `llms.txt` via route handler
- Pros: Maximum conversion surface, covers all major agents
- Cons: Highest effort; `.mcpb` toolchain not fully documented; diminishing returns for niche agents
- Complexity: High
- Maintenance: High

### Deeplink Protocol Details (from research)

| Agent | Protocol | Format |
|---|---|---|
| Cursor | `cursor://` | `cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=BASE64_JSON` |
| VS Code | `vscode:` | `vscode:mcp/install?URL_ENCODED_JSON` |
| Claude Code | CLI only | `claude mcp add --transport http loop https://mcp.looped.me/mcp` |
| Windsurf | Manual JSON | Edit `~/.codeium/windsurf/mcp_config.json` |
| Codex CLI | CLI only | `codex mcp add loop --url https://mcp.looped.me/mcp` |
| OpenHands | N/A | No MCP deeplink support |

### Recommendation

**Ship Solution 2 (Standard).** The Cursor and VS Code deeplinks cover the two most popular developer agents. Claude Code users are comfortable with CLI commands. The `npx add-mcp` universal option acts as a catch-all for everyone else. The homepage updates ensure the new capabilities are visible from the landing page without overwhelming it.

### Key Implementation Patterns

**Integrations page structure** (follows Vercel MCP docs pattern):
1. Hero section with headline + agent logo grid
2. Universal quick-start (`npx add-mcp`) as primary CTA
3. Per-agent sections with anchor links from logo grid
4. Deeplink buttons for Cursor and VS Code, copy-to-clipboard for others
5. Tabbed code examples (curl / SDK / CLI) at bottom

**Tabbed code snippets** — custom React `<CodeTabs>` component (not Fumadocs MDX tabs, since marketing pages aren't MDX):
- `useState` for active tab
- Shiki for server-rendered syntax highlighting (already a dependency)
- `groupId` pattern with localStorage persistence

**llms.txt** — serve from `apps/web/public/llms.txt` (static, CDN-cached, zero code). Content sourced from Feature 3's agent discovery layer artifacts.

**Logo grid** — static bento grid with monochrome SVG logos + name labels. On hover, show brand color. Click scrolls to per-agent section anchor. Pattern matches existing `IntegrationsBar.tsx` logo component structure.

## 6) Clarifications & Decisions

- **Decision 1:** Integrations page lives at `/integrations` as a standalone marketing page. Homepage gets a lighter "Works with" logo strip linking to `/integrations`. Follows the Vercel MCP pattern.
- **Open questions:** None.

---

## New Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/app/(marketing)/integrations/page.tsx` | New integrations page route |
| `apps/web/src/layers/features/marketing/ui/AgentGrid.tsx` | Agent logo bento grid with hover states |
| `apps/web/src/layers/features/marketing/ui/AgentSetupSection.tsx` | Per-agent setup instructions with deeplink/CLI |
| `apps/web/src/layers/features/marketing/ui/CodeTabs.tsx` | Tabbed code snippet component (curl/SDK/CLI) |
| `apps/web/src/layers/features/marketing/ui/DeeplinkButton.tsx` | Deeplink button component (generates cursor:// and vscode: URIs) |
| `apps/web/public/llms.txt` | Static llms.txt file for AI agent discovery |

## Existing Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/(marketing)/page.tsx` | Add agent logo strip to hero area; link to /integrations |
| `apps/web/src/layers/features/marketing/ui/IntegrationsBar.tsx` | Rename to "Signal Integrations" or add agent platforms alongside existing logos |
| `apps/web/src/layers/features/marketing/index.ts` | Export new components |
| `apps/web/src/config/site.ts` | Update description to mention agent integration |
