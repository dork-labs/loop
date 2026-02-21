---
slug: mvp-homepage-update
---

# Specification: Update Marketing Homepage Post-MVP

## 1. Title

Update Marketing Homepage to Reflect Completed MVP

## 2. Status

Draft

## 3. Authors

- Claude Code — 2026-02-20

## 4. Overview

Update the Loop marketing homepage (`apps/web`, deployed at www.looped.me) to accurately reflect the completed MVP product. The current homepage describes a different product concept ("autonomous codebase scanner") and displays "Coming Soon." Loop is actually a signal-to-dispatch feedback loop engine for AI-powered development, and all 4 MVP phases are complete. This update replaces content, adds new sections, deletes legacy components, and updates SEO metadata.

## 5. Background / Problem Statement

The Loop MVP was built in 4 sequential phases:

1. **Data Layer & Core API** — PostgreSQL + Drizzle ORM, 10 entity types, full CRUD, signal ingestion from PostHog/GitHub/Sentry
2. **Prompt & Dispatch Engine** — Template selection, Handlebars hydration, priority scoring, dispatch queue, prompt reviews
3. **React Dashboard** — 5 views (Issues, Issue Detail, Activity Timeline, Goals, Prompt Health)
4. **CLI Tool** — `looped` npm package with 13 commands and 174 tests

The marketing homepage was created before the MVP was built and describes a different product vision: an "autonomous engine that continuously analyzes your codebase, identifies improvements, and executes them." This is not what Loop does. The homepage shows "Coming Soon" with a waitlist CTA, but the product is live.

Additionally, ~15 marketing components exist in the codebase that describe this wrong product vision (local AI agent runner, "six modules" architecture, etc.). These are dead code that adds confusion and bundle bloat.

**The core problem:** The homepage doesn't describe the product that was built, and signals the product isn't available when it is.

## 6. Goals

- Replace all homepage content to accurately describe Loop as a feedback loop engine for AI-powered development
- Signal that the product is available now (not "Coming Soon")
- Educate visitors on Loop's novel concept (signal → issue → prompt → dispatch → outcome)
- Provide clear paths to action (docs, GitHub, CLI install)
- Build trust without social proof via integration logos and open-source positioning
- Delete legacy components that describe the wrong product
- Update SEO metadata for search engine accuracy

## 7. Non-Goals

- Updating docs pages (`/docs/*`) — separate spec exists (`docs-update-post-mvp`)
- Creating new marketing pages (pricing, about, blog posts)
- OG image redesign
- Analytics/tracking changes
- Adding social proof (testimonials, case studies) — none exist yet
- Interactive demo or embedded playground
- Dark mode for marketing pages
- Responsive mobile-first redesign — keep existing responsive patterns

## 8. Technical Dependencies

| Library | Version | Purpose |
|---------|---------|---------|
| Next.js | 16.x | Framework (static generation, routing, Image optimization) |
| Motion | 12.x | Animation library (`motion/react` — formerly Framer Motion) |
| Tailwind CSS | 4.x | Styling via utility classes + design tokens in `globals.css` |
| React | 19.x | UI framework |
| Lucide React | latest | Icon library (already installed) |
| PostHog | latest | Analytics (existing, no changes needed) |

No new dependencies are required. All libraries are already in `apps/web/package.json`.

**Key Motion APIs used:**
- `whileInView` with `viewport={{ once: true, amount: 0.2 }}` for scroll-triggered entrance animations
- `variants` with `REVEAL`, `STAGGER`, `SCALE_IN`, `DRAW_PATH` from `motion-variants.ts`
- `useReducedMotion` hook for accessibility
- SVG `pathLength` animation for diagram connections
- SMIL `<animateMotion>` for traveling particles

## 9. Detailed Design

### 9.1 Architecture

No architectural changes. The marketing site remains a statically generated Next.js app. All changes are within the existing FSD-based marketing feature layer.

### 9.2 File Organization (After Changes)

```
apps/web/src/
├── app/(marketing)/
│   ├── layout.tsx              # No changes
│   ├── marketing-shell.tsx     # No changes
│   └── page.tsx                # UPDATE: Recompose section order
├── config/
│   └── site.ts                 # UPDATE: description, tagline
└── layers/features/marketing/
    ├── index.ts                # UPDATE: Remove deleted exports, add new
    ├── lib/
    │   └── motion-variants.ts  # No changes
    └── ui/
        ├── ContactSection.tsx   # No changes
        ├── MarketingHeader.tsx  # No changes
        ├── MarketingFooter.tsx  # UPDATE: Version badge → v0.1.0
        ├── MarketingNav.tsx     # UPDATE: Nav anchor links
        ├── LoopHero.tsx         # REWRITE: Split-panel with feedback loop diagram
        ├── LoopValueProps.tsx   # REWRITE: 4 real product pillars
        ├── IntegrationsBar.tsx  # NEW: PostHog/GitHub/Sentry logo strip
        ├── HowItWorksFlow.tsx   # NEW: 4-step Signal → Issue → Score → Dispatch
        └── QuickStartSection.tsx # NEW: CLI install + first commands
```

