# Research: Loop MVP Homepage Update

**Date:** 2026-02-20
**Feature:** mvp-homepage-update
**Mode:** Deep Research

---

## Research Summary

Developer tool homepages in 2025-2026 converge on a "documentation-first with interactive proof" structure: a clear, specific headline, a visual that demonstrates the tool working (not just describing it), and a fast path to the docs or install command. For Loop specifically — an open-source, MVP-stage tool solving a novel problem for AI-agent-powered dev teams — the strongest approach is a **Feature Showcase with Honest Positioning**: a split-panel hero showing the feedback loop concept in action, followed by a tight "how it works" section with real CLI/API examples, feature pillars that map to what's built, and a transparent "no social proof yet" stance that lean into rather than hide.

The existing codebase already has strong building blocks: `ActivityFeedHero`, `HowItWorksSection`, `SystemArchitecture`, and `LoopValueProps` are all production-quality components. The homepage update is primarily a **content and structure problem**, not a component build problem. The current page (`LoopHero` + `LoopValueProps`) describes what Loop was planned to be ("autonomous codebase scanner"). It needs to be replaced with what Loop actually is: the data layer and prompt engine that closes the feedback loop for AI-powered development.

---

## Key Findings

### 1. The Current Homepage Has a Fundamental Mismatch

The live homepage (`LoopHero` + `LoopValueProps`) describes a different product than what was built:

- **Hero says:** "An autonomous engine that continuously analyzes your codebase, identifies improvements, and executes them — so your software gets better while you sleep."
- **Value props say:** "Analyze → Plan → Execute" (codebase scanning)
- **What Loop actually is:** A data layer and prompt engine for AI agent development teams — ingests signals from PostHog/GitHub/Sentry, organizes them into issues, scores and dispatches prompts to agents, and provides a dashboard for oversight.

The `HowItWorksSection` similarly describes `npm install -g loop` and `loop --dir ~/projects`, which matches a different product concept entirely (a local agent runner, not a feedback loop engine). These components appear to be prototypes from an earlier vision.

The `ActivityFeedHero` component is the most production-ready hero and closest to the actual product, but its activity feed content references modules ("Core", "Pulse", "Vault", "Mesh", "Channels") that don't match the actual MVP architecture.

**Action required:** Replace the homepage section composition with components that accurately reflect the built MVP. The component shells are reusable but the content, copy, and structure need alignment with the real product.

### 2. Developer Tool Landing Pages: What Works in 2025

Based on analysis of 100+ dev tool landing pages (Evil Martians study) and case studies of Linear, PostHog, Sentry, Vercel, Supabase, and comparable tools:

**Hero section patterns that perform:**
- Centered or split-panel layout (both work; split gives more room to show the product)
- Bold specific headline (not generic — names the exact problem or user type)
- Eyebrow label for context-setting (launch status, open-source badge, category)
- Two CTAs maximum: one primary action (install/sign up/get API key), one secondary (docs/GitHub)
- Visual proof: a live/animated product screenshot, terminal animation, or data visualization — not just a static illustration
- Sub-3-second load for above-the-fold content

**Sections that follow the hero (priority order for new tools):**
1. "How it works" — 3-step or flow diagram, keeps it concrete and fast
2. Feature pillars — 3-4 cards mapping to real capabilities, not aspirations
3. Integration logos — shows maturity, answers "does it work with my stack"
4. Quick start code — install command + 2-3 lines to first value
5. Honest CTA — for open source tools with no social proof, transparency is a feature not a bug

**What NOT to include (early stage):**
- Testimonials from real customers (you have none yet — fake or generic testimonials destroy trust with developers)
- Pricing tables (unless freemium/self-serve is a key differentiator)
- Heavy animations that block perceived load time
- Vague "AI-powered" headline copy — too common, too meaningless in 2026

### 3. How Comparable Tools Structure Their Homepages

