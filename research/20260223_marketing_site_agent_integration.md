# Marketing Site Agent Integration — Research Report

**Feature slug**: marketing-site-agent-integration
**Date**: 2026-02-23
**Research depth**: Deep
**Searches performed**: 16
**Sources**: 20+ high-quality sources

---

## Research Summary

Developer tool companies are converging on a common set of patterns for marketing agent integration: deeplink buttons for one-click IDE installation (Cursor uses `cursor://`, VS Code uses `vscode:`, Claude Code uses CLI commands), tabbed code snippets per agent/method, and hub-and-spoke integration pages that lead to per-agent detail pages. The `cursor://` and `vscode:` deeplinks are well-documented; a first-party `claude://` deeplink does not yet exist — Claude Code uses `claude mcp add` CLI commands instead. The `npx add-mcp` tool has emerged as a universal cross-agent installer that Vercel, Neon, and others now recommend as a first-class option.

---

## Key Findings

### 1. Deeplink Protocol Status (as of Feb 2026)

| Agent | Protocol | Format | Status |
|---|---|---|---|
| Cursor | `cursor://` | `cursor://anysphere.cursor-deeplink/mcp/install?name=NAME&config=BASE64_JSON` | Stable, documented |
| VS Code / Copilot | `vscode:` | `vscode:mcp/install?URL_ENCODED_JSON` | Stable, documented |
| Claude Code | CLI only | `claude mcp add --transport http NAME URL` | No deeplink protocol |
| Claude Desktop | `.mcpb` file | Download + double-click `.mcpb` bundle | File-based, no URL protocol |
| Windsurf | Manual JSON | Edit `~/.codeium/windsurf/mcp_config.json` | No deeplink, config file only |
| Codex CLI | CLI only | `codex mcp add NAME --url URL` | CLI only |
| Goose | UI | Settings → Marketplace → Install | In-app UI, no deeplink |
| OpenHands | N/A | No documented MCP deeplink | Not supported |
| VS Code Insiders | `vscode-insiders:` | `vscode-insiders:mcp/install?URL_ENCODED_JSON` | Same as VS Code |

### 2. Integrations Page Architecture Patterns

Three dominant patterns exist among developer tool companies:

**Pattern A — Hub-and-Spoke (Supabase, Vercel)**
- Landing page: filterable grid of integration cards (logo + name + one-liner)
- Per-integration detail page at `/integrations/[slug]`
- Detail pages contain full setup guide, code samples, and troubleshooting
- Cards link to detail pages, not modals
- Best for: large ecosystems (10+ integrations)

**Pattern B — Tabbed Single Page (Vercel MCP docs, LaunchDarkly)**
- Single long-form page with anchor-linked sections per agent
- "Supported clients" list at top linking to anchors
- Each section has the relevant install snippet (CLI, JSON config, or button)
- Per-agent tab or section header
- Best for: single product with multi-agent support, 5–15 agents

**Pattern C — Expandable Sections (MCP Index / Context7)**
- Prominent deeplink buttons at page top for most common agents (Cursor, VS Code)
- `<details>` / accordion sections for remaining agents
- Remote + local server options within each section
- Best for: MCP registries and directories

### 3. Tabbed Code Snippet Implementation

**Fumadocs native approach** (already in the stack):

```mdx
<Tabs items={['curl', 'SDK', 'CLI']} groupId="install-method" persist>
  <Tab value="curl">
    ```bash
    curl -X POST https://api.looped.me/api/signals \
      -H "Authorization: Bearer $LOOP_API_KEY" \
      -d '{"type":"error","data":{}}'
    ```
  </Tab>
  <Tab value="SDK">
    ```ts
    import { LoopClient } from '@dork-labs/loop-sdk'
    const loop = new LoopClient({ apiKey: process.env.LOOP_API_KEY })
    await loop.signals.ingest({ type: 'error', data: {} })
    ```
  </Tab>
  <Tab value="CLI">
    ```bash
    loop signal --type error --data '{}'
    ```
  </Tab>
</Tabs>
```

