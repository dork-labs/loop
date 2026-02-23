---
slug: fix-third-party-logos
number: 19
created: 2026-02-23
status: ideation
---

# Fix Third-Party Logos on Marketing Website

**Slug:** fix-third-party-logos
**Author:** Claude Code
**Date:** 2026-02-23
**Branch:** preflight/fix-third-party-logos
**Related:** N/A

---

## 1) Intent & Assumptions

- **Task brief:** The marketing website (`apps/web/`) displays 11 custom hand-drawn SVG logos for third-party tools (PostHog, GitHub, Sentry, Cursor, VS Code, Claude Code, Windsurf, Codex CLI, OpenHands, Goose, Gemini CLI) instead of their official logos. These need to be replaced with accurate, official logos sourced from a free icon library or official brand kits.
- **Assumptions:**
  - The visual design stays monochrome (warm-gray `#7A756A`) to match the existing Calm Tech design system — user confirmed this
  - All logos remain 40×40px inline SVGs (no size/layout changes)
  - We prefer a bundled library approach (no CDN at runtime) for reliability and performance
  - Trademark/fair use: "integration showcase" context is industry-standard nominative fair use for all these tools
- **Out of scope:**
  - Changing the design system or color scheme
  - Adding new integration logos not already shown
  - Replacing the Loop brand logos (`/public/images/dorkian-logo.svg`)
  - Any changes to `apps/api/` or `apps/app/`

---

## 2) Pre-reading Log

- `apps/web/package.json`: lucide-react v0.556.0 is the only icon library installed; no simple-icons or react-icons present
- `apps/web/src/layers/features/marketing/ui/IntegrationsBar.tsx`: Contains 3 custom hand-drawn logo components (PostHog, GitHub, Sentry) plus the `INTEGRATIONS` array that references them
- `apps/web/src/layers/features/marketing/lib/agents.tsx`: Contains 8 custom hand-drawn logo components (Cursor, VS Code, Claude Code, Windsurf, Codex CLI, OpenHands, Goose, Gemini CLI) plus the `AGENTS` array
- `apps/web/src/layers/features/marketing/ui/AgentGrid.tsx`: Imports `AGENTS`, renders Logo components — indirect blast radius
- `apps/web/src/layers/features/marketing/ui/AgentSetupSection.tsx`: Imports `AGENTS`, renders Logo components — indirect blast radius
- `apps/web/src/layers/features/marketing/ui/AgentPlatforms.tsx`: Imports `AGENTS`, renders first 6 — indirect blast radius (homepage)
- `apps/web/src/app/(marketing)/page.tsx`: Imports `AgentPlatforms` — shows on homepage
- `apps/web/src/app/(marketing)/integrations/page.tsx`: Imports `AgentGrid` + `AgentSetupSections` — shows on integrations page
- `research/20260223_icon_libraries_dev_tools.md`: Research agent output with full library coverage matrix and implementation guidance

---

## 3) Codebase Map

**Primary Components/Modules:**

- `apps/web/src/layers/features/marketing/ui/IntegrationsBar.tsx` — Contains `PostHogLogo`, `GitHubLogo`, `SentryLogo` components + `INTEGRATIONS` array
- `apps/web/src/layers/features/marketing/lib/agents.tsx` — Contains `CursorLogo`, `VSCodeLogo`, `ClaudeCodeLogo`, `WindsurfLogo`, `CodexCLILogo`, `OpenHandsLogo`, `GooseLogo`, `GeminiCLILogo` components + `AGENTS` array

**Shared Dependencies (indirect, no changes needed):**

- `apps/web/src/layers/features/marketing/ui/AgentGrid.tsx` — consumes `AGENTS[].Logo`
- `apps/web/src/layers/features/marketing/ui/AgentSetupSection.tsx` — consumes `AGENTS[].Logo`
- `apps/web/src/layers/features/marketing/ui/AgentPlatforms.tsx` — consumes `AGENTS[].Logo` (first 6)

**Data Flow:**
Logo defined in `IntegrationsBar.tsx` / `agents.tsx` → referenced in `INTEGRATIONS`/`AGENTS` arrays → rendered by `AgentGrid`, `AgentSetupSection`, `AgentPlatforms`, `IntegrationsBar`

**Feature Flags/Config:** None

**Potential Blast Radius:**
- **Direct (2 files):** `IntegrationsBar.tsx`, `agents.tsx` — all logo components live here
- **Indirect (3 files, no changes needed):** `AgentGrid.tsx`, `AgentSetupSection.tsx`, `AgentPlatforms.tsx` — just consume the Logo components
- **Pages affected:** Homepage and `/integrations`
- **Tests:** No test files identified for these marketing components

---

## 4) Root Cause Analysis

