# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Fixed

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
- Load dotenv in API env.ts and rename DX scripts to db:dev:* namespace

### Changed

- Extract AppEnv type to decouple production code from test imports
- Curate 17 draft Architecture Decision Records — promote 15, archive 2
