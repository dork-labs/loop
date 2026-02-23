# Research: Icon Libraries & SVG Sources for Dev Tool Logos

**Date:** 2026-02-23
**Mode:** Deep Research
**Objective:** Evaluate icon library options for a Next.js 16 marketing website needing logos for PostHog, Sentry, Cursor, Claude Code (Anthropic), VS Code, GitHub, Linear, Slack, Vercel, Anthropic, and similar dev tools.

---

## Research Summary

Simple Icons (`simple-icons` / `@icons-pack/react-simple-icons`) is the strongest single source for dev tool brand logos, covering 10 of the 11 target tools in v16.x — with VS Code as the notable exception (removed under Microsoft legal pressure in June 2024). Slack was removed in v16.0.0 but can be sourced from v15.x or directly from Slack's brand kit. Cursor and Claude both have icons. The library uses CC0 (public domain) for its codebase but explicitly disclaims trademark responsibility, requiring per-brand due diligence for marketing use.

---

## Key Findings

### 1. Simple Icons Covers Most Target Tools

Simple Icons v16.x (currently v16.9.0 as of Feb 2026) contains confirmed icons for:
- GitHub (`github`) — confirmed present
- Vercel (`vercel`) — confirmed present
- Sentry (`sentry`) — confirmed present
- Linear (`linear`) — confirmed present
- PostHog (`posthog`) — confirmed present
- Anthropic (`anthropic`) — confirmed present
- Claude (`claude`) — confirmed present
- Cursor (`cursor`) — confirmed present

Missing from v16.x:
- VS Code / Visual Studio Code — removed in v13.0.0 (June 2024) due to Microsoft legal
- Slack — removed in v16.0.0 (latest major release) due to trademark review

### 2. VS Code and Slack Require Alternative Sources

Both were removed under legal/trademark pressure:
- VS Code: Microsoft's legal team in June 2024 restricted simple-icons to only Power Platform, Dynamics 365, Microsoft 365, and Azure. VS Code was removed in the accelerated v13.0.0 release.
- Slack: Removed as part of the 44-icon cull in v16.0.0. Available in v15.x.

### 3. All Target Tools Have Official Brand Asset Pages

Every tool on the list publishes brand assets (varying quality):
- Cursor: `cursor.com/brand` — SVGs available in 2D, 2.5D, 3D; downloadable asset pack
- Anthropic/Claude: Newsroom press kit at `anthropic.com/news` — "Download press kit" link
- PostHog: `posthog.com/handbook/company/brand-assets` — official handbook page with SVG guidance
- VS Code: `code.visualstudio.com/brand` — downloadable pack (PNG + SVG), with strict usage rules
- GitHub: `github.com/logos` — official logo policy and downloads
- Slack: `slack.com/brand-guidelines` (implied) — official brand kit

### 4. Trademark Risk Varies by Brand

VS Code has the most explicit restrictions: the official brand page prohibits using the icon to "identify or promote your own product, service, application." An integration showcase section falls in a legal grey area.

GitHub explicitly allows integration-context use: "you can use a permitted GitHub logo to inform others that your project integrates with GitHub."

Most other dev tools (Sentry, PostHog, Vercel, Linear) follow common SaaS norms: referential use for integrations is generally tolerated but technically requires permission.

---

## Detailed Analysis

### Simple Icons (Primary Recommendation)

**Package:** `simple-icons` (raw data) or `@icons-pack/react-simple-icons` (React components)

**Version:** 16.9.0 (as of Feb 2026)

**License:** CC0-1.0 (public domain) for the project itself. Individual icons are third-party trademarks; the project explicitly disclaims liability.

**Icon count:** ~3,364 icons

**Confirmed coverage for target tools (v16.x via CDN probe):**

| Tool | Slug | Status in v16 |
|---|---|---|
| GitHub | `github` | Present |
| Vercel | `vercel` | Present |
| Sentry | `sentry` | Present |
| Linear | `linear` | Present |
| PostHog | `posthog` | Present |
| Anthropic | `anthropic` | Present |
| Claude | `claude` | Present |
| Cursor | `cursor` | Present |
| VS Code | `visualstudiocode` | REMOVED (v13, June 2024) |
| Slack | `slack` | REMOVED (v16.0.0) |

**React/Next.js usage (`@icons-pack/react-simple-icons`):**

```bash
npm add @icons-pack/react-simple-icons
```

