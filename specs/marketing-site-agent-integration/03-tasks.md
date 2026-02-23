---
slug: marketing-site-agent-integration
number: 16
created: 2026-02-23
status: tasks
---

# Marketing Site -- Agent Integration Showcase: Implementation Tasks

**Spec:** specs/marketing-site-agent-integration/02-specification.md
**Total Tasks:** 11
**Phases:** 3

---

## Phase 1: Core Infrastructure

### Task 1.1: Create `agents.ts` data module

**File:** `apps/web/src/layers/features/marketing/lib/agents.ts`

Create the centralized agent data module with all supported agent definitions and MCP config. This is the single source of truth for agent names, logos, setup methods, and anchor IDs used across all new components.

**Implementation:**

Define an `AgentPlatform` interface:
- `id: string` -- unique identifier
- `name: string` -- display name
- `Logo: FC<{ className?: string }>` -- SVG component rendered inline (same pattern as IntegrationsBar.tsx)
- `setup` -- discriminated union:
  - `{ type: 'deeplink'; protocol: 'cursor' | 'vscode'; config: Record<string, unknown> }`
  - `{ type: 'cli'; command: string }`
  - `{ type: 'config'; filename: string; content: string }`
- `anchor: string` -- anchor id for scroll-to

Define `MCP_SERVER_CONFIG` as a const:
- `name: 'loop'`
- `url: 'https://mcp.looped.me/mcp'`

Define `AGENTS: AgentPlatform[]` with 8 entries:
1. **Cursor** -- deeplink protocol `cursor`, anchor: `cursor`
2. **VS Code** -- deeplink protocol `vscode`, anchor: `vscode`
3. **Claude Code** -- cli type, command: `claude mcp add --transport http loop https://mcp.looped.me/mcp`, anchor: `claude-code`
4. **Windsurf** -- config type, filename: `.mcp.json`, anchor: `windsurf`
5. **Codex CLI** -- config type, filename: `.mcp.json`, anchor: `codex-cli`
6. **OpenHands** -- config type, filename: `.mcp.json`, anchor: `openhands`
7. **Goose** -- config type, filename: `.mcp.json`, anchor: `goose`
8. **Gemini CLI** -- config type, filename: `.mcp.json`, anchor: `gemini-cli`

Each Logo component should follow the exact pattern from IntegrationsBar.tsx:
- `width="40" height="40"` viewBox
- `fill="#7A756A"` or stroke-based monochrome warm-gray
- `aria-label={name}` and `role="img"` attributes

For deeplink agents, the config is the MCP server config JSON. For config-type agents, the `content` field is the stringified MCP server JSON config.

**Acceptance criteria:**
- File exports `AgentPlatform` type, `AGENTS` array, and `MCP_SERVER_CONFIG`
- All 8 agents defined with correct setup types
- All Logo components render valid SVG with consistent sizing
- `npm run typecheck` passes
- `npm run lint` passes

---

### Task 1.2: Create `CodeTabs.tsx` client component

**File:** `apps/web/src/layers/features/marketing/ui/CodeTabs.tsx`

Create a tabbed code snippet component with Shiki syntax highlighting and localStorage tab persistence. Uses `'use client'` directive.

**Interface:**
- `CodeTab`: `{ label: string; language: string; code: string }`
- `CodeTabsProps`: `{ tabs: CodeTab[]; groupId?: string }`

**Tab UI:** Use `@base-ui/react/tabs` via the project's existing `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`. Override styling for marketing design:
- Tab list: `bg-charcoal/80` background, no border
- Tab triggers: `text-warm-gray-light` default, `text-cream-primary` active, `font-mono text-xs tracking-[0.1em] uppercase`
- Active indicator: `border-b-2 border-brand-orange`

**Syntax highlighting:** Use `shiki/bundle/web` client-side with `codeToHtml()`. Call in a `useEffect` on tab change, render the resulting HTML string.

**Persistence:** On mount, read `localStorage.getItem(groupId)` to restore saved tab index. On tab change, write to localStorage. Default to index 0.

**Copy button:** Top-right of code block, `Copy` icon from lucide-react. On click, `navigator.clipboard.writeText(tabs[activeIndex].code)`. Show `Check` icon for 2 seconds.

**Styling:**
- Outer container: `rounded-lg overflow-hidden`
- Code block: `bg-[#1a1814]` (matching QuickStartSection charcoal), `p-6 overflow-x-auto min-h-[200px]`
- Code text: `text-cream-primary font-mono text-sm`

**Acceptance criteria:**
- Tabs switch between code examples with syntax highlighting
- Active tab persists to localStorage when groupId is provided
- Copy button copies raw code text, shows feedback
- Dark code block matches QuickStartSection styling
- `npm run typecheck` passes

---

### Task 1.3: Create `DeeplinkButton.tsx` component

