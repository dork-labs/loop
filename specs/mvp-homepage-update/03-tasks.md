# Task Breakdown: Update Marketing Homepage Post-MVP
Generated: 2026-02-20
Source: specs/mvp-homepage-update/02-specification.md
Last Decompose: 2026-02-20

## Overview

Update the Loop marketing homepage (`apps/web`) to accurately describe the completed MVP product. This involves deleting 20 legacy files, rewriting 2 existing components, creating 3 new sections, updating configuration files, and recomposing the homepage. All work is within the existing Next.js static marketing site at `apps/web/src/`.

## Phase 1: Content Cleanup & Foundation

### Task 1.1: Delete Legacy Component and Data Files

**Objective:** Remove 20 files that describe the wrong product vision (autonomous codebase scanner) and are unused dead code.

**Files to delete (15 UI components):**
- `apps/web/src/layers/features/marketing/ui/HonestySection.tsx`
- `apps/web/src/layers/features/marketing/ui/ProblemSection.tsx`
- `apps/web/src/layers/features/marketing/ui/NotSection.tsx`
- `apps/web/src/layers/features/marketing/ui/SystemArchitecture.tsx`
- `apps/web/src/layers/features/marketing/ui/HowItWorksSection.tsx`
- `apps/web/src/layers/features/marketing/ui/Hero.tsx`
- `apps/web/src/layers/features/marketing/ui/ActivityFeedHero.tsx`
- `apps/web/src/layers/features/marketing/ui/ProjectCard.tsx`
- `apps/web/src/layers/features/marketing/ui/ProjectsGrid.tsx`
- `apps/web/src/layers/features/marketing/ui/UseCasesGrid.tsx`
- `apps/web/src/layers/features/marketing/ui/PhilosophyCard.tsx`
- `apps/web/src/layers/features/marketing/ui/PhilosophyGrid.tsx`
- `apps/web/src/layers/features/marketing/ui/AboutSection.tsx`
- `apps/web/src/layers/features/marketing/ui/PulseAnimation.tsx`
- `apps/web/src/layers/features/marketing/ui/CredibilityBar.tsx`

**Files to delete (5 data/types):**
- `apps/web/src/layers/features/marketing/lib/projects.ts`
- `apps/web/src/layers/features/marketing/lib/philosophy.ts`
- `apps/web/src/layers/features/marketing/lib/modules.ts`
- `apps/web/src/layers/features/marketing/lib/use-cases.ts`
- `apps/web/src/layers/features/marketing/lib/types.ts`

**Acceptance Criteria:**
- [ ] All 20 files are deleted from the repository
- [ ] No other files reference these deleted files (check imports)
- [ ] `git status` shows 20 deleted files

### Task 1.2: Update Barrel Exports and Site Configuration

**Objective:** Update the marketing barrel export file to remove deleted exports and add placeholders for new components. Update `site.ts` with the correct product description and npm URL.

**Update `apps/web/src/layers/features/marketing/index.ts` to:**

```typescript
// UI components
export { ContactSection } from './ui/ContactSection'
export { MarketingNav } from './ui/MarketingNav'
export { MarketingHeader } from './ui/MarketingHeader'
export { MarketingFooter } from './ui/MarketingFooter'
export { LoopHero } from './ui/LoopHero'
export { LoopValueProps } from './ui/LoopValueProps'
export { IntegrationsBar } from './ui/IntegrationsBar'
export { HowItWorksFlow } from './ui/HowItWorksFlow'
export { QuickStartSection } from './ui/QuickStartSection'

// Motion
export { SPRING, VIEWPORT, REVEAL, STAGGER, SCALE_IN, DRAW_PATH } from './lib/motion-variants'

// Types
export type { NavLink } from './ui/MarketingNav'
```

**Update `apps/web/src/config/site.ts`:**

```typescript
export const siteConfig = {
  name: 'Loop',
  tagline: 'The Autonomous Improvement Engine',
  description:
    'Loop collects signals from your stack, organizes them into prioritized issues, and dispatches hydrated prompts to AI agents. Open-source feedback loop infrastructure for AI-powered development.',
  url: 'https://www.looped.me',
  contactEmail: 'hey@looped.me',
  github: 'https://github.com/dork-labs/loop',
  npm: 'https://www.npmjs.com/package/looped',
  ogImage: '/og-image.png',
  disableCookieBanner: true,
} as const
```

Changes: `description` updated to reflect actual product. `npm` URL updated from `loop` to `looped`.

**Update `apps/web/src/layers/features/marketing/ui/MarketingFooter.tsx` line 90:**
Change `v0.2.0 · System Online` to `v0.1.0 · System Online`.

