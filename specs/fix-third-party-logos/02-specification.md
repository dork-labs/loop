---
slug: fix-third-party-logos
number: 19
created: 2026-02-23
status: draft
---

# Specification: Fix Third-Party Logos on Marketing Website

**Status:** Draft
**Author:** Claude Code
**Date:** 2026-02-23
**Ideation:** [01-ideation.md](./01-ideation.md)

---

## Overview

The marketing website (`apps/web/`) currently renders all third-party integration logos as custom hand-drawn inline SVG components — geometric approximations that do not match the official brand marks. This creates a trust and professionalism problem on the integrations showcase page and homepage, where visitors need to immediately recognize the tools they use.

This spec replaces all 11 custom logo components with official logos sourced from `@icons-pack/react-simple-icons` (where available) and official brand kits (for the remaining 4). All logos continue to render in the existing monochrome warm-gray palette (`#7A756A`) to preserve the Calm Tech design language.

---

## Background / Problem Statement

When spec `marketing-site-agent-integration` was implemented, 11 third-party tool logos were created as geometric hand-drawn SVGs rather than sourced from official assets. Examples:

- **PostHog**: renders as a basic hedgehog sketch (circles, lines) instead of the PostHog hedgehog wordmark
- **Cursor**: renders as a simple arrow pointer instead of the distinctive Cursor slash-cursor mark
- **VS Code**: renders as abstract bracket shapes instead of the VS Code infinity-fold icon

Visitors landing on `/integrations` or the homepage's agent platforms section will not recognize these logos. This undermines the credibility of the integration showcase.

---

## Goals

- Replace all 11 custom hand-drawn logos with official brand SVG marks
- Maintain visual consistency: monochrome `#7A756A` on all logos, 40×40px
- Use a bundled icon library (no CDN runtime dependency)
- Keep all consuming components (`AgentGrid`, `AgentSetupSection`, `AgentPlatforms`, `IntegrationsBar`) unchanged — the `Logo: FC<{ className?: string }>` prop interface is preserved

---

## Non-Goals

- Switching to official brand colors (monochrome treatment is a deliberate design decision)
- Adding new integration logos not already shown
- Changing the size or layout of the logo display areas
- Modifying `apps/api/` or `apps/app/`
- Replacing Loop brand assets (`/public/images/dorkian-logo.svg`)

---

## Technical Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `@icons-pack/react-simple-icons` | `^16.x` | Official SVG brand logos for 7 of 11 tools |
| Official brand kit SVGs | N/A (one-time fetch) | Remaining 4 tools: VS Code, Windsurf, OpenHands, Goose |

**Why `@icons-pack/react-simple-icons` over alternatives:**
- Fully bundled at build time — no CDN calls
- Tree-shakeable ESM: only the imported icons ship to the client
- Compatible with Next.js App Router Server Components (no `'use client'` required)
- CC0-licensed icon data (simple-icons upstream)
- Typed: each icon is a named export (`SiPosthog`, `SiGithub`, etc.)

**VS Code notice:** VS Code was removed from simple-icons v13.0.0 (June 2024) due to Microsoft legal action. The official SVG must be sourced from https://code.visualstudio.com/brand — usage in an "integrates with" context constitutes nominative fair use.

---

## Logo Sourcing Map

### From `@icons-pack/react-simple-icons` (7 logos)

| Tool | Component | Brand |
|---|---|---|
| PostHog | `SiPosthog` | PostHog |
| GitHub | `SiGithub` | GitHub |
| Sentry | `SiSentry` | Sentry |
| Cursor | `SiCursor` | Cursor |
| Claude Code | `SiClaude` | Anthropic / Claude |
| Codex CLI | `SiOpenai` | OpenAI (parent brand) |
| Gemini CLI | `SiGooglegemini` | Google |

### Manual SVGs from official brand kits (4 logos)

| Tool | Source URL | Notes |
|---|---|---|
| VS Code | https://code.visualstudio.com/brand | Download the SVG logo pack; use the standalone mark (not the wordmark) |
| Windsurf | https://codeium.com/windsurf | Brand/press page; use the wave/surf mark |
| OpenHands | https://github.com/All-Hands-AI/OpenHands | Repository `docs/` or `assets/` directory |
| Goose | https://block.github.io/goose | Brand assets page |

---

## Technical Design

### Component API (unchanged)