Key Fumadocs tab features relevant to this work:
- `groupId` prop syncs tab selection across multiple code blocks on the same page
- `persist` prop saves selection to localStorage (user picks "SDK" once, all blocks switch)
- `defaultIndex` to pre-select the most common choice
- `id` + `updateAnchor` for URL-linked tab state (shareable links land on the right tab)

### 4. Logo Grid / "Compatible With" Patterns

**Best practice**: A 4–6 column responsive grid of grayscale-on-hover logos, each linking to either the per-agent setup section or an external agent homepage.

Dominant variants seen across developer tool sites:

- **Floating marquee / infinite scroll**: Used by marketing hero sections, gives sense of broad ecosystem without fixed count. Not ideal for integrations pages where users need to click through.
- **Static bento grid**: Fixed grid of logos with name labels. Works well for 8–16 agents. Allows hover states, deeplink actions.
- **Categorized list with icons**: Logo + name + brief capability note + "Set up" CTA. More scannable for developers evaluating compatibility.

For Loop's use case (AI agents), the **static bento grid with inline CTAs** is best: developers scanning the integrations page need to know at a glance "does my tool work?" and then take action immediately.

### 5. llms.txt Serving in Next.js

Two recommended approaches:

**Option A — App Router Route Handler (recommended for dynamic content)**
```ts
// app/llms.txt/route.ts
export const dynamic = 'force-static' // pre-render at build time

export async function GET() {
  const content = `# Loop — Autonomous Improvement Engine
...`
  return new Response(content, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
```

**Option B — Public directory (simplest, no code)**
- Drop `llms.txt` into `apps/web/public/llms.txt`
- Next.js serves it at `https://www.looped.me/llms.txt` automatically
- Best for manually curated, infrequently updated content
- Zero maintenance overhead

**Recommendation for Loop**: Use `public/llms.txt` for now. The content is stable. Migrate to a route handler only if the content needs to be generated from the database (e.g., listing all MCP tools dynamically).

### 6. Conversion-Optimized Integration Page Patterns

Patterns observed across Vercel, Supabase, Clerk, and MCP registries that drive developer adoption:

1. **"Add to [tool]" as the primary CTA, not "Learn more"** — Action-oriented language converts better than discovery language for developers who arrived via search intent
2. **Copy-to-clipboard for every code block** — Non-negotiable; Fumadocs includes this out of the box
3. **Agent detection (future)** — Some sites (Smithery, MCP Index) detect user agent or referrer to pre-select the relevant tab. Nice-to-have, not required for v1.
4. **Progressive disclosure** — Show the universal `npx add-mcp` command first (simplest), then per-agent instructions for users who prefer manual setup. Reduces cognitive load.
5. **Social proof near CTAs** — GitHub stars, user count, or named company logos near install buttons reduce hesitation

---

## Detailed Analysis

### Deeplink Button Implementation

#### Cursor deeplink button

The Cursor deeplink is the most widely deployed. The config is a base64-encoded JSON object matching the MCP server config schema.

For Loop's remote HTTP MCP server:

```ts
const config = { url: 'https://mcp.looped.me/mcp' }
const encoded = btoa(JSON.stringify(config))
const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=${encoded}`
```

For the Loop stdio MCP server (local):
```ts
const config = {
  command: 'npx',
  args: ['-y', '@dork-labs/loop-mcp'],
  env: { LOOP_API_KEY: '' }
}
const encoded = btoa(JSON.stringify(config))
const deeplink = `cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=${encoded}`
```

The rendered button: `<a href={deeplink}>Add to Cursor</a>` — clicking this on any OS with Cursor installed triggers Cursor's deeplink handler, which shows a confirmation dialog pre-populated with the server name and config.

#### VS Code deeplink button

VS Code uses a slightly different format — JSON stringified then URL-encoded (not base64):

```ts
const config = {
  name: 'loop',
  type: 'http',
  url: 'https://mcp.looped.me/mcp'
}
const deeplink = `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`
```

#### Claude Code — No deeplink, use copyable CLI command

There is no `claude://` deeplink protocol for Claude Code as of February 2026. The GitHub issue tracker confirms this limitation (anthropics/claude-code#26952). The correct UX pattern is:

```bash
claude mcp add --transport http loop https://mcp.looped.me/mcp
```

Present this as a copy-to-clipboard code block. Optionally pair it with a "Run in terminal" button using `terminal://` or `x-terminal-emulator://` OS schemes, but cross-platform support is inconsistent — a copy button is safer.

#### Claude Desktop — .mcpb bundle

Claude Desktop supports `.mcpb` (MCP Bundle) files for one-click installation. The user downloads the file and double-clicks it. This is distinct from Claude Code (the CLI). If Loop ships a `.mcpb` bundle, the CTA would be a download button, not a deeplink.

#### Universal installer — npx add-mcp

The `add-mcp` npm package (created by Neon, adopted by Vercel) is now the de-facto standard for installing MCP servers across all agents at once. Vercel recommends it as the first-listed option on their MCP page.

```bash
npx add-mcp https://mcp.looped.me/mcp
# or for stdio:
npx add-mcp @dork-labs/loop-mcp
```

This single command detects installed agents (Claude Code, Cursor, VS Code, Codex, Gemini CLI, Goose, Zed, Windsurf, etc.) and writes the correct config for each. **This should be the first-displayed option on Loop's integrations page**.

### Integrations Page Architecture Decision

#### Single page vs hub-and-spoke

For Loop's initial launch, **a single integrations page** with per-agent sections is the right call because:

- Loop has one product (the MCP server) with one endpoint (`mcp.looped.me/mcp`)
- Per-agent installation is 1–3 lines of config — doesn't warrant a full detail page per agent
- Hub-and-spoke makes sense when each integration has meaningfully different setup (e.g., Supabase integrating with 50+ tools that each require different configuration)
- A single page is easier to maintain and keeps SEO value concentrated

The recommended structure for the single page:

```
/integrations
  ├── Hero: "Works with every AI coding agent"
  ├── Compatible agents logo grid (8–12 agents)
  ├── Quick install: `npx add-mcp https://mcp.looped.me/mcp`
  ├── Per-agent sections (tabbed or anchored)
  │   ├── Cursor (deeplink button + JSON config)
  │   ├── Claude Code (CLI command)
  │   ├── VS Code (deeplink button + JSON config)
  │   ├── Windsurf (JSON config)
  │   ├── Codex CLI (CLI command)
  │   └── OpenHands (manual JSON)
  └── What you can do with Loop MCP (feature list)
```

#### Static grid vs interactive cards with expandable steps

The **static grid for the logo section + anchor-linked sections below** beats expandable cards because:

- Developers prefer scrolling to clicking-to-expand for setup instructions (they copy-paste; inline code requires stable DOM positioning)
- Expandable cards create "content jank" when toggling open — disruptive when trying to copy a command
- The Vercel MCP docs page (which uses anchor-linked sections) is the industry benchmark for this pattern

### Fumadocs Tabbed Code Snippet Implementation

For the marketing site (Next.js with Fumadocs), there are two implementation paths:

**Path A: MDX Tabs component (for docs pages)**

Fumadocs' `<Tabs>` + `<Tab>` components work natively in `.mdx` files with zero custom code. Use `groupId` so that when a user picks "SDK" in one section, all other tab groups on the page follow.

**Path B: Custom React component (for marketing pages that aren't MDX)**

The homepage and integrations page (`apps/web/src/app/(marketing)/`) are standard Next.js pages, not MDX. For these, build a `<CodeTabs>` client component using `useState` + Shiki for syntax highlighting:

```tsx
'use client'
import { useState } from 'react'
import { codeToHtml } from 'shiki'

const tabs = {
  curl: `curl -X POST https://api.looped.me/api/signals ...`,
  sdk: `import { LoopClient } from '@dork-labs/loop-sdk' ...`,
  cli: `loop signal --type error`,
}

