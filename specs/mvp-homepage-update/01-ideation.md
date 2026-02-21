---
slug: mvp-homepage-update
number: 7
created: 2026-02-20
status: ideation
---

# Update Marketing Homepage Post-MVP

**Slug:** mvp-homepage-update
**Author:** Claude Code
**Date:** 2026-02-20
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** Update the Loop marketing homepage (`apps/web`) to accurately reflect the completed MVP. All 4 phases are built: Data Layer & Core API, Prompt & Dispatch Engine, React Dashboard, and CLI Tool. The current homepage describes a different product ("autonomous codebase scanner") and shows "Coming Soon" — it needs to reflect what Loop actually is and that it's available now.
- **Assumptions:**
  - The marketing site (`apps/web`) is Next.js 16 + Fumadocs, deployed to Vercel at www.looped.me
  - Existing component architecture (Motion animations, design tokens, Dorkian warm cream palette) should be preserved
  - No backend changes needed — homepage is fully static
  - The existing marketing component library has reusable shells (animation patterns, layout structures) but content needs replacing
  - No social proof (testimonials, case studies) exists yet — need substitute trust signals
- **Out of scope:**
  - Docs pages (any route under `/docs/*`) — handled separately
  - Blog posts
  - New marketing pages beyond the homepage
  - OG image redesign (can be a follow-up)
  - Analytics/tracking changes

## 2) Pre-reading Log

- `apps/web/src/app/(marketing)/page.tsx`: Homepage entry point — composes LoopHero + LoopValueProps + ContactSection with header/footer/nav
- `apps/web/src/layers/features/marketing/ui/LoopHero.tsx`: Current hero — "Coming Soon" eyebrow, "Loop" headline, waitlist email CTA. Describes autonomous codebase scanner (wrong product)
- `apps/web/src/layers/features/marketing/ui/LoopValueProps.tsx`: "How it works" — Analyze/Plan/Execute 3-column grid (wrong product description)
- `apps/web/src/layers/features/marketing/ui/ContactSection.tsx`: Terminal-style email reveal with PostHog analytics — on-brand, still relevant
- `apps/web/src/layers/features/marketing/ui/MarketingHeader.tsx`: Fixed header with scroll-responsive logo + Docs link — probably no changes needed
- `apps/web/src/layers/features/marketing/ui/MarketingFooter.tsx`: Dark footer with brand stripes, social links, version badge — probably no changes needed
- `apps/web/src/layers/features/marketing/ui/MarketingNav.tsx`: Floating sidebar nav with keyboard shortcut (g+n) — may need anchor link updates
- `apps/web/src/layers/features/marketing/ui/ActivityFeedHero.tsx`: Split-panel hero with simulated activity feed — production-quality component but references wrong modules (Core, Pulse, Vault, Mesh, Channels)
- `apps/web/src/layers/features/marketing/ui/SystemArchitecture.tsx`: SVG diagram with draw-in animation and traveling particles — references "Six modules" (wrong architecture)
- `apps/web/src/layers/features/marketing/ui/HonestySection.tsx`: "Honest by Design" section — references Claude Code and local agent (wrong product)
- `apps/web/src/layers/features/marketing/ui/HowItWorksSection.tsx`: Install + steps section — references `npm install -g loop` and local agent workflow (wrong product)
- `apps/web/src/layers/features/marketing/ui/CredibilityBar.tsx`: Trust/credibility bar — exists, potentially reusable for integration logos
- `apps/web/src/config/site.ts`: Centralized branding — tagline "The Autonomous Improvement Engine", description references codebase scanning
- `apps/web/src/app/globals.css`: Tailwind v4 + Dorkian design system tokens (cream palette, charcoal, warm-gray, brand-orange, brand-green)
- `apps/web/src/layers/features/marketing/lib/motion-variants.ts`: SPRING, REVEAL, STAGGER, SCALE_IN, DRAW_PATH, VIEWPORT — reusable animation library
- `apps/web/src/layers/features/marketing/index.ts`: Barrel export for all marketing components, data, and types
- `apps/web/package.json`: Next.js 16, Motion 12.x, Fumadocs, Lucide React, shadcn/ui base, PostHog
- `meta/loop-litepaper.md`: The Loop vision — "closes the feedback loop" for AI-powered development
- `specs/mvp-build-plan.md`: 4-phase build plan — all phases complete

## 3) Codebase Map

- **Primary components/modules:**
  - `apps/web/src/app/(marketing)/page.tsx` — Homepage entry point (MUST UPDATE)
  - `apps/web/src/layers/features/marketing/ui/LoopHero.tsx` — Hero section (MUST UPDATE — wrong product, "Coming Soon")
  - `apps/web/src/layers/features/marketing/ui/LoopValueProps.tsx` — Value props (MUST UPDATE — wrong product description)
  - `apps/web/src/config/site.ts` — Site metadata (REVIEW — description may need updating)
  - `apps/web/src/layers/features/marketing/index.ts` — Barrel exports (UPDATE if new components added)