```tsx
import { SiGithub, SiVercel, SiSentry, SiLinear, SiPosthog, SiAnthropic, SiClaude, SiCursor } from '@icons-pack/react-simple-icons';

// Usage with default brand color:
<SiGithub color="default" size={24} />

// Usage with custom color:
<SiVercel color="#000000" size={24} />

// Usage with className (no color prop):
<SiSentry className="text-foreground" size={24} />
```

Icons are standard React components. In Next.js App Router, they work as Server Components (no `useState`/`useEffect` — they are pure render functions that return SVG JSX). No `'use client'` directive needed for static display.

**Alternative: `react-icons/si`**

The `react-icons` package bundles the simple-icons set under the `si` prefix:

```tsx
import { SiGithub, SiVercel } from 'react-icons/si';
```

This works identically but is updated less frequently. It also packages ~40 other icon sets, so the install is heavier. Only worthwhile if you also need non-brand icons (Lucide, FontAwesome, etc.) from the same dependency.

### Devicons

**Coverage:** Focused on programming languages and developer tooling. Confirmed to include VS Code, GitHub, Slack. Does NOT include PostHog, Sentry, Cursor, Anthropic, Claude, Linear, or Vercel.

**License:** MIT

**Verdict:** Not suitable as a primary source for this use case. Too focused on language/framework icons rather than SaaS product logos.

### Iconify

**Coverage:** Aggregates 200,000+ icons from 100+ icon sets, including the full simple-icons set.

**React usage:**
```bash
npm install --save-dev @iconify/react
```
```tsx
'use client'; // Required — Iconify React is client-only
import { Icon } from "@iconify/react";

<Icon icon="simple-icons:github" style={{ fontSize: "24px" }} />
<Icon icon="simple-icons:vercel" />
```

**Critical limitation:** `@iconify/react` does NOT support Next.js Server Components. It relies on `useState` internally, so it requires `'use client'`. The default mode fetches icon data from Iconify's external API at runtime, creating a CDN dependency. Offline/air-gapped builds or CDN outages will break icon rendering unless icon data is bundled explicitly.

**Iconify Unplugin** (newer approach): Generates icons at build time as SVG + CSS, supports Server Components, no runtime CDN dependency. More complex setup.

**Verdict:** Workable but adds client component complexity and CDN risk unless using the Unplugin. For a small fixed set of icons, it's over-engineered compared to `@icons-pack/react-simple-icons`.

---

## Gaps and Official Sources

### VS Code

**Gap:** Removed from simple-icons v13+ due to Microsoft legal action (June 2024).

**Official source:** `code.visualstudio.com/brand` — downloadable pack includes SVG. However, usage restrictions explicitly prohibit using it to "identify or promote your own product, service, application." An integration showcase on a marketing site likely violates these terms.

**Practical options:**
1. Source from `code.visualstudio.com/brand` and accept trademark risk (common in the industry)
2. Use a generic "editor" icon or text label instead
3. Pin `simple-icons@12` for VS Code specifically (slug: `visualstudiocode`) — technically the old CC0 licensed asset

**Recommendation:** Use the SVG from the official VS Code brand page. The "integrations with" use case falls under nominative fair use in most jurisdictions, and major SaaS companies routinely display VS Code's logo in integration pages without legal incident. Attribution text ("VS Code is a trademark of Microsoft Corporation") mitigates risk.

### Slack

**Gap:** Removed from simple-icons v16.0.0.

**Official source:** Slack maintains a brand asset page with downloadable SVGs.

**Practical options:**
1. Pin `simple-icons@15` for the Slack icon specifically, or copy the SVG from v15 into local assets
2. Download from Slack's official brand kit

**Recommendation:** Copy the SVG path from `simple-icons@15` into a local `/public/icons/slack.svg` or inline it as a React component. This is a one-time operation and avoids ongoing dependency on a pinned version.

---

## Library Coverage Matrix

| Tool | simple-icons v16 | devicons | Iconify (via SI) | react-icons/si |
|---|---|---|---|---|
| GitHub | Yes (`github`) | Yes | Yes | Yes |
| Vercel | Yes (`vercel`) | No | Yes | Yes |
| Sentry | Yes (`sentry`) | No | Yes | Yes |
| Linear | Yes (`linear`) | No | Yes | Yes |
| PostHog | Yes (`posthog`) | No | Yes | Yes |
| Anthropic | Yes (`anthropic`) | No | Yes | Yes |
| Claude | Yes (`claude`) | No | Yes | Yes |
| Cursor | Yes (`cursor`) | No | Yes | Yes |
| VS Code | NO (removed v13) | Yes | No (removed) | No (removed) |
| Slack | NO (removed v16) | Yes | No (removed) | Depends on version |

