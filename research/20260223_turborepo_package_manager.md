# Turborepo Package Manager Comparison: npm vs pnpm vs Yarn Berry vs Bun

**Date:** 2026-02-23
**Research Depth:** Deep
**Context:** Loop monorepo (3 apps, npm@10.9.2, deploys to Vercel, Node.js runtime)

---

## Research Summary

pnpm is the clear winner for Turborepo monorepos in 2026. It offers the best combination of Turborepo compatibility, Vercel support, disk efficiency, strict dependency isolation, and community momentum. The migration from npm is straightforward and well-documented. Bun is fast but immature for monorepos. Yarn Berry has persistent compatibility issues with Turborepo. npm works but is the slowest and least disk-efficient option.

---

## Key Findings

### 1. Turborepo's Official Stance: Agnostic, But the Ecosystem Leans pnpm

Turborepo's documentation treats all four package managers equally, presenting them side-by-side in tabbed examples. The only hard requirement is: maintain a lockfile consistently, and set the `packageManager` field in `package.json`. Turborepo does not officially recommend one over another.

However, the ecosystem tells a different story:
- The overwhelming majority of Turborepo guides, blog posts, and example repos use pnpm
- Vercel (Turborepo's parent company) sponsors pnpm development
- The `create-turbo` scaffolder supports all four, but pnpm is the most tested path in the community

### 2. Vercel Deployment: All Four Supported, pnpm Has Best Auto-Detection

Vercel supports npm (8/9/10), pnpm (6/7/8/9/10), Yarn (1/2/3), and Bun (1). Detection is automatic based on lockfile presence. Key details:

| Package Manager | Lock File | Auto-Detect | Notes |
|----------------|-----------|-------------|-------|
| npm | `package-lock.json` | Yes | Default if no lockfile found |
| pnpm | `pnpm-lock.yaml` | Yes | Zero-config deployment since 2023 |
| Yarn | `yarn.lock` | Yes | Defaults to Yarn 1 from lockfile |
| Bun | `bun.lock` / `bun.lockb` | Yes | Supported but newer |

Vercel uses the `lockfileVersion` in `pnpm-lock.yaml` to pick the right pnpm version automatically. For npm, the version follows the Node.js version. This is important: pnpm's version detection on Vercel is more deterministic than npm's.

### 3. Performance Comparison

**Install Speed (approximate, based on multiple benchmarks):**
| Scenario | npm | pnpm | Yarn Berry | Bun |
|----------|-----|------|------------|-----|
| Cold install (no cache) | Slowest | Fast | Moderate | Fastest |
| Warm install (cached) | Slow | Very Fast | Fast | Fastest |
| CI with cache | 2+ min | ~10-50s | ~30-60s | ~5-20s |

**Disk Space:**
- **npm**: Duplicates dependencies across workspaces. A package used in 3 workspaces exists 3 times.
- **pnpm**: Content-addressable store with hard links. Each unique package version exists once on disk, period. Massive savings in monorepos.
- **Yarn Berry (PnP)**: Zero-install possible with compressed .zip archives. Smallest footprint if PnP works (often it does not with Turborepo).
- **Bun**: Uses a global cache similar to pnpm but less mature deduplication in workspaces.

For a monorepo with 3 apps sharing many dependencies (React, TypeScript, Vite, etc.), pnpm's disk savings are significant -- typically 40-60% less than npm.

### 4. Dependency Isolation and Correctness

This is where pnpm genuinely excels and it matters most for monorepos:

- **npm**: Flat `node_modules` with hoisting. Packages can accidentally import dependencies they did not declare (phantom dependencies). This works until it does not, typically breaking in production or in a different workspace.
- **pnpm**: Strict by default. Each workspace can only access dependencies it explicitly declares. If `apps/api` tries to import a package only declared in `apps/web`, pnpm will fail. This catches real bugs.
- **Yarn Berry**: Strict with PnP mode, but PnP has compatibility issues with many tools.
- **Bun**: Always hoists packages to root, similar to npm. A known issue (oven-sh/bun#7547) means Bun cannot prevent phantom dependency access.

For a monorepo that will grow, pnpm's strictness prevents a class of "works on my machine" bugs that npm silently allows.

### 5. Yarn Berry (v4) with Turborepo: Significant Issues

Yarn Berry has a documented history of problems with Turborepo:

- **`turbo prune` panics** with Yarn patches (vercel/turborepo#6450)
- **Local turbo detection fails** with `nodeLinker: pnpm` (vercel/turborepo#10832)
- **Build failures with Plug'n'Play** require falling back to `nodeLinker: node-modules` (vercel/turborepo#6805)
- **Codemod incompatibility** when updating Turborepo -- the `-W` flag does not exist in Yarn 4 (vercel/turborepo#9596)
- **Affected package detection** incorrectly reports all packages as changed (vercel/turborepo#11144)

The practical reality: Yarn Berry with Turborepo requires `nodeLinker: node-modules` to avoid PnP issues, at which point you lose Yarn Berry's primary advantage (PnP zero-install) and are left with a more complex setup than pnpm for no benefit.

### 6. Bun as Package Manager: Fast But Immature for Monorepos

Bun's install speed is genuinely impressive (up to 30x faster than npm in cold installs). However, as a package manager for monorepos in 2026, it has concrete issues:

- **Workspace filtering is broken**: `--filter` installs packages to root instead of the target workspace. Workaround requires `--cwd` flag.
- **Phantom dependencies**: Bun always hoists, no strict mode available.
- **TypeScript type conflicts**: Duplicate package installations with different content hashes cause type incompatibility across workspaces (oven-sh/bun#23725).
- **Publishing issues**: `workspace:*` references are not resolved during publish with Changesets.
- **Still stabilizing**: Monorepo workspace support was described as "in beta" as recently as August 2025.

For Loop's use case (Node.js runtime, not Bun runtime), using Bun only as a package manager adds a new tool dependency without the runtime benefits. The speed gain is real but the monorepo gaps are concerning.

### 7. npm: It Works, But You Pay a Tax

npm is the current choice for Loop. It works. Turborepo supports it. Vercel supports it. The downsides are practical:

- **Slowest installs** of the four options, especially in CI
- **Largest `node_modules`** due to duplication across workspaces
- **No phantom dependency protection** -- flat hoisting allows silent import of undeclared deps
- **`npm exec --workspaces` is documented as very slow** (npm/cli#5509), pegging CPU at 100%
- **Less deterministic** version resolution compared to pnpm

npm is a fine default. But for a monorepo that is actively developed and deployed frequently, the install time and disk space overhead add up.

---

## Detailed Comparison Matrix

| Criteria | npm | pnpm | Yarn Berry | Bun |
|----------|-----|------|------------|-----|
| Turborepo compat | Excellent | Excellent | Problematic | Good |
| Vercel support | Native default | Zero-config | Supported | Supported |
| Install speed | Baseline (1x) | ~2-3x faster | ~1.5-2x faster | ~5-30x faster |
| Disk efficiency | Poor (duplicates) | Excellent (hardlinks) | Good (PnP) / Poor (node-modules) | Moderate |
| Dependency strictness | None (hoisting) | Strict by default | Strict (PnP only) | None (hoisting) |
| Lockfile quality | Good | Excellent | Good | Improving |
| Monorepo maturity | Mature but basic | Best-in-class | Mature but Turbo issues | Immature |
| Migration effort | N/A (current) | Low (~1 hour) | Medium (~2-4 hours) | Medium (~2-4 hours) |
| Community momentum | Declining for monorepos | Growing rapidly | Stable/declining | Growing |
| Risk level | Low (status quo) | Very low | Medium | Medium-high |

---

## Recommendation: Migrate to pnpm

**Confidence: High.** pnpm is the right choice for Loop.

### Why pnpm

1. **Best Turborepo compatibility** -- no known issues, most-tested community path, Vercel sponsors pnpm
2. **Strict dependency isolation** prevents phantom dependency bugs as the monorepo grows
3. **Significant disk and CI speed improvements** over npm with zero correctness tradeoffs
4. **Zero-config Vercel deployment** -- drop in `pnpm-lock.yaml`, Vercel handles the rest
5. **Lowest migration risk** -- npm-to-pnpm is the most documented migration path for Turborepo monorepos
6. **Industry standard** for Turborepo monorepos in 2026

### Why Not the Others

- **npm (status quo)**: No correctness guarantees, slowest option, pays a disk/time tax on every install. No compelling reason to stay.
- **Yarn Berry**: Too many documented Turborepo issues. PnP compatibility problems. Requires nodeLinker workarounds that negate benefits. Higher migration complexity for less gain.
- **Bun**: Speed is compelling but workspace support is immature. Phantom dependencies, TypeScript type conflicts in workspaces, and publishing issues are dealbreakers for a production monorepo. Revisit in late 2026.

### Migration Scope

The migration from npm to pnpm for Loop is small:

1. Install pnpm globally: `npm install -g pnpm` (or use corepack)
2. Delete `package-lock.json` and all `node_modules/`
3. Create `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   ```
4. Update `package.json`: change `packageManager` from `"npm@10.9.2"` to `"pnpm@10.x.x"`
5. Remove `"workspaces"` from root `package.json` (pnpm uses `pnpm-workspace.yaml` instead)
6. Run `pnpm install` to generate `pnpm-lock.yaml`
7. Update CI scripts: replace `npm ci` with `pnpm install --frozen-lockfile`
8. Update root scripts: replace `npm run` references with `pnpm` equivalents
9. Optionally add `.npmrc` with `shamefully-hoist=false` (strict mode, the default)
10. Test build, dev, and deployment

Estimated effort: 1-2 hours for the migration, plus CI/CD verification.

---

## Sources & Evidence

- [Turborepo Docs: Structuring a Repository](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository) - Official docs showing package manager agnosticism
- [Turborepo Docs: Installation](https://turborepo.dev/docs/getting-started/installation) - Official install instructions for all PMs
- [Vercel Docs: Package Managers](https://vercel.com/docs/package-managers) - Vercel's supported PMs, versions, and detection logic
- [Vercel: pnpm zero-config deployment](https://vercel.com/changelog/projects-using-pnpm-can-now-be-deployed-with-zero-configuration) - Vercel's pnpm sponsorship and zero-config support
- [Turborepo + Yarn v4 discussion](https://github.com/vercel/turborepo/discussions/7931) - Community reports on Yarn Berry issues
- [Turborepo Yarn Berry prune panic](https://github.com/vercel/turborepo/issues/6450) - turbo prune fails with Yarn patches
- [Turborepo Yarn Berry turbo detection](https://github.com/vercel/turborepo/issues/10832) - Local turbo not found with Yarn Berry
- [Bun workspace hoisting issue](https://github.com/oven-sh/bun/issues/7547) - Bun always hoists, no strict mode
- [Bun TypeScript type conflicts](https://github.com/oven-sh/bun/issues/23725) - Duplicate packages cause type errors
- [Bun + Turborepo pain points](https://www.fgbyte.com/blog/02-bun-turborepo-hell/) - Real-world Bun + Turborepo issues
- [Nhost: pnpm + Turborepo configuration](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo) - Production pnpm + Turborepo setup
- [Tinybird: CI pipeline with Turborepo + pnpm](https://www.tinybird.co/blog/frontend-ci-monorepo-turborepo-pnpm) - CI times from 10+ min to 50 seconds
- [npm exec workspaces slow](https://github.com/npm/cli/issues/5509) - npm workspace command performance bug
- [2026 Package Manager Showdown](https://dev.to/pockit_tools/pnpm-vs-npm-vs-yarn-vs-bun-the-2026-package-manager-showdown-51dc) - Community comparison
- [OpenAI Codex pnpm migration](https://github.com/openai/codex/issues/278) - Even OpenAI's Codex repo migrating to pnpm + Turborepo

---

## Search Methodology

- Searches performed: 9
- Pages fetched: 3
- Key search terms: "Turborepo package manager", "Vercel package manager support", "pnpm vs bun monorepo", "Yarn Berry Turborepo issues", "npm workspaces performance"
- Primary sources: Turborepo docs, Vercel docs, GitHub issues, practitioner blog posts