- **Shared dependencies:**
  - `motion/react` — Animation library used by all marketing components
  - `apps/web/src/layers/features/marketing/lib/motion-variants.ts` — REVEAL, STAGGER, VIEWPORT, etc.
  - `@/config/site` — siteConfig (name, tagline, description, URLs)
  - `next/link`, `next/image` — Next.js utilities
  - `apps/web/src/app/globals.css` — Design tokens (cream palette, brand colors)

- **Data flow:**
  - Static: `siteConfig` → components → rendered HTML (no API calls, no dynamic data)
  - Animation: `motion-variants` → `motion` components → scroll-triggered entrance animations

- **Feature flags/config:** None identified

- **Potential blast radius:**
  - Direct: 2-3 files (page.tsx, LoopHero.tsx, LoopValueProps.tsx)
  - May need new components: IntegrationsBar, HowItWorks (updated), QuickStart, FeaturePillars
  - May update: site.ts (description), barrel exports
  - Low risk: No database, no API, no auth — purely static content

## 4) Root Cause Analysis

N/A — not a bug fix.

## 5) Research

Research document: `research/20260220_mvp-homepage-update.md`

### Potential Solutions

**1. Targeted Content Replacement (Recommended)**
- Keep existing component architecture and animation patterns
- Replace content in LoopHero (new copy, remove "Coming Soon", update CTAs)
- Replace content in LoopValueProps (4 real product pillars instead of Analyze/Plan/Execute)
- Add new sections: IntegrationsBar, HowItWorks (real signal→dispatch flow), QuickStart
- Remove unused sections that describe wrong product (HonestySection, ProblemSection, old SystemArchitecture)
- Pros: Fastest, preserves design quality, low risk
- Cons: Incremental — may feel like a patch if not done thoroughly
- Complexity: Medium
- Maintenance: Low

**2. Full Page Rebuild**
- Design and build entirely new homepage sections from scratch
- Pros: Could create a more cohesive narrative
- Cons: Much higher effort, risks breaking existing design quality, unnecessary given good component shells
- Complexity: High
- Maintenance: Medium

**3. Minimal Copy Patch**
- Only update hero text and CTA — leave everything else
- Pros: Very fast (< 1 hour)
- Cons: Rest of page still describes wrong product, incoherent
- Complexity: Low
- Maintenance: Low (but creates technical debt)

### Recommendation

**Solution 1: Targeted Content Replacement.** The existing component shells and animation patterns are production-quality. The problem is purely content alignment — the page describes a codebase scanner when Loop is actually a signal-to-dispatch feedback loop engine. Replace content, add 2-3 new sections, update the page composition.

### Recommended Homepage Structure

```
[MarketingHeader: Logo | Docs | GitHub]
[LoopHero: Updated copy, "Open source" eyebrow, docs + GitHub CTAs]
[IntegrationsBar: PostHog | GitHub | Sentry — "Listens to your stack"]
[HowItWorks: Signal → Issue → Score → Dispatch — 4-step flow]
[FeaturePillars: Data Layer | Prompt Engine | Dashboard | CLI — 4 cards]
[QuickStart: Install CLI + first API call code block]
[ContactSection: Existing terminal-style email reveal]
[MarketingFooter: Existing dark footer]
```

### Hero Copy Recommendation

- **Eyebrow:** "Open source"
- **Headline:** "Close the feedback loop on AI-powered development."
- **Subhead:** "Loop collects signals from your stack — errors, metrics, user feedback — organizes them into prioritized issues, and tells your agents exactly what to fix next."
- **Primary CTA:** "Read the docs" (link to /docs)
- **Secondary CTA:** "View on GitHub"
- **Install hint:** `npm install -g looped`

## 6) Clarification

1. **Hero visual approach:** Should the hero use (a) a centered text-only layout (current LoopHero style), (b) a split-panel with an animated feedback loop diagram on the right (like ActivityFeedHero's structure), or (c) a split-panel with a code/terminal visualization showing real API responses?

2. **Integration logos section:** Should we show PostHog, GitHub, and Sentry logos as "integrations" even without formal partnerships? These are webhook sources Loop supports, not endorsements. Is "Listens to your stack" or "Built-in integrations" the right framing?

3. **Quick start section:** Should the quick start show (a) CLI installation and usage (`npm install -g looped && looped config set url ...`), (b) API usage (curl examples), or (c) both side by side?

4. **Existing unused components:** Several components exist from a previous product vision (HonestySection, ProblemSection, NotSection, old SystemArchitecture). Should we (a) delete them entirely since they describe the wrong product, or (b) leave them in the codebase but unused on the homepage?

5. **Footer version badge:** The footer shows "v0.2.0". Should this be updated, and if so, to what version?

6. **site.ts description:** The current `siteConfig.description` says "continuously analyzes, plans, and executes improvements to your codebase." Should this be updated to match the new homepage copy? This propagates to metadata/SEO.