**PostHog** — Most relevant comparison (open-source, developer-facing, novel category)
- Hero: "Dev tools for product engineers" — avoids narrow categorization, names the audience not the product
- Strategy: walks visitors through a *realization* rather than a features list
- Narrative arc: What is this? → Show breadth → Challenge existing approaches → You need infrastructure, not dashboards
- Does NOT lead with social proof; leads with category education
- Transparency and "engineering-led company" signals substitute for testimonials

**Linear** — Aspirational comparison (dark theme, dev-focused, premium positioning)
- "Purpose-built tool for planning and building products"
- Uses product screenshots with animation rather than illustrations
- Dark theme conveys technical seriousness
- "Start building" primary CTA — verb-first, specific

**Supabase** — Open source comparable
- "Open-source Firebase alternative" — anchors to known category for instant context
- Install command in the hero
- Docs link as strong secondary CTA

**Vercel** — Aspirational for developer platform positioning
- "No-fluff entry point optimized for developer decision speed"
- "Start building" as primary CTA
- Performance metrics front and center

**Key pattern:** All successful developer tool homepages for technical audiences skip the "why you need this" section. They go directly to "here's what this does, here's how to get it." The exception is when creating a new category — then problem framing is required first.

### 4. The Novel Concept Problem: Loop Needs Category Education

Loop is building a new category: "feedback loop infrastructure for AI-agent-powered development." This doesn't exist as a named category yet. Comparable category-creation challenges from research:

- **Problem-first approach**: Name the specific pain before naming the solution. Developers using AI agents for coding know the frustration — they have agents that generate code but no system to close the loop (errors from Sentry, user signals from PostHog, GitHub issues) back into the agent's work queue.
- **"We're X for Y" framing**: Anchoring helps. Loop is closest to "Linear for AI agent work items" or "Sentry for the AI agent feedback loop" — but this undersells the data layer aspect.
- **Show the loop, don't describe it**: A diagram or animation that shows signal → issue → prompt → agent → outcome → signal closes the abstraction gap faster than any description.

The MightyBot example is instructive: they position around the *feedback loop concept* itself ("agents execute → humans review → feedback updates policy → agents execute better"), which is very close to what Loop does. Their homepage messaging focuses on the closed-loop architecture as the differentiator.

### 5. Social Proof Strategy Without Testimonials

When there's no social proof yet, these substitutes work for developer tools:

1. **GitHub star count** — even 10-50 stars signals real humans tried it; display prominently
2. **"Open source" badge** — signals transparency and community ownership; strong trust signal for developers
3. **Commit activity / maintenance signals** — "Last commit: X days ago", or link to a recent release note
4. **Honest MVP framing** — "We just shipped v0.1" or "MVP now available" — developers respect honesty; pre-announcing things as production-ready destroys trust
5. **Integration logos** — PostHog, GitHub, Sentry logos signal "these tools we integrate with" rather than "these companies use us"
6. **Self-deprecating transparency** — PostHog uses this: "If nothing else has sold you..." Works because it's authentic

### 6. Performance and Technical Considerations for Next.js 16 + Fumadocs

**Rendering strategy:**
- Homepage should be statically generated (SSG) — no dynamic data required
- Use `next/image` for all illustrations/screenshots
- Keep above-the-fold JS bundle minimal — defer animated components with `loading="lazy"` or dynamic imports with `ssr: false`

**Animation approach:**
- The codebase already uses `motion/react` (Motion library) — stay consistent
- Framer Motion (now Motion) is correct choice for React — don't add GSAP
- Scroll-triggered animations: use `whileInView` with `once: true` (already done in existing components — maintain this pattern)
- Keep animation CPU cost low: prefer CSS transitions for color/opacity, use `motion` for position/scale changes
- `prefers-reduced-motion`: ensure all animations respect this; add `useReducedMotion()` hook where needed