**Files to delete** (20 files — wrong product vision, unused):

UI components:
- `HonestySection.tsx`, `ProblemSection.tsx`, `NotSection.tsx`
- `SystemArchitecture.tsx`, `HowItWorksSection.tsx`, `Hero.tsx`
- `ActivityFeedHero.tsx`, `ProjectCard.tsx`, `ProjectsGrid.tsx`
- `UseCasesGrid.tsx`, `PhilosophyCard.tsx`, `PhilosophyGrid.tsx`
- `AboutSection.tsx`, `PulseAnimation.tsx`, `CredibilityBar.tsx`

Data/types:
- `lib/projects.ts`, `lib/philosophy.ts`, `lib/modules.ts`
- `lib/use-cases.ts`, `lib/types.ts`

### 9.3 Homepage Section Composition

```tsx
// apps/web/src/app/(marketing)/page.tsx
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
        <ContactSection email={siteConfig.contactEmail} promptText="..." />
      </main>
      <MarketingFooter email={siteConfig.contactEmail} socialLinks={socialLinks} />
      <MarketingNav links={navLinks} />
    </>
  )
}
```

### 9.4 Component Specifications

#### 9.4.1 LoopHero (Rewrite)

**Layout:** Split-panel — text/CTAs on left (55%), animated feedback loop SVG diagram on right (45%). Uses `grid grid-cols-1 lg:grid-cols-[55%_1fr]` matching the existing `ActivityFeedHero` grid pattern.

**Content:**
- **Eyebrow:** `"Open source"` — `font-mono text-2xs tracking-[0.2em] uppercase text-brand-orange`
- **Headline:** `"Close the feedback loop on AI-powered development."` — `font-bold text-charcoal tracking-[-0.04em]` with `clamp(32px, 5.5vw, 64px)`
- **Subhead:** `"Loop collects signals from your stack — errors, metrics, user feedback — organizes them into prioritized issues, and tells your agents exactly what to fix next."` — `text-warm-gray font-light leading-[1.75]`
- **Primary CTA (desktop):** `"Read the docs"` → `/docs/getting-started/quickstart` — orange button (`marketing-btn`)
- **Primary CTA (mobile):** `"Get started"` → `/docs/getting-started/quickstart`
- **Secondary CTA:** `"View on GitHub"` → `siteConfig.github` — text link with arrow
- **Install hint:** `npm install -g looped` — `font-mono text-2xs text-warm-gray-light`

**Right Panel — Feedback Loop Diagram:**

An SVG diagram showing the autonomous feedback loop as a circular flow:

```
Signal → Issue → Prompt → Dispatch
  ↑                              ↓
  ← ← ← ← Outcome ← ← ← ← ← ←
```

Technical implementation:
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

#### 9.4.2 IntegrationsBar (New)

**Layout:** Full-width strip with centered content. Background: `bg-cream-secondary`.

**Content:**
- **Eyebrow:** `"Built-in integrations"` — centered, mono font
- **Logo row:** 3 integration logos (PostHog, GitHub, Sentry) displayed horizontally with adequate spacing
- **Description:** `"Ingest signals from the tools your team already uses."` — centered subtext

**Logos:** Use official SVG logos in monochrome (warm-gray) style for brand consistency. Store as inline SVGs or in `public/images/integrations/`. Use `next/image` with explicit `width` and `height` to prevent CLS.

**Animation:** `whileInView` with `STAGGER` container + `REVEAL` children.

#### 9.4.3 HowItWorksFlow (New)

**Layout:** Horizontal 4-step flow on desktop, vertical on mobile. Background: `bg-cream-primary`.

**Content — 4 steps:**

| Step | Icon | Label | Title | Description |
|------|------|-------|-------|-------------|
| 1 | Lightning bolt | Signal | Collect Signals | Errors from Sentry, metrics from PostHog, events from GitHub arrive as typed signals |
| 2 | List/clipboard | Issue | Organize Work | Signals become triaged issues with type, priority, and project assignment |
| 3 | File/template | Prompt | Hydrate Prompts | The best-matching template is selected and filled with full system context |
| 4 | Play/send | Dispatch | Dispatch to Agents | The highest-priority unblocked issue is claimed and dispatched with its hydrated prompt |

**Visual connectors:** On desktop, horizontal arrows or lines connecting the 4 steps. On mobile, vertical flow with connecting lines.

