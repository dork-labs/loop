# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

---

## [0.2.0] - 2026-02-23

> Complete agent integration strategy — 9 features making Loop the easiest autonomous work management system for AI agents to discover, connect to, and operate within.

### Added

- Add MCP server (`@dork-labs/loop-mcp`) with 9 agent tools and dual transport (stdio + Streamable HTTP) for native AI agent integration in Claude Code, Cursor, and any MCP-capable environment
- Add TypeScript SDK (`@dork-labs/loop-sdk`) and shared types (`@dork-labs/loop-types`) with class-based client, 12 resource namespaces, typed errors, retry with backoff, and pagination helpers
- Add connect CLI (`@dork-labs/loop-connect`) — one-command `npx` experience that validates API keys, detects agent environments, and writes config for Claude Code, Cursor, and OpenHands
- Add agent discovery layer with `llms.txt` endpoint, `SKILL.md` for agent dispatch workflow, `AGENTS.md` snippet, Cursor rules, and OpenHands microagent
- Add `loop_` prefix to API keys with auto-generation during setup and actionable Zod validation errors showing exact generation commands
- Rebuild CLI as `@dork-labs/loop-cli` on the TypeScript SDK with 13 command groups including `loop next` for agent dispatch
- Add agent integration showcase to marketing site with integrations page, deeplink buttons, and interactive code snippets
- Add 33 documentation pages covering MCP server, SDK reference, CLI commands, and per-agent integration guides
- Add FTUE agent detection — auto-detect user's agent platform via `?from=` URL param and present context-aware setup with Cursor deeplinks and collapsible alternatives
- Add FTUE onboarding flow with welcome modal, 4-step setup checklist, polling for first issue, and confetti celebration

### Changed

- Curate 4 Architecture Decision Records from agent integration specs, archive 5 trivial drafts

### Fixed

- Fix RSC serialization error on marketing integrations page
- Fix SDK documentation referencing non-existent parameters
- Fix CLI npm package scoping for public publishing
- Fix MCP server workspace dependency resolution

---

## [0.1.0] - 2026-02-22

> Initial release — the complete MVP of the Autonomous Improvement Engine.

### Added

- Initialize Loop monorepo with Turborepo, three apps (API, App, Web), and shared tooling
- Implement data layer with PostgreSQL/Drizzle ORM schema and full CRUD API for issues, projects, goals, signals, and prompt templates
- Implement prompt and dispatch engine for automated signal-to-issue processing
- Build React dashboard with five views: Issue List, Issue Detail, Activity Timeline, Goals Dashboard, and Prompt Health
- Implement CLI tool with 13 commands and 173 tests for managing issues, projects, goals, signals, and templates
- Add comprehensive documentation site with Fumadocs and OpenAPI-generated API reference
- Add OpenAPI registry with Zod-based schema definitions and automated document generation
- Implement developer setup with Docker Compose for local PostgreSQL, Zod env validation, and first-run setup script
- Add dark theme with polished empty states, consistent error handling, and route loading indicators
- Update marketing homepage to reflect completed MVP capabilities
- Add webhook integrations for GitHub, Sentry, and PostHog signal ingestion
- Add keyboard shortcuts for dashboard navigation (g+i, g+a, g+g, g+p, Cmd+B, ?)

### Fixed

- Correct 6 bugs in CLI found during post-implementation review
- Fix g+g keyboard chord to properly reach Goals navigation
- Include docs/ as Turborepo global dependency so Vercel rebuilds on documentation changes
- Switch API to tsx runner and remap dev ports to LOOP keypad layout (5667-5669)
- Fix process.env usage in migrate.ts for Node.js ESM compatibility
- Load dotenv in API env.ts and rename DX scripts to db:dev:\* namespace

### Changed

- Extract AppEnv type to decouple production code from test imports
- Curate 17 draft Architecture Decision Records — promote 15, archive 2