**Acceptance Criteria:**
- [ ] Barrel export file has no references to deleted files
- [ ] New component exports are declared (IntegrationsBar, HowItWorksFlow, QuickStartSection)
- [ ] `site.ts` description mentions signals, issues, and hydrated prompts
- [ ] `site.ts` npm URL points to `looped` not `loop`
- [ ] MarketingFooter version badge reads `v0.1.0`
- [ ] NavLink type is still exported (moved from deleted types.ts — extract from MarketingNav or re-declare)

## Phase 2: Rewrite Existing Components

### Task 2.1: Rewrite LoopHero with Split-Panel Layout and Feedback Loop Diagram

**Objective:** Replace the current centered "Coming Soon" hero with a split-panel layout: text/CTAs on the left (55%), animated feedback loop SVG diagram on the right (45%).

**File:** `apps/web/src/layers/features/marketing/ui/LoopHero.tsx`

**Left Panel Content:**
- **Eyebrow:** `"Open source"` — `font-mono text-2xs tracking-[0.2em] uppercase text-brand-orange`
- **Headline:** `"Close the feedback loop on AI-powered development."` — `font-bold text-charcoal tracking-[-0.04em]` with `clamp(32px, 5.5vw, 64px)`
- **Subhead:** `"Loop collects signals from your stack — errors, metrics, user feedback — organizes them into prioritized issues, and tells your agents exactly what to fix next."` — `text-warm-gray font-light leading-[1.75]`
- **Primary CTA (desktop):** `"Read the docs"` -> `/docs/getting-started/quickstart` — orange button (`marketing-btn`)
- **Primary CTA (mobile):** `"Get started"` -> `/docs/getting-started/quickstart`
- **Secondary CTA:** `"View on GitHub"` -> `siteConfig.github` — text link with arrow
- **Install hint:** `npm install -g looped` — `font-mono text-2xs text-warm-gray-light`

**Layout:** `grid grid-cols-1 lg:grid-cols-[55%_1fr]` matching the existing `ActivityFeedHero` grid pattern.

**Right Panel — Feedback Loop SVG Diagram:**
- SVG `viewBox="0 0 400 320"` with 5 nodes arranged in a rounded rectangle flow
- Nodes: `Signal` (top-left), `Issue` (top-right), `Prompt` (right), `Dispatch` (bottom-right), `Outcome` (bottom-left)
- Each node: circle with `SCALE_IN` variant + text label
- Connections: curved paths with `DRAW_PATH` variant (pathLength animation)
- Traveling particles: `<circle>` with SMIL `<animateMotion>` on each connection path
- Node colors: brand-orange for circles, charcoal for labels
- Connection colors: brand-orange at 60% opacity

**LCP optimization:** The `<h1>` element must NOT start with `opacity: 0`. Use `initial={{ opacity: 1 }}` for the headline and only animate supporting elements (eyebrow, subhead, CTAs) with `REVEAL`.

**Reduced motion:** Use `useReducedMotion()` from `motion/react`. When true, skip SVG animations entirely and show the diagram in its final state (all paths drawn, all nodes visible, no particles).

**Background:** Subtle graph-paper grid (reuse existing pattern from current LoopHero).

**Acceptance Criteria:**
- [ ] Split-panel layout renders: text left (55%), diagram right (45%)
- [ ] On mobile (< lg), stacks vertically: text on top, diagram below
- [ ] Headline reads "Close the feedback loop on AI-powered development."
- [ ] Primary CTA says "Read the docs" on desktop, "Get started" on mobile
- [ ] SVG diagram has 5 nodes: Signal, Issue, Prompt, Dispatch, Outcome
- [ ] Nodes animate in with SCALE_IN, connections draw with DRAW_PATH
- [ ] Traveling particles animate along connection paths via SMIL animateMotion
- [ ] `<h1>` renders immediately (no opacity:0 initial state) for LCP
- [ ] `useReducedMotion()` disables animations and shows static diagram
- [ ] Graph-paper background pattern preserved from current implementation

### Task 2.2: Rewrite LoopValueProps with 4 Product Pillars

**Objective:** Replace the 3-column "Analyze / Plan / Execute" grid with a 4-column grid of real product capabilities.

**File:** `apps/web/src/layers/features/marketing/ui/LoopValueProps.tsx`

