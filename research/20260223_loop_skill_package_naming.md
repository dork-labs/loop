# Loop Agent Skill Package Naming Research

**Date:** 2026-02-23
**Research Mode:** Focused Investigation
**Objective:** Determine the best npm package name for Loop's agent skill package (currently `@dork-labs/loop`)

---

## Research Summary

The agent skills ecosystem (agentskills.io / skills.sh) is actively growing but has **no enforced npm package naming convention** for the package name itself. The spec only governs the `name` field inside `SKILL.md` frontmatter and the directory structure. In practice, the most prominent publishers (Vercel, Anthropic) use collections named `agent-skills` or `skills` at the repository level, containing individually named skills. Solo skill packages on npm are rare — the ecosystem distributes via GitHub refs, not bare npm package names. Given this landscape, the strongest choice for Loop is `@dork-labs/loop-skill`, balancing clarity, uniqueness, and ecosystem alignment.

---

## Key Findings

### 1. The Spec Does Not Govern npm Package Names

The [agentskills.io specification](https://agentskills.io/specification) defines naming rules exclusively for:
- The `name` field in `SKILL.md` frontmatter (lowercase, hyphens, max 64 chars, must match directory name)
- The skill directory name (must match `name` field)

It says **nothing** about how the npm package containing those skills should be named. This is confirmed by the [antfu/skills-npm proposal](https://github.com/antfu/skills-npm/blob/main/PROPOSAL.md) and [npm-agentskills](https://github.com/onmax/npm-agentskills), both of which use a placeholder `"my-awesome-tool"` without prescribing a suffix.

### 2. Observed Naming Patterns in the Wild

From scanning skills.sh leaderboard (300K+ install packages) and major publishers:

| Pattern | Examples | Notes |
|---|---|---|
| `org/product-skills` (repo ref) | `vercel-labs/agent-skills`, `anthropics/skills`, `expo/skills` | Most popular. Installed via `npx skills add vercel-labs/agent-skills`, not npm. |
| Descriptive with `-best-practices` | `vercel-react-best-practices`, `remotion-best-practices` | For individual skills within a collection |
| No suffix | `browser-use`, `firecrawl`, `remotion-dev/skills` | Bare product names for skill repos |
| `@scope/product-skills` (npm) | `@rmyndharis/antigravity-skills` | Rare; scoped npm package with `-skills` suffix |
| `@scope/product` (npm, no suffix) | `@dork-labs/loop` (current) | Ambiguous — could be SDK, CLI, or skill |

**Key observation:** Top packages are distributed as GitHub repository references (`org/repo`), not bare npm names. The skills CLI (`npx skills`) resolves `vercel-labs/agent-skills` as a GitHub repo, not an npm lookup. True standalone npm packages for individual skills are rare and inconsistently named.

### 3. anthropics/skills Reference Implementation

Anthropic's official skills repository at [anthropics/skills](https://github.com/anthropics/skills) uses:
- A single repository holding multiple skills in `skills/` subdirectories
- Individual skill names: `pdf`, `docx`, `xlsx`, `pptx`, `skill-creator`, `frontend-design`
- Distribution pattern: `npx skills add anthropics/skills --skill pdf`
- No npm package suffix in the repo name itself

### 4. The Boilerplate Recommendation

The [neovateai/agent-skill-npm-boilerplate](https://github.com/neovateai/agent-skill-npm-boilerplate) — the most explicit guidance found — recommends scoped packages in the format `@your-org/your-skill-name`. It does not mandate a `-skill` suffix but positions scoped naming as the primary recommendation for organization and discoverability.

When skills-npm discovers skills in `node_modules`, it symlinks them as:
```
skills/npm-<package-name>-<skill-name>
```
So `@dork-labs/loop-skill` with a skill named `loop` becomes `skills/npm-@dork-labs/loop-skill-loop`.

### 5. Install Ergonomics Comparison

| Package Name | Install Command | Notes |
|---|---|---|
| `@dork-labs/loop` | `npx skills add @dork-labs/loop` | Ambiguous — same name as potential SDK |
| `@dork-labs/loop-skill` | `npx skills add @dork-labs/loop-skill` | Clear intent, matches directory |
| `@dork-labs/loop-agent` | `npx skills add @dork-labs/loop-agent` | Implies executable agent, not instructions |
| `@dork-labs/loop-rules` | `npx skills add @dork-labs/loop-rules` | Accurate but not ecosystem-standard term |
| `@dork-labs/loop-agent-skill` | `npx skills add @dork-labs/loop-agent-skill` | Overly verbose |

### 6. Ecosystem Vocabulary: "Skill" vs "Rules" vs "Agent"

- **"skill"** is the canonical term used by agentskills.io, Anthropic, Vercel, OpenCode, and the openskills CLI
- **"rules"** is Cursor-specific vocabulary (`.cursorrules`, `.mdc` files); using it narrows perceived scope
- **"agent"** implies executable behavior (a running agent) rather than static instructions; misleading for a docs-only package

---

## Detailed Analysis

### Why `@dork-labs/loop` (current name) Is Problematic

The current name `@dork-labs/loop` fails on disambiguation. Loop has (or will have) multiple published packages:
- `@dork-labs/loop-cli` — the CLI tool
- `@dork-labs/loop-sdk` — the SDK
- `@dork-labs/loop-mcp` — the MCP server
- `@dork-labs/loop-types` — type definitions

A bare `@dork-labs/loop` would be expected to be the primary meta-package or the SDK itself, not a pure-documentation skill file. A developer browsing npm searching for "how do I integrate with Loop programmatically?" would reasonably expect `@dork-labs/loop` to be the SDK. Finding a SKILL.md file there would be disorienting.

Additionally, if Loop ever publishes a true meta/umbrella package (not uncommon for open-source projects), the name `@dork-labs/loop` is the obvious choice — and it's currently occupied by the skill.

### Why `@dork-labs/loop-skill` Is the Best Choice

1. **Explicit intent.** The `-skill` suffix is the canonical term in the agentskills.io ecosystem. Any developer familiar with the standard immediately knows what this package contains.

2. **Consistent with the directory.** The package lives at `packages/loop-skill/`. Package name matching directory name is a strong monorepo hygiene convention.

3. **Unambiguous within the `@dork-labs` scope.** Future packages (`loop-cli`, `loop-sdk`, `loop-mcp`) will all be clearly distinguished.

4. **Ecosystem precedent.** The `-skills` pattern (plural) appears in collections (`vercel-labs/agent-skills`, `anthropics/skills`). The singular `-skill` cleanly signals "one skill for one product."

5. **Install ergonomics.** `npx openskills install @dork-labs/loop-skill` reads naturally as installing Loop's skill package. Compare `npx openskills install @dork-labs/loop` which sounds like installing Loop itself.

6. **Search discoverability.** Someone searching npm for "loop skill" will find `@dork-labs/loop-skill`. Searching for "loop" will return dozens of unrelated packages — the `-skill` suffix is a filter.

### Why the Alternatives Fall Short

**`@dork-labs/loop-agent`** — "agent" implies something executable, like a bot or a running process. This package contains zero executable code; it's static instructions. The word "agent" is overloaded in AI contexts and would confuse users.

**`@dork-labs/loop-rules`** — "rules" is Cursor-specific vocabulary. This package targets Claude Code, Codex, OpenHands, and any openskills-compatible agent — not just Cursor. Using "rules" undersells the scope and mismaps ecosystem vocabulary.

**`@dork-labs/loop-agent-skill`** — Verbose without adding clarity. The compound reads awkwardly. No precedent in the wild.

**`@dork-labs/loop` (keeping current)** — Reserved for a potential meta-package or SDK. Should not be occupied by a documentation-only skill file.

---

## Recommendation

**Rename to `@dork-labs/loop-skill`.**

This is a rename in `package.json` only. The SKILL.md frontmatter `name: loop` stays unchanged — that governs the skill's identity within the agent's context, not the npm package name. The directory `packages/loop-skill/` already matches.

### Changes Required

1. `packages/loop-skill/package.json`: Change `"name"` from `"@dork-labs/loop"` to `"@dork-labs/loop-skill"`
2. Any docs or READMEs referencing the package name
3. npm unpublish/republish (if already published at `@dork-labs/loop`)

### Install Command After Rename

```bash
# Via openskills
npx openskills install @dork-labs/loop-skill

# Via skills CLI
npx skills add @dork-labs/loop-skill

# Via npm (copies files manually)
npm install @dork-labs/loop-skill
```

---

## Research Gaps & Limitations

- The skills ecosystem is moving fast (late 2025 emergence); conventions are not yet ossified. This recommendation reflects the state as of February 2026.
- skills.sh leaderboard data shows install counts but not which packages are npm-registered vs GitHub-ref only. True npm-named skill packages are a minority.
- No authoritative "official" spec on npm package naming exists — this is a gap in the agentskills.io specification itself, acknowledged in community discussion.

---

## Sources & Evidence

- [agentskills.io Specification](https://agentskills.io/specification) — Official spec; governs SKILL.md name field only, not npm package names
- [GitHub: agentskills/agentskills](https://github.com/agentskills/agentskills) — Reference implementation and spec repo
- [GitHub: anthropics/skills](https://github.com/anthropics/skills) — Anthropic's official skills collection; uses `pdf`, `docx`, `skill-creator` naming internally
- [GitHub: vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) — Vercel's skill collection; skills named `react-best-practices`, `web-design-guidelines`
- [GitHub: antfu/skills-npm](https://github.com/antfu/skills-npm) — Proposal for embedding skills in npm packages; no suffix convention prescribed
- [GitHub: onmax/npm-agentskills](https://github.com/onmax/npm-agentskills) — Framework-agnostic skill discovery; no naming convention prescribed
- [GitHub: neovateai/agent-skill-npm-boilerplate](https://github.com/neovateai/agent-skill-npm-boilerplate) — Recommends `@org/skill-name` scoped format
- [GitHub: numman-ali/openskills](https://github.com/numman-ali/openskills) — Universal skills loader; installs by GitHub ref, not npm name
- [skills.sh leaderboard](https://skills.sh) — Top packages: find-skills (300K), vercel-react-best-practices (159K), web-design-guidelines (121K)
- [Vercel KB: Agent Skills](https://vercel.com/kb/guide/agent-skills-creating-installing-and-sharing-reusable-agent-context) — Install pattern is `npx skills add org/repo`, not npm package name
- [HN: Agent Skills Leaderboard](https://news.ycombinator.com/item?id=46697908) — Community discussion; confirms "no consensus yet" on paths/naming
- [NPM: @agentskillkit/agent-skills](https://www.npmjs.com/package/@agentskillkit/agent-skills) — Example of `-skills` suffix in scoped npm package
- [NPM: opencode-skills](https://www.npmjs.com/package/opencode-skills) — Example of unscoped `-skills` suffix package

---

## Search Methodology

- Searches performed: 14
- Most productive terms: `openskills.io naming convention`, `agentskills npm package naming`, `skills.sh leaderboard`, `vercel-labs agent-skills naming`, `anthropics skills convention`
- Primary sources: agentskills.io, skills.sh, GitHub (anthropics, vercel-labs, antfu, onmax), npm registry
- Research depth: Focused Investigation