**Animation:**
- Container: `whileInView` + `STAGGER`
- Each step: `REVEAL` variant
- Optional: `DRAW_PATH` on connecting lines

#### 9.4.4 LoopValueProps (Rewrite)

**Layout:** 4-column grid on desktop (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`), 2-column on tablet, 1-column on mobile. Background: `bg-cream-secondary`.

**Content — 4 pillars:**

| Pillar | Label | Title | Description |
|--------|-------|-------|-------------|
| 1 | Data Layer | Signal Ingestion & Issue Management | PostgreSQL-backed data layer with 10 entity types. Ingest signals from PostHog, GitHub, and Sentry. Full CRUD API with filtering, pagination, and hierarchy. |
| 2 | Prompt Engine | Template Selection & Hydration | Conditions-based template matching with Handlebars hydration. Injects full system context — issues, projects, goals, relations — into agent prompts. |
| 3 | Dashboard | Real-Time Oversight | React dashboard with 5 views: Issues, Issue Detail, Activity Timeline, Goals, and Prompt Health. Monitor the autonomous loop in real time. |
| 4 | CLI | Command-Line Control | 13 commands for issue management, signals, triage, dispatch, templates, and system status. JSON output for scripting. |

**Card style:** Reuse existing card patterns — `bg-cream-white rounded-lg p-6 border border-[var(--border-warm)]` with optional hover lift.

**Animation:** `whileInView` + `STAGGER` container, `REVEAL` per card.

#### 9.4.5 QuickStartSection (New)

**Layout:** Centered content with a code block. Background: `bg-cream-tertiary`.

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

### 9.5 Configuration Updates

#### site.ts

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

Changes:
- `description` updated to reflect actual product
- `npm` URL updated from `loop` to `looped` (actual package name)

#### MarketingFooter Version Badge

Change `v0.2.0 · System Online` to `v0.1.0 · System Online` in `MarketingFooter.tsx` line 90.

#### MarketingNav Anchor Links

Update nav links to match new sections:
```typescript
const navLinks = [
  { label: 'how it works', href: '#how-it-works' },
  { label: 'features', href: '#features' },
  { label: 'get started', href: '#get-started' },
  { label: 'contact', href: '#contact' },
  { label: 'docs', href: '/docs' },
]
```

### 9.6 Barrel Export Updates

Update `apps/web/src/layers/features/marketing/index.ts` to:
- Remove all deleted component exports (15 UI components, 4 data modules, 2 type exports)
- Add new component exports: `IntegrationsBar`, `HowItWorksFlow`, `QuickStartSection`
- Keep existing: `ContactSection`, `MarketingNav`, `MarketingHeader`, `MarketingFooter`, `LoopHero`, `LoopValueProps`
- Keep: `SPRING`, `VIEWPORT`, `REVEAL`, `STAGGER`, `SCALE_IN`, `DRAW_PATH` from motion-variants

### 9.7 JSON-LD Structured Data

The marketing layout (`apps/web/src/app/(marketing)/layout.tsx`) already renders JSON-LD for `SoftwareApplication` and `WebSite` schemas. These read from `siteConfig`, so updating `site.ts` will propagate automatically. No additional JSON-LD changes needed.

## 10. User Experience

**User journey:**

1. Developer visits www.looped.me (from search, GitHub, word of mouth)
2. **Hero** — instantly sees "Close the feedback loop on AI-powered development" with animated diagram showing the loop concept. Understands what this tool does in 5 seconds.
3. **Integrations** — sees PostHog, GitHub, Sentry logos. Thinks "this works with my stack."
4. **How it works** — understands the 4-step flow: Signal → Issue → Prompt → Dispatch. Grasps the novel concept.
5. **Feature pillars** — sees the 4 capabilities. Understands the scope (data layer + prompt engine + dashboard + CLI).
6. **Quick start** — copies `npm install -g looped`. Has clear path to trying it.
7. **Contact** — can reach out with questions.

**Exit points:** Docs (primary), GitHub (secondary), CLI install (tertiary).

## 11. Testing Strategy

### Visual Testing

This is a static marketing page with no business logic. Testing focuses on:

- **Build verification:** `npm run build` completes without TypeScript errors in `apps/web`
- **No broken imports:** All barrel exports resolve correctly after deleting 20 files
- **No missing components:** Homepage renders all 7 sections without runtime errors
- **Link verification:** All `<Link>` and `<a>` hrefs point to valid destinations

### Manual Testing Checklist

- [ ] Homepage loads at `localhost:3000` with no console errors
- [ ] All 7 sections render in correct order
- [ ] Hero diagram animates on load (SVG draw-in + particles)
- [ ] All sections animate on scroll (whileInView triggers)
- [ ] "Read the docs" link navigates to `/docs/getting-started/quickstart`
- [ ] "View on GitHub" opens `github.com/dork-labs/loop` in new tab
- [ ] Integration logos display correctly at all breakpoints
- [ ] Code block in QuickStart is readable and correctly formatted
- [ ] Footer shows `v0.1.0`
- [ ] `prefers-reduced-motion: reduce` disables animations, shows static diagram
- [ ] Responsive: mobile, tablet, desktop all render correctly
- [ ] No CLS (Cumulative Layout Shift) on load
- [ ] `/docs` routes still work (no regression)
- [ ] `MarketingNav` anchor links scroll to correct sections

### Automated Checks

- `npm run typecheck` passes for all packages
- `npm run lint` passes for `apps/web`
- `npm run build` produces valid static output

## 12. Performance Considerations

| Metric | Target | Strategy |
|--------|--------|----------|
| LCP | < 2.5s | Hero h1 renders immediately (no opacity:0 animation). Static generation. |
| CLS | < 0.1 | Fixed heights on animated panels. Explicit `width`/`height` on all images. |
| FID | < 100ms | No event handlers on initial render. Animations are passive. |
| JS bundle | < 150KB gzipped above-fold | Code-split sections below fold. Motion is already tree-shaken. |
| Image size | < 50KB per logo | Use optimized SVGs for integration logos. `next/image` for raster images. |

**Static generation:** The homepage has zero dynamic data. It should produce a single static HTML file at build time. No `getServerSideProps`, no `fetch` calls, no API dependencies.

**Animation performance:** Use CSS `transform` and `opacity` for all animations (GPU-composited). Avoid animating `width`, `height`, `top`, `left` which trigger layout. The existing `motion-variants.ts` already follows this pattern.

## 13. Security Considerations

- **No user data:** The homepage is purely static with no forms, no auth, no API calls
- **External links:** All external links (`github.com`, etc.) use `rel="noopener noreferrer"` — maintain this pattern for new links
- **Email exposure:** `siteConfig.contactEmail` is rendered in mailto links. This is intentional for a developer-facing product. No change needed.
- **CSP compatibility:** SVG animations use SMIL (`<animateMotion>`) which is inline SVG — no additional CSP headers needed
- **No secrets:** No API keys, tokens, or sensitive data on the marketing site

## 14. Documentation

No documentation updates needed for this change. The homepage is the documentation — it describes the product.

Deferred: docs pages update (`docs-update-post-mvp` spec).

## 15. Implementation Phases

### Phase 1: Content Cleanup & Foundation

1. Delete 20 legacy component/data files
2. Update `index.ts` barrel exports (remove deleted, keep existing)
3. Update `site.ts` (description, npm URL)
4. Update `MarketingFooter.tsx` version badge to `v0.1.0`
5. Verify build passes after deletions

### Phase 2: Rewrite Existing Components

6. Rewrite `LoopHero.tsx` — split-panel layout with feedback loop SVG diagram
7. Rewrite `LoopValueProps.tsx` — 4 real product pillars
8. Update `MarketingNav.tsx` — new anchor links

### Phase 3: New Sections

9. Create `IntegrationsBar.tsx` — PostHog/GitHub/Sentry logo strip
10. Create `HowItWorksFlow.tsx` — 4-step Signal → Issue → Score → Dispatch
11. Create `QuickStartSection.tsx` — CLI install code block

### Phase 4: Assembly & Polish

12. Update `page.tsx` — recompose homepage with all sections in correct order
13. Add `id` attributes to sections for anchor navigation
14. Add `useReducedMotion` support to hero diagram
15. Verify responsive layouts at all breakpoints
16. Run build, typecheck, lint

## 16. Open Questions

None — all decisions have been made during the ideation clarification phase.

## 17. Related ADRs

- **ADR-0002:** Deploy as two Vercel projects from one monorepo — confirms `apps/web` deploys independently to Vercel
- **ADR-0012:** Use TanStack Router for the dashboard — dashboard-specific, confirms no routing conflicts with marketing site

## 18. References

- Ideation document: `specs/mvp-homepage-update/01-ideation.md`
- Research document: `research/20260220_mvp-homepage-update.md`
- MVP build plan: `specs/mvp-build-plan.md`
- Loop litepaper: `meta/loop-litepaper.md`
- Motion for React docs: https://motion.dev/docs/react
- Motion `useReducedMotion`: https://motion.dev/docs/react/use-reduced-motion
- Evil Martians dev tool landing page study: https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025
- Next.js Image optimization: https://nextjs.org/docs/app/building-your-application/optimizing/images

## 19. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-20 | Initial draft | Claude Code |