The `Logo` prop interface on `AgentPlatform` remains unchanged:

```typescript
/** SVG component rendered inline — monochrome warm-gray, 40x40. */
Logo: FC<{ className?: string }>;
```

All new logo components must satisfy this interface.

### Rendering Pattern for `@icons-pack/react-simple-icons`

The `Si*` components accept a `color` prop (hex string) that overrides the default brand color. Pass `#7A756A` to achieve the monochrome treatment:

```tsx
import { SiPosthog } from '@icons-pack/react-simple-icons';

function PostHogLogo({ className }: { className?: string }) {
  return <SiPosthog color="#7A756A" size={40} className={className} />;
}
```

### Rendering Pattern for Manual SVGs

For the 4 tools sourced from official brand kits, wrap the SVG path in a standard React component using `fill="currentColor"` + a wrapper `div`/`span` with `color: #7A756A`:

```tsx
function VSCodeLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 100 100"  // adjust to actual viewBox from brand kit
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Visual Studio Code"
      role="img"
      className={className}
    >
      {/* Paste path(s) from official brand SVG, change fill/stroke values to #7A756A */}
      <path fill="#7A756A" d="..." />
    </svg>
  );
}
```

**Monochrome conversion rule:** Replace all color fills/strokes in the official SVG with `#7A756A`. For multi-tone logos with a dark/light split (e.g., VS Code), use `#7A756A` for the dominant mark and `#F5F0E8` (the existing background accent) for the lighter element.

### File Changes

#### 1. `apps/web/package.json`

Add to `dependencies`:
```json
"@icons-pack/react-simple-icons": "^16.0.0"
```

#### 2. `apps/web/src/layers/features/marketing/ui/IntegrationsBar.tsx`

Replace the three custom logo functions (`PostHogLogo`, `GitHubLogo`, `SentryLogo`) with imports from `@icons-pack/react-simple-icons`:

```tsx
import { SiPosthog, SiGithub, SiSentry } from '@icons-pack/react-simple-icons';

const ICON_COLOR = '#7A756A' as const;
const ICON_SIZE = 40;

function PostHogLogo() {
  return <SiPosthog color={ICON_COLOR} size={ICON_SIZE} />;
}

function GitHubLogo() {
  return <SiGithub color={ICON_COLOR} size={ICON_SIZE} />;
}

function SentryLogo() {
  return <SiSentry color={ICON_COLOR} size={ICON_SIZE} />;
}
```

The `INTEGRATIONS` array and all downstream JSX remain unchanged.

#### 3. `apps/web/src/layers/features/marketing/lib/agents.tsx`

Replace the eight custom logo functions with a mix of library imports and manual SVG components:

```tsx
import {
  SiCursor,
  SiClaude,
  SiOpenai,
  SiGooglegemini,
} from '@icons-pack/react-simple-icons';

const ICON_COLOR = '#7A756A' as const;
const ICON_SIZE = 40;

// From @icons-pack/react-simple-icons:
function CursorLogo({ className }: { className?: string }) {
  return <SiCursor color={ICON_COLOR} size={ICON_SIZE} className={className} />;
}

function ClaudeCodeLogo({ className }: { className?: string }) {
  return <SiClaude color={ICON_COLOR} size={ICON_SIZE} className={className} />;
}

function CodexCLILogo({ className }: { className?: string }) {
  return <SiOpenai color={ICON_COLOR} size={ICON_SIZE} className={className} />;
}

function GeminiCLILogo({ className }: { className?: string }) {
  return <SiGooglegemini color={ICON_COLOR} size={ICON_SIZE} className={className} />;
}

// Manual SVGs (paths sourced from official brand kits):
function VSCodeLogo({ className }: { className?: string }) {
  // SVG path from: https://code.visualstudio.com/brand
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 100 100" /* adjust */ ...>
      {/* official path, fill="#7A756A" */}
    </svg>
  );
}

function WindsurfLogo({ className }: { className?: string }) {
  // SVG path from: https://codeium.com/windsurf
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="..." ...>
      {/* official path, fill="#7A756A" */}
    </svg>
  );
}

function OpenHandsLogo({ className }: { className?: string }) {
  // SVG path from: https://github.com/All-Hands-AI/OpenHands
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="..." ...>
      {/* official path, fill="#7A756A" */}
    </svg>
  );
}

function GooseLogo({ className }: { className?: string }) {
  // SVG path from: https://block.github.io/goose
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="..." ...>
      {/* official path, fill="#7A756A" */}
    </svg>
  );
}
```