**Layout:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-4` with section `id="features"`. Background: `bg-cream-secondary`.

**4 pillars data:**

```typescript
const VALUE_PROPS: ValueProp[] = [
  {
    label: 'Data Layer',
    title: 'Signal Ingestion & Issue Management',
    description:
      'PostgreSQL-backed data layer with 10 entity types. Ingest signals from PostHog, GitHub, and Sentry. Full CRUD API with filtering, pagination, and hierarchy.',
  },
  {
    label: 'Prompt Engine',
    title: 'Template Selection & Hydration',
    description:
      'Conditions-based template matching with Handlebars hydration. Injects full system context — issues, projects, goals, relations — into agent prompts.',
  },
  {
    label: 'Dashboard',
    title: 'Real-Time Oversight',
    description:
      'React dashboard with 5 views: Issues, Issue Detail, Activity Timeline, Goals, and Prompt Health. Monitor the autonomous loop in real time.',
  },
  {
    label: 'CLI',
    title: 'Command-Line Control',
    description:
      '13 commands for issue management, signals, triage, dispatch, templates, and system status. JSON output for scripting.',
  },
]
```

**Card style:** `bg-cream-white rounded-lg p-6 border border-[var(--border-warm)]` with optional hover lift.

**Animation:** `whileInView` + `STAGGER` container, `REVEAL` per card.

**Acceptance Criteria:**
- [ ] Section has `id="features"` for anchor navigation
- [ ] 4 cards render with correct labels, titles, and descriptions
- [ ] Layout is 1-col on mobile, 2-col on tablet, 4-col on desktop
- [ ] Cards use `bg-cream-white` with warm border styling
- [ ] Staggered scroll-triggered entrance animations work

### Task 2.3: Update MarketingNav Anchor Links

**Objective:** Update the navigation anchor links to point to the new section IDs.

**File:** `apps/web/src/app/(marketing)/page.tsx` (navLinks const)

**New navLinks:**

```typescript
const navLinks = [
  { label: 'how it works', href: '#how-it-works' },
  { label: 'features', href: '#features' },
  { label: 'get started', href: '#get-started' },
  { label: 'contact', href: '#contact' },
  { label: 'docs', href: '/docs' },
]
```

**Acceptance Criteria:**
- [ ] Nav links match the section IDs: `#how-it-works`, `#features`, `#get-started`, `#contact`
- [ ] `docs` link navigates to `/docs`
- [ ] Old `#about` and `blog` links removed

## Phase 3: New Sections

### Task 3.1: Create IntegrationsBar Component

**Objective:** Create a new IntegrationsBar component showing PostHog, GitHub, and Sentry logos in a centered strip.

**File:** `apps/web/src/layers/features/marketing/ui/IntegrationsBar.tsx`

**Layout:** Full-width strip with centered content. Background: `bg-cream-secondary`.

**Content:**
- **Eyebrow:** `"Built-in integrations"` — centered, mono font (`font-mono text-2xs tracking-[0.2em] uppercase text-brand-orange text-center`)
- **Logo row:** 3 integration logos (PostHog, GitHub, Sentry) displayed horizontally with adequate spacing
- **Description:** `"Ingest signals from the tools your team already uses."` — centered subtext

**Logos:** Use official SVG logos in monochrome (warm-gray) style for brand consistency. Store as inline SVGs. Use `next/image` with explicit `width` and `height` to prevent CLS if using external files. Alternatively, inline SVG components are acceptable.

**Animation:** `whileInView` with `STAGGER` container + `REVEAL` children.

**Acceptance Criteria:**
- [ ] Three logos render correctly (PostHog, GitHub, Sentry)
- [ ] Logos are monochrome warm-gray for brand consistency
- [ ] Eyebrow text "Built-in integrations" is centered
- [ ] Description text is present below logos
- [ ] `whileInView` entrance animation triggers on scroll
- [ ] No CLS — logos have explicit dimensions

### Task 3.2: Create HowItWorksFlow Component

**Objective:** Create a 4-step horizontal flow component showing Signal -> Issue -> Prompt -> Dispatch.

**File:** `apps/web/src/layers/features/marketing/ui/HowItWorksFlow.tsx`

**Layout:** Horizontal 4-step flow on desktop, vertical on mobile. Section `id="how-it-works"`. Background: `bg-cream-primary`.

**4 steps data:**

| Step | Icon | Label | Title | Description |
|------|------|-------|-------|-------------|
| 1 | Lightning bolt | Signal | Collect Signals | Errors from Sentry, metrics from PostHog, events from GitHub arrive as typed signals |
| 2 | List/clipboard | Issue | Organize Work | Signals become triaged issues with type, priority, and project assignment |
| 3 | File/template | Prompt | Hydrate Prompts | The best-matching template is selected and filled with full system context |
| 4 | Play/send | Dispatch | Dispatch to Agents | The highest-priority unblocked issue is claimed and dispatched with its hydrated prompt |

**Icons:** Use Lucide React icons (already installed): `Zap` (lightning bolt), `ClipboardList`, `FileText`, `Send`.

**Visual connectors:** On desktop, horizontal arrows or lines connecting the 4 steps. On mobile, vertical flow with connecting lines.

**Animation:**
- Container: `whileInView` + `STAGGER`
- Each step: `REVEAL` variant
- Optional: `DRAW_PATH` on connecting lines