**File:** `apps/web/src/layers/features/marketing/ui/DeeplinkButton.tsx`

Create a deeplink URL generator button for Cursor and VS Code MCP server installation.

**Props:** `{ agent: 'cursor' | 'vscode'; serverName: string; serverUrl: string }`

**URL generation:**
- Cursor: `cursor://anysphere.cursor-deeplink/mcp/install?name=${serverName}&config=${btoa(JSON.stringify({ url: serverUrl }))}`
- VS Code: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name: serverName, url: serverUrl }))}`

**Rendering:**
- `<a href={deeplinkUrl}>` element (opens native app)
- Styled as prominent CTA: `inline-flex items-center gap-2 rounded-full px-6 py-3 bg-brand-orange text-cream-primary hover:bg-brand-green font-mono text-sm tracking-[0.05em] transition-smooth`
- Display text: "Add to Cursor" / "Add to VS Code"
- Include agent icon to left of text
- Mark as `'use client'`

**Acceptance criteria:**
- Cursor deeplink URL matches `cursor://` protocol spec
- VS Code deeplink URL matches `vscode:mcp/install?` protocol spec
- Rendered as `<a>` tag with deeplink href
- Styled as prominent CTA
- `npm run typecheck` passes

---

### Task 1.4: Create `llms.txt` static file

**File:** `apps/web/public/llms.txt`

Place the static llms.txt file for AI agent discovery at `https://www.looped.me/llms.txt`.

**Content:** The exact content specified in the spec -- includes Loop overview, API base URL, key endpoints, MCP server info, documentation links, and SDK package name. See spec section "Static llms.txt File" for verbatim content.

**Acceptance criteria:**
- File exists at `apps/web/public/llms.txt`
- Accessible at `/llms.txt` after build
- No build errors

---

## Phase 2: Integrations Page

### Task 2.1: Create `AgentGrid.tsx` component

**File:** `apps/web/src/layers/features/marketing/ui/AgentGrid.tsx`

Responsive grid of agent logos for the integrations page. Each logo anchors to the setup section.

**Props:** `{ agents: AgentPlatform[] }`

**Layout:** CSS Grid `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8`, centered in `max-w-3xl mx-auto`.

**Each item:**
- `<a href={#${agent.anchor}}>` for smooth-scroll
- Logo component + name span below
- Name style: `text-2xs text-warm-gray-light font-mono tracking-[0.15em] uppercase`
- Hover: logo transitions to brand-orange color

**Animation:** `motion.div` container with `STAGGER`, each child with `REVEAL`, triggered by `whileInView` + `VIEWPORT`.

**Acceptance criteria:**
- 4 columns desktop, 3 tablet, 2 mobile
- Click scrolls to anchor section
- Hover transitions logo color
- Stagger animation on scroll enter
- `npm run typecheck` passes

---

### Task 2.2: Create `AgentSetupSection.tsx` component

**File:** `apps/web/src/layers/features/marketing/ui/AgentSetupSection.tsx`

Per-agent setup instructions with anchor ID, copy-to-clipboard, and DeeplinkButton integration.

**Props:** `{ agent: AgentPlatform }`

**Structure:**
- `<section id={agent.anchor} className="scroll-mt-24 px-8 py-16">`
- `motion.div` with `REVEAL` + `VIEWPORT`

**Content per setup type:**
- `deeplink`: Render `<DeeplinkButton>` as primary CTA
- `cli`: Dark code block with command and copy button
- `config`: Dark code block with filename header and JSON content, copy button

**All agents get:** Fallback "Or configure manually:" with JSON config snippet.

**Copy-to-clipboard:** `navigator.clipboard.writeText()`, show `Check` icon for 2s via `useState` + `setTimeout`.

**Code block styling:** `bg-charcoal rounded-lg p-6 overflow-x-auto`, `text-cream-primary font-mono text-sm`.

**Acceptance criteria:**
- Section has correct `id` for anchor
- Deeplink agents show DeeplinkButton
- CLI/config agents show code block with copy
- All show manual fallback
- Copy feedback works
- `npm run typecheck` passes

---

### Task 2.3: Create `/integrations` page route

**File:** `apps/web/src/app/(marketing)/integrations/page.tsx`

Full integrations page composing hero, AgentGrid, AgentSetupSections, and CodeTabs.

**Metadata:**
- title: `'Integrations -- Loop'`
- description: `'Connect Loop to Claude Code, Cursor, VS Code, and any MCP-capable AI coding agent.'`

**Page composition:**
1. MarketingHeader
2. Hero section: h1 "Works with every AI coding agent", subtext, universal CTA `npx add-mcp https://mcp.looped.me/mcp` with copy button
3. AgentGrid with all AGENTS
4. Map AGENTS to AgentSetupSections (alternate bg-cream-primary / bg-cream-secondary)
5. Code Examples section with CodeTabs (curl / TypeScript SDK / CLI tabs, groupId "integrations-code")
6. MarketingFooter + MarketingNav