The `AGENTS` array and all downstream JSX remain unchanged.

### No Changes Required

These files consume the `Logo` prop but do not define or render SVG paths directly — they require no changes:
- `AgentGrid.tsx`
- `AgentSetupSection.tsx`
- `AgentPlatforms.tsx`

---

## User Experience

**Before:** Visitors on the homepage and `/integrations` page see unrecognizable geometric shapes where tool logos should appear. A developer visiting the page may not recognize "an arrow" as Cursor, or "bracket shapes" as VS Code.

**After:** All 11 logo slots render the actual official brand marks at 40×40px in warm-gray monochrome. Visitors instantly recognize the tools they use. Visual consistency is preserved — the monochrome treatment ensures logos feel native to the design rather than mismatched brand-color blobs.

---

## Testing Strategy

This change is entirely visual / asset replacement with no logic changes. No unit or integration tests are required for the logo components themselves.

**Manual verification checklist:**

1. Start `pnpm run dev` and open `http://localhost:5666` (web app)
2. Homepage — scroll to "Agent Platforms" section — verify all 6 agent logos render correctly
3. Navigate to `/integrations` — verify all 8 agent logos render correctly in the grid
4. Navigate to `/integrations` — scroll down to signal integrations section — verify PostHog, GitHub, Sentry logos render correctly
5. Inspect each logo visually and compare to the official brand mark

**Visual regression (optional):** If the project has Playwright or Chromatic configured, run a visual snapshot after the change.

---

## Performance Considerations

- `@icons-pack/react-simple-icons` is tree-shakeable: only the 7 imported `Si*` components are bundled. The full library (~3 MB) does not ship.
- Each `Si*` component adds roughly 1–5 KB uncompressed (optimized SVG path data). Total addition: ~15–35 KB uncompressed, ~3–7 KB gzipped across 7 components — negligible.
- Manual SVGs are inlined as React components: zero additional HTTP requests, zero runtime overhead.
- All logo components are stateless and render as Server Components in Next.js App Router (no `'use client'` needed).

---

## Security Considerations

- No CDN dependency: `@icons-pack/react-simple-icons` bundles all SVG data at build time. There is no runtime fetch to an external CDN that could fail or be hijacked.
- SVG paths from official brand kits should be reviewed before inlining to ensure they contain no `<script>` tags, `xlink:href`, or other unexpected elements (standard SVG logos never contain these — it is a good sanity check).
- No user-supplied data is involved in any logo rendering path.

---

## Documentation

No documentation updates required. The change is purely visual.

---

## Implementation Phases

### Phase 1: Library logos (lower-risk)

1. Install `@icons-pack/react-simple-icons` in `apps/web/`
2. Replace the 3 logos in `IntegrationsBar.tsx` (PostHog, GitHub, Sentry) — these use library components only
3. Replace the 4 library-sourced logos in `agents.tsx` (Cursor, Claude Code, Codex CLI, Gemini CLI)
4. Verify visually

### Phase 2: Manual SVGs (requires asset sourcing)

5. Download official SVG marks from the 4 brand kit sources (VS Code, Windsurf, OpenHands, Goose)
6. Convert fills/strokes to `#7A756A` monochrome
7. Replace the 4 remaining custom components in `agents.tsx`
8. Verify visually

---

## Open Questions

None. All decisions resolved in ideation:
- Color treatment: monochrome `#7A756A` (confirmed by user)
- Library choice: `@icons-pack/react-simple-icons` (per research recommendation)
- VS Code legal: nominative fair use in "integrates with" context is standard industry practice

---

## Related ADRs

No existing ADRs directly cover this change. It is a content/asset fix with no architectural implications.

---

## References

- Ideation document: `specs/fix-third-party-logos/01-ideation.md`
- Research notes: `research/20260223_icon_libraries_dev_tools.md`
- `@icons-pack/react-simple-icons`: https://github.com/icons-pack/react-simple-icons
- simple-icons upstream: https://simpleicons.org
- VS Code brand assets: https://code.visualstudio.com/brand
- Windsurf brand: https://codeium.com/windsurf
- OpenHands assets: https://github.com/All-Hands-AI/OpenHands
- Goose assets: https://block.github.io/goose