---

## Potential Solutions

### Option 1: `@icons-pack/react-simple-icons` + Manual SVGs for Gaps

**Description:** Install `@icons-pack/react-simple-icons` for the 8 covered tools; add VS Code and Slack as manually maintained SVG files in the project (inlined as React components).

**Coverage:** 10/11 via library, 2 via manual SVGs

**Pros:**
- Typed React components with tree-shaking
- CC0 license for library-covered icons
- Works as Server Components in Next.js App Router
- Brand colors available via `SiGithubHex`, etc.
- No CDN dependency — icons are bundled at build time
- Auto-updates when you upgrade the package

**Cons:**
- Two gaps require manual SVG maintenance
- VS Code usage carries trademark nuance
- Not all icons may have perfect brand accuracy

**Complexity:** Low
**Maintenance:** Low (manual SVGs rarely change; library auto-updates on `npm update`)

### Option 2: `react-icons` (si set)

**Description:** Use the `si` set from `react-icons` which mirrors simple-icons.

**Pros:**
- Familiar package many React devs already use
- Single dependency for all icon types

**Cons:**
- Heavier package (all icon sets bundled, even with tree-shaking)
- Updated less frequently than `@icons-pack/react-simple-icons`
- Same gaps as simple-icons (VS Code, Slack removed)

**Complexity:** Low
**Maintenance:** Low

### Option 3: Inline SVG components (self-contained)

**Description:** Copy SVG paths for each brand into dedicated React component files. No external dependency.

**Pros:**
- Zero external dependency risk
- Full control over SVG optimization (run through SVGO)
- Works as Server Components
- Immune to library version churn

**Cons:**
- Initial setup effort (11 SVG files to source and clean)
- Must manually track brand updates
- No automatic updates when brands rebrand

**Complexity:** Low (upfront), Medium (long-term)
**Maintenance:** Medium (manual brand tracking)

### Option 4: Iconify with bundled icons (Unplugin)

**Description:** Use `@iconify/react` with local icon data pre-bundled at build time.

**Pros:**
- Access to full Iconify ecosystem
- Build-time generation means no runtime CDN calls

**Cons:**
- More complex build configuration
- Larger learning curve
- Still requires manual handling for VS Code and Slack (removed from simple-icons set)

**Complexity:** High
**Maintenance:** Medium

---

## Licensing Considerations

### CC0 (Simple Icons project license)

CC0 is the most permissive open-source license — equivalent to public domain. It grants unconditional rights for commercial, advertising, and promotional use. The simple-icons project itself is CC0, but this does NOT transfer to the trademark rights of the logos contained within.

### Trademark vs. Copyright

This is the critical distinction:

- **Copyright** (CC0 resolves this): The vector drawing/path data of the icon
- **Trademark** (not resolved by CC0): The brand's exclusive right to its identifying marks

Simple Icons' DISCLAIMER.md is explicit: "Simple Icons cannot be held responsible for any legal activity raised by a brand. We ask that our users seek the correct permissions."

### Practical Risk Assessment by Brand

| Brand | Integration Use Risk | Notes |
|---|---|---|
| GitHub | Low | Explicitly allows integration context use at `github.com/logos` |
| Vercel | Low | Very developer-friendly; integration pages common |
| Linear | Low | Developer tool, no known enforcement |
| PostHog | Low | Open-source company; explicitly provides brand assets |
| Sentry | Low-Medium | Policy says prior written consent technically required; common in practice |
| Cursor | Low | Developer tool, brand page provides assets for "consistent representation" |
| Anthropic/Claude | Low | Press kit available; standard tech company policy |
| VS Code | Medium | Most restrictive — explicit prohibition on promotional use; covered by nominative fair use in practice |
| Slack | Medium | Removed from simple-icons; Slack has stricter brand enforcement than typical dev tools |

**General guidance:** For an "integrations" or "works with" section on a marketing website, nominative fair use doctrine in the US (and equivalents elsewhere) permits third parties to reference a brand's trademark to accurately describe the relationship between products. Best practice is to include a trademark acknowledgment footnote.

---

## Security Considerations

### CDN Dependency Risk

**`@icons-pack/react-simple-icons`:** No CDN risk. Icons are npm dependencies bundled at build time. No runtime external requests.

**`@iconify/react` (default mode):** HIGH risk. Icons are fetched from `api.iconify.design` at runtime. CDN outage = broken icons in production. Also exposes your users' browsing behavior to a third-party API.