**SEO:**
- Implement JSON-LD structured data for the homepage (SoftwareApplication schema)
- Populate `metadata` export in `apps/web/src/app/(marketing)/page.tsx` with explicit `title`, `description`, `openGraph`, and `twitter` fields
- The current `opengraph-image.tsx` and `twitter-image.tsx` exist — ensure they use updated copy
- Target keywords: "AI agent feedback loop", "autonomous improvement engine", "developer tool signal ingestion", "prompt dispatch engine open source"

**Bundle size:**
- The `ActivityFeedHero` is already client-only (`'use client'`) — this is correct for animated components
- Keep hero visual components in their own files for code splitting
- `CredibilityBar` component exists but appears unused on the homepage — evaluate whether to use it for integration logos

---

## Detailed Analysis

### Homepage Structure Comparison

Four approaches were evaluated against Loop's specific constraints (open-source, MVP-stage, novel concept, technical audience, no social proof):

#### Option A: Minimal (Hero + Features + CTA)
```
[Hero: headline + tagline + 2 CTAs]
[3-column feature grid]
[Bottom CTA]
```
**Pros:** Fast to ship, loads instantly, lets copy do the heavy lifting
**Cons:** Doesn't explain the novel concept, no visual proof the product works, likely to result in high bounce rates for people who don't immediately "get it"
**Verdict:** Too thin for a novel-category tool. Works for established categories (Linear, Stripe). Not for Loop.

#### Option B: Feature Showcase (Hero + Detailed Features + Social Proof + CTA)
```
[Hero: headline + visual + 2 CTAs]
[How it works: 3-step flow]
[Feature sections: each with visual]
[Integration logos]
[Bottom CTA]
```
**Pros:** Educational, builds understanding, lets each capability tell its own story
**Cons:** Long page, social proof section will be empty or weak, risks feeling aspirational rather than real
**Verdict:** Good structure but needs honest social proof substitutes (GitHub stars, integration logos, commit activity).

#### Option C: Interactive Demo (Hero with Live Demo + Features + CTA)
```
[Hero: headline + embedded playground/sandbox]
[Feature sections]
[CTA]
```
**Pros:** Most convincing for technical audiences — "show don't tell"
**Cons:** Extremely expensive to build a real embedded demo; a fake one destroys trust; the product is a backend API + CLI, not a UI you can easily demo inline
**Verdict:** Wrong fit for Loop's architecture. The ActivityFeedHero's simulated feed is the right abstraction here — an honest simulation labeled as such.

#### Option D: Documentation-First (Hero + Quick Start Code + Features + Docs Link)
```
[Hero: headline + install command + "copy" button]
[Quick start code block]
[Feature pillars]
[Docs →]
```
**Pros:** Most developer-authentic, respects developer time, drives straight to docs
**Cons:** Assumes visitors already know they want this tool; doesn't educate on the novel concept
**Verdict:** Good secondary pattern — the install command and "Read the docs" CTA should be present, but can't be the only structure.

### Recommended Structure: Hybrid of B + D

```
[Nav: Logo | Docs | GitHub]
[Hero: Split-panel — headline/subhead/2CTAs left, animated feedback loop diagram right]
[Integration logos: PostHog | GitHub | Sentry — "Listens to your stack"]
[How it works: Signal → Issue → Prompt → Dispatch → Outcome — 5-step flow]
[Feature pillars: Data Layer | Prompt Engine | Dashboard | CLI — 4 cards]
[Quick start: npm install + 3 code lines → first value]
[Honest footer CTA: Open source, MIT, no card required]
[Footer]
```

This structure:
1. Leads with what it is and who it's for (hero)
2. Establishes trust via integrations they already use (no testimonials needed)
3. Explains the loop concept visually (how it works)
4. Maps to actual built capabilities (feature pillars)
5. Proves it's real with install command (quick start)
6. Closes with honest open-source positioning

### Hero Copy Recommendation