**Acceptance Criteria:**
- [ ] Section has `id="how-it-works"` for anchor navigation
- [ ] 4 steps render with icons, labels, titles, and descriptions
- [ ] Horizontal layout on desktop with visual connectors
- [ ] Vertical layout on mobile with vertical connectors
- [ ] Uses Lucide icons (Zap, ClipboardList, FileText, Send)
- [ ] Staggered scroll-triggered entrance animation

### Task 3.3: Create QuickStartSection Component

**Objective:** Create a section with CLI install commands in a terminal-style code block.

**File:** `apps/web/src/layers/features/marketing/ui/QuickStartSection.tsx`

**Layout:** Centered content with a code block. Section `id="get-started"`. Background: `bg-cream-tertiary`.

**Content:**
- **Eyebrow:** `"Get started"` — mono font, brand-orange
- **Headline:** `"Up and running in 60 seconds."` — charcoal, medium weight
- **Code block:** Terminal-style panel with:
  ```
  $ npm install -g looped
  $ looped config set url https://your-loop-instance.com
  $ looped config set token tok_your_api_key
  $ looped list
  ```
- **Below code:** `"Read the docs for the full setup guide."` with link to `/docs/getting-started/quickstart`

**Code block styling:** Dark background (`bg-charcoal`), monospace text (`text-cream-primary font-mono`), rounded corners, optional copy button for the install command.

**Animation:** `whileInView` + `REVEAL` for entrance. No animation on the code block itself to avoid CLS.

**Acceptance Criteria:**
- [ ] Section has `id="get-started"` for anchor navigation
- [ ] Terminal-style code block with dark background renders correctly
- [ ] All 4 commands display with `$` prefix
- [ ] "Read the docs" link navigates to `/docs/getting-started/quickstart`
- [ ] Code block has `bg-charcoal` background with `text-cream-primary font-mono` text
- [ ] `whileInView` entrance animation works
- [ ] No CLS on the code block

## Phase 4: Assembly & Polish

### Task 4.1: Recompose Homepage and Add Section Anchors

**Objective:** Update `page.tsx` to render all 7 sections in the correct order, and ensure all sections have correct `id` attributes for anchor navigation.

**File:** `apps/web/src/app/(marketing)/page.tsx`

**New page composition:**

```tsx
import { siteConfig } from '@/config/site'
import {
  ContactSection,
  MarketingNav,
  MarketingHeader,
  MarketingFooter,
  LoopHero,
  IntegrationsBar,
  HowItWorksFlow,
  LoopValueProps,
  QuickStartSection,
} from '@/layers/features/marketing'

const navLinks = [
  { label: 'how it works', href: '#how-it-works' },
  { label: 'features', href: '#features' },
  { label: 'get started', href: '#get-started' },
  { label: 'contact', href: '#contact' },
  { label: 'docs', href: '/docs' },
]

const socialLinks = [
  {
    name: 'GitHub',
    href: siteConfig.github,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
]

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <LoopHero />
        <IntegrationsBar />
        <HowItWorksFlow />
        <LoopValueProps />
        <QuickStartSection />
        <ContactSection
          email={siteConfig.contactEmail}
          promptText="Have questions about Loop? Want to contribute or collaborate?"
        />
      </main>
      <MarketingFooter email={siteConfig.contactEmail} socialLinks={socialLinks} />
      <MarketingNav links={navLinks} />
    </>
  )
}
```

**Section IDs required:**
- HowItWorksFlow: `id="how-it-works"`
- LoopValueProps: `id="features"`
- QuickStartSection: `id="get-started"`
- ContactSection: `id="contact"` (verify existing)

**Acceptance Criteria:**
- [ ] All 7 sections render in order: Hero, IntegrationsBar, HowItWorksFlow, LoopValueProps, QuickStart, Contact
- [ ] navLinks anchor to correct section IDs
- [ ] All anchor links scroll to the correct sections
- [ ] No console errors on page load
- [ ] ContactSection promptText updated to reflect available product

### Task 4.2: Build Verification and Final Polish

**Objective:** Verify the complete implementation passes all automated checks and renders correctly.

**Checks to run:**
1. `npm run typecheck` — passes for all packages
2. `npm run lint` — passes for `apps/web`
3. `npm run build` — produces valid static output without errors
4. Verify no broken imports (all barrel exports resolve)
5. Verify all deleted files are no longer referenced anywhere

**Manual verification:**
- Homepage loads at `localhost:3000` with no console errors
- All 7 sections render in correct order
- Hero diagram animates on load
- All sections animate on scroll
- "Read the docs" links navigate correctly
- "View on GitHub" opens in new tab
- Footer shows `v0.1.0`
- Responsive layouts render correctly at mobile/tablet/desktop

**Acceptance Criteria:**
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] No TypeScript errors
- [ ] No broken imports or missing components
- [ ] All links point to valid destinations