export function CodeTabs() {
  const [active, setActive] = useState<keyof typeof tabs>('cli')
  // render tab bar + highlighted code block
}
```

Fumadocs already ships Shiki as a dependency — reuse it rather than adding another highlighter.

---

## Potential Solutions

### Solution A: Minimal (1–2 days)

- Single `/integrations` page with static agent logo grid
- Copy-to-clipboard code blocks per agent (no deeplink buttons)
- `npx add-mcp` universal command prominently featured
- `llms.txt` served from `public/llms.txt`
- No homepage changes

**Pros**: Fast to ship, low maintenance
**Cons**: Missing deeplink buttons misses a conversion opportunity; no per-agent CTAs

### Solution B: Standard (3–5 days)

- `/integrations` page with:
  - Animated logo grid (CSS marquee or static bento)
  - "Add to Cursor" deeplink button (cursor:// protocol)
  - "Add to VS Code" deeplink button (vscode: protocol)
  - Claude Code copy-paste CLI command
  - `npx add-mcp` as primary quick-start
  - Tabbed code blocks per method (curl / SDK / CLI)
- Homepage: add agent logo strip to hero section
- `llms.txt` in `public/`

**Pros**: Covers the two deeplink-capable agents; good developer UX
**Cons**: Claude Code (a top-priority agent for Loop) doesn't get a deeplink button

### Solution C: Comprehensive (1 week)

Everything in Solution B, plus:
- Per-agent expandable sections with detailed setup steps (Windsurf, Codex, OpenHands, Gemini CLI, Goose)
- Homepage value proposition section with "The Loop is AI-agent ready" messaging
- Agent count badge ("Works with 12+ AI coding agents")
- `.mcpb` bundle for Claude Desktop one-click install
- `llms.txt` generated via route handler with dynamic tool listing from MCP registry

**Pros**: Maximum conversion surface, covers all major agents
**Cons**: Highest engineering effort; `.mcpb` bundle creation adds new workflow

**Recommendation**: Ship Solution B. The Cursor deeplink and VS Code deeplink cover the two most popular developer agents. Claude Code users are comfortable with CLI commands. The `npx add-mcp` universal option acts as a catch-all for everyone else.

---

## Security and Performance Considerations

### Deeplink security

- Deeplink buttons open `cursor://` and `vscode:` URIs in the browser. These are handled by the OS, which prompts the user to open Cursor/VS Code. No server-side risk.
- The base64-encoded config in Cursor deeplinks should never include sensitive values (API keys, tokens). The Loop MCP server should use OAuth or have users set `LOOP_API_KEY` as an environment variable post-install.
- Note from Vercel's security docs: warn users to double-check domain names before one-click installing MCP servers from any site — prompt injection risk exists for untrusted MCP servers.

### Performance

- Logo grids: use `next/image` for all agent logos with `loading="lazy"` and fixed width/height to prevent layout shift
- Code blocks: use Shiki with `transformerNotationHighlight` for relevant lines; avoid client-side syntax highlighting for initial render — render highlighted HTML server-side
- Tabs: `persist` tab selection in localStorage to avoid jarring resets on navigation; `groupId` ensures cross-section sync without prop drilling
- `llms.txt`: serve from `public/` (static, CDN-cached) rather than a route handler unless content is dynamic

### SEO considerations

- The `/integrations` page should have a descriptive `<title>`: "Loop MCP — Works with Claude Code, Cursor, VS Code, and more AI coding agents"
- Each per-agent anchor section (`#cursor`, `#claude-code`, etc.) improves crawlability and enables deep-linking from agent-specific search queries
- `llms.txt` at the root improves discoverability in AI-powered search tools

---

## Research Gaps and Limitations