**Current (wrong product):**
> "An autonomous engine that continuously analyzes your codebase, identifies improvements, and executes them — so your software gets better while you sleep."

**Recommended:**
> Headline: "Close the feedback loop on AI-powered development."
> Subhead: "Loop collects signals from your stack — errors, metrics, user feedback — organizes them into prioritized issues, and tells your agents exactly what to fix next."
> Eyebrow: "Open source · MIT · MVP"
> Primary CTA: "Read the docs →"
> Secondary CTA: "View on GitHub"
> Install hint: `npm install -g @loop/cli`

**Rationale:**
- "Close the feedback loop" is the core concept in 5 words — developers immediately understand "feedback loop" as a system concept
- Subhead names the specific integrations (errors, metrics, user feedback) — grounds the abstraction
- "Tells your agents exactly what to fix next" — specific, evocative, correct
- Eyebrow is honest about MVP status — developers trust honest tools
- Primary CTA is docs (appropriate for a tool with no sign-up flow to drive to)
- GitHub as secondary (strong signal for open-source tools)

### Visual Proof Strategy

The `ActivityFeedHero` component exists and is well-built but references wrong modules. The right visual for the new homepage is a **feedback loop diagram** rather than an activity feed, because:

1. The loop concept is the core value proposition — showing the circular flow makes it instantly graspable
2. Activity feeds convey "live system" but don't convey "feedback loop infrastructure"
3. A simple animated diagram (Signal → Issue → Prompt → Dispatch → back to Signal) is fast to render, SEO-friendly (can use SVG), and educational

The existing `SystemArchitecture` SVG animation pattern (draw-in paths, traveling particles, SMIL animation) is the right technical approach. The `DRAW_PATH` and traveling particle pattern should be reused for a feedback loop diagram.

Alternatively, a code-focused right panel showing:
```
// Signal received from Sentry
POST /api/signals/sentry → issue created

// Loop scores and dispatches
GET /api/dispatch/next
→ { template: "fix-error", context: {...}, priority: 94 }
```
...is also a strong option for a more technical first impression.

### Section-Level Copy Updates Required