- **Observed vs Expected:** 11 logo slots display custom geometric approximations (e.g. a bracket shape for VS Code, an arrow cursor for Cursor, a hedgehog sketch for PostHog) instead of the actual official brand logos
- **Root cause:** All logos were hand-authored as inline SVG components instead of sourcing official assets from an icon library or brand kit. This is a content/asset problem, not a code architecture problem.
- **Evidence:**
  - `CursorLogo()` renders a simple arrow pointer — Cursor's actual logo is a stylized cursor with a distinctive slash design
  - `PostHogLogo()` renders a hedgehog outline — PostHog's actual logo uses a specific hedgehog mark
  - `VSCodeLogo()` renders abstract bracket shapes — VS Code has a distinct infinity-fold icon
- **Decision:** Replace all 11 inline SVG paths with official logos. Source from `@icons-pack/react-simple-icons` where available, use official brand kit SVGs for gaps.

---

## 5) Research

### Library Coverage Matrix

| Tool | `@icons-pack/react-simple-icons` v16 | Notes |
|------|--------------------------------------|-------|
| PostHog | ✅ `SiPosthog` | Official |
| GitHub | ✅ `SiGithub` | Official |
| Sentry | ✅ `SiSentry` | Official |
| Cursor | ✅ `SiCursor` | Official |
| Anthropic / Claude | ✅ `SiAnthropic`, `SiClaude` | Claude = the AI assistant logo |
| Gemini (CLI) | ✅ `SiGooglegemini` | Google Gemini |
| VS Code | ❌ Removed v13 (Jun 2024) | Microsoft legal; source from code.visualstudio.com/brand |
| Windsurf | ❌ Not in library | New tool; source from Codeium/Windsurf brand page |
| Codex CLI | ❌ Not in library | OpenAI tool; OpenAI logo (`SiOpenai`) may be acceptable substitute |
| OpenHands | ❌ Not in library | Source from All-Hands-AI GitHub |
| Goose | ❌ Not in library | Block's AI agent; source from block.github.io/goose |

### Potential Solutions

**1. `@icons-pack/react-simple-icons` + manual inline SVGs for gaps (Recommended)**
- Description: Install the React wrapper for simple-icons (CC0 licensed); add VS Code, Windsurf, OpenHands, Goose as locally-maintained inline SVG components sourced from official brand kits
- Pros: Bundled at build time (no CDN), tree-shakeable, Server Component compatible, typed, zero runtime JS overhead, easy to add more in future
- Cons: 4 manual SVGs still needed; must pin to `^16` and review before major upgrades
- Complexity: Low
- Maintenance: Low

**2. All inline SVG components (zero dependency)**
- Description: Source all 11 official SVG paths manually and store them as React components in the codebase
- Pros: No external dependency; no risk from library version changes
- Cons: All 11 must be sourced and verified manually; brand changes require manual updates
- Complexity: Low (upfront), Medium (long-term)
- Maintenance: Medium

**3. `react-icons` (si set)**
- Description: The popular multi-set icon package includes simple-icons under the `Si` prefix
- Coverage: Same gaps as simple-icons (no VS Code, no niche tools)
- Pros: Single familiar dependency
- Cons: Heavier bundle; updated less frequently; same coverage gaps
- Complexity: Low
- Maintenance: Low

**4. Iconify (bundled mode)**
- Description: Use `@iconify/react` with Iconify Unplugin for build-time icon bundling
- Pros: Access to 200k+ icons if ever needed
- Cons: CDN risk in default mode; Unplugin adds Next.js config complexity; major overkill for 11 static logos
- Complexity: High
- Maintenance: Medium

### Recommendation

**Recommended Approach:** `@icons-pack/react-simple-icons` + 4 manual inline SVGs

**Rationale:** Covers 7 of 11 logos from a well-maintained, CC0-licensed library. The 4 gaps (VS Code, Windsurf, OpenHands, Goose) are sourced once from official brand kits and stored as local SVG React components — a one-time 30-minute task. All icons remain Server Component compatible with no runtime fetching.

**Caveats:**
- Pin to `@icons-pack/react-simple-icons@^16` — major versions have historically removed 40–50 icons
- For VS Code: official brand guidelines technically restrict promotional use, but nominative "integrates with" context is standard industry practice; include no trademark attribution in the code
- For Claude Code specifically: use `SiClaude` (Claude logo) rather than `SiAnthropic` — Claude Code is Claude's CLI, so the Claude mark is more accurate
- Codex CLI: evaluate whether to use `SiOpenai` (the parent company mark) or source a specific Codex icon — if none exists, `SiOpenai` is acceptable as the parent brand

### Official SVG Sources for Gap Tools

| Tool | Source |
|------|--------|
| VS Code | https://code.visualstudio.com/brand → downloadable SVG pack |
| Windsurf | https://codeium.com/windsurf → brand/press page |
| OpenHands | https://github.com/All-Hands-AI/OpenHands → README/assets |
| Goose | https://block.github.io/goose → brand assets |

---

## 6) Clarifications & Decisions

1. **Color treatment:** Keep monochrome warm-gray `#7A756A` to match the existing Calm Tech design system (no official brand colors)

**Open questions:** None