**Code example tabs content:**
- curl: dispatch next + create issue examples
- TypeScript SDK: LoopClient import, dispatch.next(), issues.create()
- CLI: dispatch next, issues create, issues list

**Acceptance criteria:**
- Page loads at `/integrations`
- Correct metadata
- Hero, grid, setup sections, code tabs all render
- Uses MarketingHeader/Footer
- `npm run build` succeeds
- `npm run typecheck` passes

---

## Phase 3: Homepage & Polish

### Task 3.1: Create `AgentPlatforms.tsx` homepage section

**File:** `apps/web/src/layers/features/marketing/ui/AgentPlatforms.tsx`

Horizontal agent logo strip for homepage with CTA to `/integrations`.

**Layout:** `<section id="integrations" className="bg-cream-secondary px-8 py-16">`, motion container `mx-auto max-w-2xl text-center`.

**Content:**
1. Brand-orange mono label: "Agent Integrations" (same style as IntegrationsBar)
2. Logo row: first 4-6 agents, flex-wrap centered, gap-8
3. Text: "Works with every AI coding agent."
4. CTA Link to `/integrations`: "View all integrations" with ArrowRight icon

**Animation:** STAGGER container, REVEAL children, whileInView + VIEWPORT.

**Acceptance criteria:**
- Shows 4-6 agent logos centered
- CTA links to `/integrations`
- Has `id="integrations"` for nav anchor
- Animation matches IntegrationsBar pattern
- `npm run typecheck` passes

---

### Task 3.2: Add `AgentPlatforms` to homepage and update exports

**Files:**
- `apps/web/src/app/(marketing)/page.tsx`
- `apps/web/src/layers/features/marketing/index.ts`

**Homepage (`page.tsx`):**
1. Import `AgentPlatforms` from marketing barrel
2. Insert `<AgentPlatforms />` between `<LoopValueProps />` and `<QuickStartSection />`
3. Add `{ label: 'integrations', href: '#integrations' }` to navLinks array (between 'features' and 'get started')

**Barrel exports (`index.ts`):**
Add exports for: `AgentGrid`, `AgentPlatforms`, `AgentSetupSection`, `CodeTabs`, `DeeplinkButton`, `AGENTS`, `MCP_SERVER_CONFIG`, and `AgentPlatform` type.

**Acceptance criteria:**
- AgentPlatforms appears between LoopValueProps and QuickStartSection
- Nav link "integrations" scrolls to section
- All new components exported from barrel
- `npm run build` succeeds
- `npm run typecheck` passes

---

### Task 3.3: Update IntegrationsBar label and site.ts description

**Files:**
- `apps/web/src/layers/features/marketing/ui/IntegrationsBar.tsx`
- `apps/web/src/config/site.ts`

**IntegrationsBar:** Change label text from "Built-in integrations" to "Signal Integrations".

**site.ts:** Update description to: `'Loop collects signals, organizes work into issues, and tells AI agents exactly what to do next. Works with Claude Code, Cursor, VS Code, and any MCP-capable agent.'`

**Acceptance criteria:**
- IntegrationsBar shows "Signal Integrations"
- site.ts description mentions agent compatibility
- `npm run build` succeeds

---

### Task 3.4: Responsive testing and animation polish

Manual verification -- no file changes expected.

**Test breakpoints:** Mobile 375px, Tablet 768px, Desktop 1280px.
**Test animations:** Scroll triggers, prefers-reduced-motion, no CLS.
**Test functionality:** Deeplinks, copy-to-clipboard, tab persistence, anchor scroll, llms.txt access.
**Build verification:** `npm run build`, `npm run typecheck`, `npm run lint` all pass.

**Acceptance criteria:**
- All breakpoints render correctly
- All interactive features work
- Build passes clean
- No visual regressions

---

## Dependency Graph

Phase 1 (parallel): Tasks 1.1, 1.2, 1.3, 1.4 have no interdependencies.

Phase 2 (after Phase 1):
- Task 2.1 depends on 1.1
- Task 2.2 depends on 1.1, 1.3
- Task 2.3 depends on 2.1, 2.2, 1.2

Phase 3 (after Phase 2):
- Task 3.1 depends on 1.1
- Task 3.2 depends on 3.1, 2.3
- Task 3.3 depends on 3.2
- Task 3.4 depends on 3.2, 3.3

## Parallel Execution Opportunities

- Tasks 1.1, 1.2, 1.3, 1.4 can all run in parallel
- Tasks 2.1 and 2.2 can run in parallel after 1.1 + 1.3 complete
- Task 3.1 can run in parallel with Task 2.3

## Critical Path

1.1 -> 2.1 -> 2.3 -> 3.2 -> 3.3 -> 3.4