**Iconify with offline data:** CDN risk eliminated, but requires additional bundle configuration.

**Recommendation:** Always prefer build-time bundled approaches (`@icons-pack/react-simple-icons` or inline SVG) over runtime CDN fetches for production marketing sites.

### Supply Chain

`simple-icons` has 75+ dependents and is maintained by a small community. Monitor for any major version changes (each major version has historically removed 40-50 icons). Pin to a major version (`@icons-pack/react-simple-icons@^16`) rather than `latest` to avoid surprise removals.

---

## Performance Considerations

### Bundle Size

`@icons-pack/react-simple-icons` is tree-shakeable. Only imported icons are included in the bundle. A component that imports 10 icons will add roughly 10–30KB to the bundle (primarily SVG path data, which compresses well).

For 11 logos on a marketing page:
- Estimate: ~15–40KB uncompressed SVG data
- Gzipped: ~3–8KB — negligible

### Next.js App Router Optimization

**Server Components (recommended):** Static logo display requires no interactivity. These icons can and should be rendered as Server Components. The icon SVG is emitted as static HTML at build time (with static rendering) or at request time (with dynamic rendering). Zero client JavaScript added.

```tsx
// app/integrations/page.tsx — Server Component, no 'use client' needed
import { SiGithub, SiVercel, SiPosthog } from '@icons-pack/react-simple-icons';

export default function IntegrationsPage() {
  return (
    <div>
      <SiGithub size={32} />
      <SiVercel size={32} />
      <SiPosthog size={32} />
    </div>
  );
}
```

**SVG Optimization:** Run SVGs through SVGO before manual inlining (for VS Code, Slack). The simple-icons project pre-optimizes all its SVGs with SVGO — no additional processing needed for library icons.

**Static Export:** If the site uses `output: 'export'` (static HTML), all of the above approaches work without modification.

---

## Implementation Approach for Next.js 16

### Recommended Setup

**Step 1: Install the library**
```bash
npm add @icons-pack/react-simple-icons
```

**Step 2: Create a centralized icon component**
```tsx
// apps/web/src/components/brand-icons.tsx
import {
  SiGithub,
  SiVercel,
  SiSentry,
  SiLinear,
  SiPosthog,
  SiAnthropic,
  SiClaude,
  SiCursor,
} from '@icons-pack/react-simple-icons';
import type { ComponentProps } from 'react';

// Re-export all library icons
export { SiGithub, SiVercel, SiSentry, SiLinear, SiPosthog, SiAnthropic, SiClaude, SiCursor };

// Add manual SVGs for gaps (VS Code, Slack)
export function VsCodeIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      role="img"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Visual Studio Code</title>
      {/* Paste optimized SVG path from official VS Code brand kit */}
    </svg>
  );
}

export function SlackIcon({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      role="img"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Slack</title>
      {/* Paste SVG path from simple-icons v15 or official Slack brand kit */}
    </svg>
  );
}
```