1. **No confirmed `claude://` deeplink protocol**: Multiple searches and direct inspection of Claude Code docs confirm no deeplink URL scheme exists for Claude Code as of Feb 2026. The GitHub issue (anthropics/claude-code#26952) requests it but is unresolved. Monitor for future release.

2. **Windsurf deeplink**: No `windsurf://` deeplink protocol documented. Windsurf uses a Plugin Store UI for in-app installation and a JSON config file for manual setup. No web-triggered deeplink confirmed.

3. **OpenHands deeplink**: OpenHands has no documented MCP deeplink protocol. Installation is via `.openhands/microagents/` config files.

4. **`.mcpb` bundle creation process**: Anthropic's Desktop Extensions (`.mcpb` bundles) are documented from the user perspective but the toolchain for creating and publishing a `.mcpb` bundle is not fully documented for third-party developers. The `@anthropic-ai/dxt` package referenced in Anthropic's engineering blog would need investigation before implementing Claude Desktop one-click install.

5. **Agent user-agent detection**: Whether Cursor, VS Code, or Claude Code set identifiable `User-Agent` headers when browsing the web (to enable pre-selecting the right tab) is not confirmed.

---

## Contradictions and Disputes

- **`cursor://` config format**: Different sources show slightly different formats. The official Cursor docs use `cursor://anysphere.cursor-deeplink/mcp/install?name=NAME&config=BASE64`. Smithery's docs show a slightly different generic pattern. The Cursor official docs are authoritative.

- **VS Code deeplink encoding**: Some sources show `base64` encoding (same as Cursor), while the VS Code Extension API docs explicitly specify `JSON.stringify` + `encodeURIComponent` (not base64). The VS Code official API docs are authoritative: `vscode:mcp/install?URL_ENCODED_JSON`.

---

## Search Methodology

- Searches performed: 16
- Most productive search terms: `cursor:// protocol MCP deeplink install`, `vscode:mcp/install protocol`, `add-mcp neon blog`, `Vercel MCP docs`, `Fumadocs tabs component`, `llms.txt Next.js route handler`
- Primary information sources: cursor.com/docs, code.claude.com/docs, vercel.com/docs, fumadocs.dev, smithery.ai, neon.com, mcpindex.net

---

## Sources and Evidence

- [Cursor MCP Install Links Documentation](https://cursor.com/docs/context/mcp/install-links) — Official cursor:// deeplink format
- [VS Code MCP Developer Guide](https://code.visualstudio.com/api/extension-guides/ai/mcp) — Official vscode:mcp/install format
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp) — Confirms no deeplink, CLI-only for Claude Code
- [Anthropic Desktop Extensions Engineering Post](https://www.anthropic.com/engineering/desktop-extensions) — .mcpb bundle format for Claude Desktop
- [Smithery Deep Linking Documentation](https://smithery.ai/docs/use/deep-linking) — Generic deeplink protocol pattern `{clientScheme}://mcp/install`
- [add-mcp: Install MCP Servers Across Coding Agents — Neon](https://neon.com/blog/add-mcp) — Universal MCP installer, supported agents list
- [Use Vercel's MCP Server](https://vercel.com/docs/mcp/vercel-mcp) — Industry reference implementation for MCP marketing page
- [MCP Index / Context7 Installation Page](https://mcpindex.net/en/mcpserver/upstash-context7) — "Add to Cursor" + "Install in VS Code" button pattern reference
- [Fumadocs Tabs Component](https://www.fumadocs.dev/) — `<Tabs groupId persist>` + `<Tab>` for tabbed code blocks
- [Fumadocs Code Block](https://www.fumadocs.dev/docs/ui/components/codeblock) — Copy button, title, icon features
- [Supabase Integrations Page](https://supabase.com/partners/integrations) — Hub-and-spoke integrations architecture reference
- [How to Add llms.txt to Next.js — llms-txt.io](https://llms-txt.io/blog/how-to-add-llms-txt-to-nextjs-react) — Route handler vs public directory approaches
- [One-Click MCP Install with Cursor Deeplinks — AI Engineer Guide](https://aiengineerguide.com/blog/cursor-mcp-deeplink/) — Cursor deeplink UX flow details
- [LaunchDarkly Agent Skills Quickstart](https://launchdarkly.com/docs/tutorials/agent-skills-quickstart) — Tab pattern and CTA patterns for agent integration pages
- [Claude Code GitHub Issue #26952](https://github.com/anthropics/claude-code/issues/26952) — Confirms claude:// custom URL scheme is not yet supported
- [DevCycle MCP Getting Started](https://docs.devcycle.com/cli-mcp/mcp-getting-started/) — Cursor install button example from a developer tool
- [Introducing the DevCycle MCP Server](https://blog.devcycle.com/introducing-the-devcycle-mcp-server/) — MCP marketing announcement patterns