| Component | Current State | What's Needed |
|-----------|--------------|---------------|
| `LoopHero` | "Coming Soon" + codebase scanner copy | Replace with new hero or promote `ActivityFeedHero` with corrected content |
| `LoopValueProps` | "Analyze / Plan / Execute" (wrong product) | Replace with real 4 pillars: Data Layer, Prompt Engine, Dashboard, CLI |
| `HowItWorksSection` | `npm install -g loop` + wrong steps | Replace with real Loop flow: Signal → Issue → Score → Dispatch |
| `ActivityFeedHero` | Good structure, wrong module names | Update `ACTIVITY_POOL` to reflect real Loop actions; update module names to match real system |
| `SystemArchitecture` | "Six modules" (wrong architecture) | Remove or replace with real 4-component architecture diagram |
| `HonestySection` | References Claude Code and local agent — wrong product | Remove (that's a different product) or rewrite for actual Loop honesty (API key required, signals sent to server, etc.) |
| `ProblemSection` | "cloud vs. local" positioning — wrong product | Remove entirely |

---

## Potential Solutions (Ranked)

### Solution 1: Targeted Content Replacement (Recommended)
**Effort:** Medium | **Risk:** Low | **Time:** 1-2 days

Keep the existing component architecture. Replace content:
- Swap `LoopHero` for a new `LoopHeroV2` with correct copy, or repurpose `ActivityFeedHero` with corrected content
- Rewrite `LoopValueProps` with the 4 real pillars (Data Layer, Prompt Engine, Dashboard, CLI)
- Replace `HowItWorksSection` steps with the real signal → dispatch flow
- Add a new `IntegrationsBar` (reuse `CredibilityBar` structure) showing PostHog, GitHub, Sentry logos
- Remove `SystemArchitecture`, `HonestySection`, `ProblemSection` (these are the wrong product)
- Add a `QuickStartSection` showing the API + CLI install flow
- Update `page.tsx` to compose the right sections in the right order

### Solution 2: New Section Composition from Scratch
**Effort:** High | **Risk:** Medium | **Time:** 3-5 days

Build entirely new sections with a fresh design direction. Only worthwhile if brand direction has changed significantly.

### Solution 3: Minimal Patch
**Effort:** Low | **Risk:** High | **Time:** 2-4 hours

Update only the hero copy to match the real product. Leave other sections in place even if misaligned. Creates a less coherent page but gets something more accurate live immediately. Use only if there's a time constraint.

---

## Security Considerations

- **No user data on homepage:** The marketing page should be fully static — no API calls, no auth, no session data. Ensure the `page.tsx` exports no `getServerSideProps` or dynamic data fetching.
- **Contact email exposure:** The current homepage directly renders `siteConfig.contactEmail` in mailto links. This is fine for a developer-facing product but be aware of spam scraping. Consider a contact form if volume becomes a problem.
- **External links:** All GitHub and external links should use `rel="noopener noreferrer"` — the existing components already do this correctly.
- **Content Security Policy:** Ensure Vercel's CSP headers don't break SMIL animations (`animateMotion` in `SystemArchitecture`) — SMIL is inline SVG and doesn't require extra CSP directives, but verify in production.

---

## Performance Considerations

- **LCP (Largest Contentful Paint):** The hero headline is the LCP element. Keep it as an `h1` with no image replacement. Avoid putting the headline inside a container that animates in (opacity 0 → 1 delays LCP detection). Consider using `initial={{ opacity: 1 }}` for the h1 and only animating supporting elements.
- **CLS (Cumulative Layout Shift):** The `ActivityFeedPanel` has a fixed height (`style={{ height: 370 }}`), which correctly prevents CLS. Maintain this pattern for any right-panel visual.
- **JavaScript budget:** The homepage should load under 150KB JS (gzipped). Check with `next build --debug` after changes. The `motion/react` dependency is shared across the app so its cost is already sunk.
- **Images:** Use `next/image` for any integration logos or screenshots. Set explicit `width` and `height` to prevent CLS.
- **Font loading:** The existing setup uses `font-mono` (system stack) and a custom display font. Ensure `font-display: swap` is set so text is visible before fonts load.

---

## Recommendation

**Use Solution 1 (Targeted Content Replacement) with the following section composition:**

```tsx
// apps/web/src/app/(marketing)/page.tsx
export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main>
        {/* 1. Hero — updated copy, split-panel with feedback loop visual */}
        <LoopHero />

        {/* 2. Integration logos — PostHog, GitHub, Sentry (trust without testimonials) */}
        <IntegrationsBar />

        {/* 3. How it works — the 5-step feedback loop */}
        <HowItWorksSection />

        {/* 4. Feature pillars — 4 real capabilities */}
        <LoopValueProps />

        {/* 5. Quick start — install + first API call */}
        <QuickStartSection />

        {/* 6. Bottom CTA */}
        <ContactSection />
      </main>
      <MarketingFooter />
      <MarketingNav />
    </>
  )
}
```

**Priority order for implementation:**
1. Update hero copy immediately — this is the highest-impact, lowest-risk change
2. Rewrite `LoopValueProps` with real product pillars
3. Rewrite `HowItWorksSection` with real flow (Signal → Issue → Score → Dispatch)
4. Add `IntegrationsBar` (reuse `CredibilityBar` component structure)
5. Remove or hide `SystemArchitecture`, `HonestySection`, `ProblemSection`
6. Add `QuickStartSection` with real CLI/API install flow
7. Update `metadata` in `page.tsx` for SEO
8. Update OG image copy to match new positioning

**The single most important copy decision:** the headline. "Close the feedback loop on AI-powered development" is specific, uses developer vocabulary ("feedback loop"), and maps to the exact product function. Resist the temptation to go more abstract ("The autonomous improvement engine") or more feature-specific ("Signal ingestion for AI agents"). The feedback loop concept is the product's core insight — put it front and center.

---

## Research Gaps and Limitations

- No direct competitor with the same positioning exists (Loop is genuinely novel in category), so all comparisons are from adjacent categories
- Conversion rate data for developer tool homepages is not publicly available for A/B test comparison
- The current GitHub star count for `dork-labs/loop` was not checked during research — this should be verified before including star counts in the homepage
- User interviews with target audience (teams using AI agents for development) would sharpen messaging significantly and should be prioritized post-launch

---

## Contradictions and Disputes

- **Minimal vs. educational:** There's a legitimate tension between "developers hate long pages" and "novel concepts need education." The recommendation resolves this by making each section extremely tight (3-5 lines max per section) rather than choosing one extreme.
- **Activity feed vs. diagram:** The `ActivityFeedHero` is more engaging and dynamic; a feedback loop diagram is more explanatory. The recommendation is to use the diagram for the hero visual and potentially keep the activity feed for a secondary section if the page needs more engagement.
- **"Coming Soon" eyebrow:** The current hero uses "Coming Soon" as the eyebrow. This should be removed immediately — the MVP is shipped. "Open source · MIT · MVP" or simply "Open source" is more accurate.

---

## Search Methodology

- Searches performed: 11
- Web pages fetched: 4
- Most productive search terms: "dev tool landing page best practices 2025", "markepear.dev hero section examples", "PostHog homepage structure open source positioning", "category creation B2D developer tool"
- Primary sources: Evil Martians analysis, markepear.dev examples gallery, SaaS Minds PostHog case study, LogRocket hero section analysis

---

## Sources

- [We studied 100 dev tool landing pages — here's what really works in 2025 (Evil Martians)](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025)
- [Dev tool landing page examples — markepear.dev](https://www.markepear.dev/examples/landing-page)
- [Dev tool hero section examples — markepear.dev](https://www.markepear.dev/examples/hero-section)
- [PostHog: The homepage that walks you through a realization (SaaS Minds)](https://www.saasminds.com/case-examples/posthog-the-homepage-that-walks-you-through-a-realization)
- [How PostHog Grows: The Power of Being Open-Core](https://www.howtheygrow.co/p/how-posthog-grows-the-power-of-being)
- [10 best hero section examples and what makes them effective (LogRocket)](https://blog.logrocket.com/ux-design/hero-section-examples-best-practices/)
- [SaaS Website Hero Section Best Practices (Tenet)](https://www.wearetenet.com/blog/saas-hero-section-best-practices)
- [7 SaaS Landing Page Best Practices for 2025 That Convert (Magic UI)](https://magicui.design/blog/saas-landing-page-best-practices)
- [Hero Section Design: Best Practices and Examples for 2026](https://www.perfectafternoon.com/2025/hero-section-design/)
- [Linear App Detailed Analysis (Creova)](https://creova.space/library/linear-app)
- [Framer Motion vs GSAP: Which Animation Library Should You Choose?](https://pentaclay.com/blog/framer-vs-gsap-which-animation-library-should-you-choose)
- [Master B2D Marketing: Key Strategies to Engage Developers](https://openstrategypartners.com/blog/master-b2d-marketing-key-strategies-for-engaging-developers/)
- [Category Creation Strategy and B2B SaaS Go-To-Market](https://www.t2d3.pro/learn/b2b-saas-go-to-market-strategy)
- [MightyBot 2025: The Year Agentic AI Became Real](https://www.mightybot.ai/blog/mightybot-2025-the-year-agentic-ai-became-real)
- [Next.js SEO Best Practices](https://webpeak.org/blog/nextjs-seo-practices-new-websites/)
- [Best Next.js Landing Page Layouts for High SaaS Conversions](https://www.zignuts.com/blog/nextjs-landing-page-layouts)