**Step 3: Use in a Server Component**
```tsx
// apps/web/src/components/integrations-grid.tsx
// No 'use client' needed for static display
import { SiGithub, SiPosthog, VsCodeIcon, SlackIcon } from '@/components/brand-icons';

const INTEGRATIONS = [
  { name: 'GitHub', Icon: SiGithub, color: '#181717' },
  { name: 'PostHog', Icon: SiPosthog, color: '#F54E00' },
  { name: 'VS Code', Icon: VsCodeIcon, color: '#007ACC' },
  { name: 'Slack', Icon: SlackIcon, color: '#4A154B' },
];

export function IntegrationsGrid() {
  return (
    <div className="grid grid-cols-4 gap-8">
      {INTEGRATIONS.map(({ name, Icon, color }) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <Icon size={40} color={color} />
          <span className="text-sm">{name}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## Recommendation

**Recommended Approach: Option 1 — `@icons-pack/react-simple-icons` + manual SVGs for VS Code and Slack**

**Rationale:**
1. `@icons-pack/react-simple-icons` covers 8/10 needed tools with typed, tree-shakeable React components
2. Icons are build-time bundled — no CDN dependency, no runtime risk
3. Works natively as Next.js Server Components — no `'use client'` needed for static display
4. CC0 license removes copyright concerns; trademark risk for integration showcase use is low for most brands
5. Manual SVG maintenance for VS Code and Slack is a one-time ~30-minute task, not an ongoing burden
6. The dedicated package (`@icons-pack/react-simple-icons`) tracks `simple-icons` releases more faithfully than `react-icons/si`

**Caveats:**
- VS Code icon usage technically violates Microsoft's brand guidelines for promotional contexts. In practice, nominative fair use and the near-universal industry norm of displaying VS Code in integration pages makes enforcement unlikely. Add a trademark footnote to be safe.
- Slack's removal from simple-icons v16 is permanent. Source its SVG path from v15 (`cdn.jsdelivr.net/npm/simple-icons@15/icons/slack.svg`) and inline it permanently into the codebase.
- Monitor `simple-icons` major version releases — each major version historically removes 40-50 icons. Pin to `@icons-pack/react-simple-icons@^16` (or whatever is current) and review release notes before upgrading to a new major.

---

## Research Gaps and Limitations

- Could not directly access `simpleicons.org` (renders via WASM, not crawlable). CDN probing was used instead to confirm icon presence.
- Slack's exact removal reason from v16 was not definitively confirmed (trademark review implied). The v15 SVG is available and functionally identical.
- PostHog's official brand handbook page was not renderable via crawler (CSS-only response). Coverage confirmed via CDN probe and shadcn.io icon reference.
- Specific trademark risk levels for Vercel, Linear, Cursor brand logo use are inferred from general SaaS norms, not from confirmed brand policy pages.

---

## Search Methodology

- Searches performed: ~25
- CDN probes performed: ~12 (confirming icon presence at `cdn.jsdelivr.net/npm/simple-icons@16/icons/{slug}.svg`)
- Key search terms: `simple-icons coverage`, `@icons-pack/react-simple-icons`, `simple-icons removed v16`, `Microsoft icons removal`, `Cursor brand guidelines`, `Anthropic press kit`, `PostHog brand assets`, `VS Code brand guidelines`, `iconify react server component`, `SVG Next.js App Router`
- Primary sources: simple-icons GitHub releases, CDN direct probes, official brand pages (cursor.com/brand, code.visualstudio.com/brand, anthropic.com/news), iconify.design docs

---

## Sources

- [GitHub - simple-icons/simple-icons](https://github.com/simple-icons/simple-icons)
- [simple-icons Release v16.0.0 (44 removed)](https://github.com/simple-icons/simple-icons/releases/tag/16.0.0)
- [simple-icons Release v16.8.0](https://github.com/simple-icons/simple-icons/releases/tag/16.8.0)
- [simple-icons DISCLAIMER.md](https://github.com/simple-icons/simple-icons/blob/master/DISCLAIMER.md)
- [Removal: All Microsoft Icons - Issue #11236](https://github.com/simple-icons/simple-icons/issues/11236)
- [Great Icon Review 2025 [A] - Issue #12378](https://github.com/simple-icons/simple-icons/issues/12378)
- [GitHub - icons-pack/react-simple-icons](https://github.com/icons-pack/react-simple-icons)
- [@icons-pack/react-simple-icons on npm](https://www.npmjs.com/package/@icons-pack/react-simple-icons)
- [Iconify for React - official docs](https://iconify.design/docs/icon-components/react/)
- [Devicon website](https://devicon-website.vercel.app/)
- [Cursor Brand Guidelines](https://cursor.com/brand)
- [Visual Studio Code Brand Guidelines](https://code.visualstudio.com/brand)
- [GitHub Logo Policy](https://docs.github.com/en/site-policy/other-site-policies/github-logo-policy)
- [GitHub Brand Toolkit](https://brand.github.com/)
- [Anthropic Newsroom (press kit)](https://anthropic.com/news)
- [PostHog Brand Assets Handbook](https://posthog.com/handbook/company/brand-assets)
- [Sentry Logo/Trademark Use Policy](https://sentry.zendesk.com/hc/en-us/articles/22883682250651-Logo-trademark-use-for-Sentry-organisations)
- [Iconify Updates 2025](https://iconify.design/news/2025.html)
- [How to import SVGs into Next.js apps - LogRocket](https://blog.logrocket.com/import-svgs-next-js-apps/)
- [Turbopack: A Better Way to Inline SVG in Next.js 16 - DEV Community](https://dev.to/vitalets/turbopack-a-better-way-to-inline-svg-in-nextjs-16-36em)
- [Iconify iconbuddy — Anthropic icon](https://iconbuddy.com/simple-icons/anthropic)
- [PostHog simple-icons confirmation via shadcn.io](https://www.shadcn.io/icon/simple-icons-posthog)
