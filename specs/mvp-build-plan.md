# Loop MVP Build Plan

**Created:** 2026-02-19
**Author:** Dorian + Claude

---

## Overview

The Loop MVP is broken into 4 sequential specs, each building on the last. This document contains the plan and the exact `/ideate` prompt to use for each phase.

**Reference docs:**
- Litepaper: `meta/loop-litepaper.md`
- MVP spec: `meta/loop-mvp.md`

---

## Build Order

| Phase | Spec | Focus | Depends On |
|-------|------|-------|------------|
| 1 | Data Layer & Core API | Drizzle schema, migrations, CRUD endpoints, signal ingestion | Nothing — foundation |
| 2 | Prompt & Dispatch Engine | Template CRUD, selection algorithm, Handlebars hydration, dispatch endpoint, prompt reviews | Phase 1 |
| 3 | React Dashboard | Issue list, issue detail, loop activity, goals, prompt health | Phases 1 & 2 |
| 4 | CLI | `loop` command-line tool | Phases 1 & 2 |

Phases 3 and 4 are independent of each other and can be built in parallel.

---

## Phase 1: Data Layer & Core API

**What's in scope:**
- PostgreSQL + Drizzle ORM setup and configuration
- Schema for all 10 entities: Issue, Project, Goal, Label, IssueLabel, IssueRelation, Comment, Signal, PromptTemplate, PromptVersion, PromptReview
- Database migrations
- Full CRUD API endpoints for: issues, projects, goals, labels, relations, comments
- Signal ingestion: `POST /api/signals` (generic) + webhook handlers for PostHog, GitHub, Sentry
- Issue hierarchy constraint enforcement (1 level deep)
- API key auth (simple bearer token)
- Tests for all endpoints

**What's NOT in scope (comes in later phases):**
- Prompt template selection/hydration logic (Phase 2)
- Dispatch endpoint and priority scoring (Phase 2)
- Prompt reviews and improvement loop (Phase 2)
- React dashboard (Phase 3)
- CLI (Phase 4)

### `/ideate` Prompt

```
Loop MVP Phase 1: Data Layer & Core API

Review the following documents for full context:
- `meta/loop-litepaper.md` — The Loop vision and architecture
- `meta/loop-mvp.md` — The complete MVP specification

We are building the Loop MVP in 4 phases (see `specs/mvp-build-plan.md`). This is Phase 1: the data foundation that everything else builds on.

## What to Build

Set up PostgreSQL + Drizzle ORM in the existing Hono API (`apps/api/`) and implement the full data layer and core CRUD API:

**Database schema for all 10 entities** (see "Domain Model" section of the MVP doc):
- Issue (with type enum: signal/hypothesis/plan/task/monitor, status enum: triage/backlog/todo/in_progress/done/canceled, priority int, hierarchy constraint of 1 level deep, JSONB fields for signalPayload/hypothesis/commits/pullRequests)
- Project (with status and health enums)
- Goal (with metric tracking fields, status enum)
- Label (with color)
- IssueLabel (join table)
- IssueRelation (with type enum: blocks/blocked_by/related/duplicate)
- Comment (threaded with parentId, authorType enum: human/agent)
- Signal (with source, type, severity, JSONB payload, linked to Issue)
- PromptTemplate (with JSONB conditions, specificity, projectId scope)
- PromptVersion (with usage metrics fields, status enum: active/draft/retired)
- PromptReview (with clarity/completeness/relevance scores 1-5)

**CRUD API endpoints** (see "API Endpoints" section of the MVP doc):
- Issues: GET/POST/GET:id/PATCH:id/DELETE:id with filtering (status, type, project, label, priority)
- Projects: GET/POST/GET:id/PATCH:id/DELETE:id
- Goals: GET/POST/PATCH:id/DELETE:id
- Labels: GET/POST/DELETE:id
- Relations: POST on issues/:id/relations, DELETE on relations/:id
- Comments: GET/POST on issues/:id/comments

**Signal ingestion** (see "Signal Ingestion" section of the MVP doc):
- POST /api/signals — Generic signal endpoint that creates a Signal record + triage Issue
- POST /api/signals/posthog — PostHog webhook handler
- POST /api/signals/github — GitHub webhook handler
- POST /api/signals/sentry — Sentry webhook handler

**Also include:**
- Issue hierarchy constraint: reject creating a child of an issue that already has a parent
- API key auth via Bearer token (single key for MVP)
- Proper error handling and validation
- Tests for all endpoints

**NOT in scope for this phase** (will be built in later phases):
- Prompt selection/hydration logic (Phase 2)
- Dispatch endpoint `/api/dispatch/next` and priority scoring (Phase 2)
- Prompt review submission endpoint behavior beyond CRUD (Phase 2)
- Dashboard endpoints `/api/dashboard/*` (Phase 3)
- React frontend (Phase 3)
- CLI tool (Phase 4)

The prompt template, version, and review tables should be created in the schema now (so the full schema is in place), but the smart selection algorithm and Handlebars hydration will be implemented in Phase 2. For now, just provide basic CRUD for templates and versions.
```

---

## Phase 2: Prompt & Dispatch Engine

**What's in scope:**
- Prompt template conditions-based selection algorithm
- Handlebars template hydration with full context injection
- Shared partials system (api_reference, review_instructions, parent_context, etc.)
- `GET /api/dispatch/next` — priority scoring, atomic claim, returns issue + hydrated prompt
- `GET /api/dispatch/queue` — preview without claiming
- `POST /api/prompt-reviews` — structured agent feedback
- Prompt improvement loop trigger (auto-create issue when review scores drop)
- Default prompt templates (5 templates, one per issue type)
- `GET /api/templates/preview/:issueId` — preview template selection + hydration
- Tests for selection algorithm, hydration, priority scoring, and dispatch

**What's NOT in scope (comes in later phases):**
- React dashboard (Phase 3)
- CLI (Phase 4)

### `/ideate` Prompt

```
Loop MVP Phase 2: Prompt & Dispatch Engine

Review the following documents for full context:
- `meta/loop-litepaper.md` — The Loop vision and architecture
- `meta/loop-mvp.md` — The complete MVP specification
- `specs/mvp-build-plan.md` — The 4-phase build plan

Also review the work completed in Phase 1 by examining:
- The Drizzle schema in `apps/api/` (look for schema files)
- The existing API routes in `apps/api/`
- Any tests from Phase 1

We are building Phase 2: the prompt engine and dispatch system. Phase 1 (data layer + CRUD API) is complete. The database schema and all CRUD endpoints are in place.

## What to Build

This is Loop's core differentiator — the system that selects the right prompt template, hydrates it with context, and dispatches work to agents.

**Prompt selection algorithm** (see "Prompt Selection" section of the MVP doc):
- Build context object from issue: { type, signalSource, labels[], project, hasFailedSessions, hypothesisConfidence, ... }
- Find all templates where every condition key matches the context
- Sort by: project-specific first, then specificity descending
- First match wins; fall back to default template for the issue's type
- This is ~20 lines of deterministic logic, no AI

**Prompt hydration** (see "Prompt Hydration" section of the MVP doc):
- Use Handlebars to render templates with full system state
- Template variables: issue.*, parent.*, siblings, children, project.*, goal.*, labels, blocking, blockedBy, previousSessions, loopUrl, loopToken, meta.*
- Shared partials: api_reference, review_instructions, parent_context, sibling_context, project_and_goal_context

**Dispatch endpoint** (see "Priority Logic" section of the MVP doc):
- GET /api/dispatch/next — Selects highest-priority unblocked issue, claims it atomically (sets status to in_progress), selects + hydrates prompt, returns issue + prompt + meta
- GET /api/dispatch/queue — Preview the dispatch queue without claiming
- Priority scoring: priority weight (urgent=100, high=75, medium=50, low=25, none=10) + goal alignment bonus (+20) + age bonus (+1/day) + type ordering (signal > hypothesis > plan > task > monitor)
- Filter: status=todo only, exclude blocked issues

**Prompt reviews** (see "Prompt Reviews" section of the MVP doc):
- POST /api/prompt-reviews — Submit structured feedback (clarity, completeness, relevance 1-5 + free text)
- Accumulate review scores on PromptVersion records
- Prompt improvement loop trigger: when average review score drops below threshold (default 3.5) or N reviews accumulate (default 15), auto-create an improvement issue

**Default templates** (see "Default Prompt Templates" section of the MVP doc):
- signal-triage (conditions: { type: "signal" }, specificity: 10)
- hypothesis-planning (conditions: { type: "hypothesis" }, specificity: 10)
- task-execution (conditions: { type: "task" }, specificity: 10)
- plan-decomposition (conditions: { type: "plan" }, specificity: 10)
- monitor-check (conditions: { type: "monitor" }, specificity: 10)
- Seed these via a migration or startup script

**Preview endpoint:**
- GET /api/templates/preview/:issueId — Select template + hydrate for a given issue (for debugging/development)

**NOT in scope for this phase:**
- React dashboard (Phase 3)
- CLI tool (Phase 4)
- Auto-promote prompt versions (post-MVP)
```

---

## Phase 3: React Dashboard

**What's in scope:**
- 5 dashboard views in the existing React app (`apps/app/`)
- Dashboard API endpoints in `apps/api/`
- Data fetching with TanStack Query
- Tailwind CSS 4 + shadcn/ui styling

### `/ideate` Prompt

```
Loop MVP Phase 3: React Dashboard

Review the following documents for full context:
- `meta/loop-litepaper.md` — The Loop vision and architecture
- `meta/loop-mvp.md` — The complete MVP specification (see "React Dashboard" section)
- `specs/mvp-build-plan.md` — The 4-phase build plan

Also review the work completed in Phases 1 and 2 by examining:
- The Drizzle schema and API routes in `apps/api/`
- The dispatch and prompt system implementation
- The existing React app structure in `apps/app/`
- Any shared UI components already in place

We are building Phase 3: the React dashboard. Phases 1 (data layer + CRUD) and 2 (prompt engine + dispatch) are complete. The full API is available.

## What to Build

Build 5 dashboard views in the existing React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui app (`apps/app/`). Use TanStack Query for data fetching.

**Dashboard API endpoints** (add to `apps/api/`):
- GET /api/dashboard/stats — Issue counts by status/type, goal progress, loop velocity
- GET /api/dashboard/loop — Recent loop activity (signal → hypothesis → task → outcome chain)
- GET /api/dashboard/prompts — Prompt health: usage counts, review scores, versions

**View 1: Issue List** (default view)
- Filterable table of all issues
- Columns: number, title, type (with icon/color), status, priority, project, labels, created, updated
- Filters: status, type, project, label, priority
- Click row → opens issue detail

**View 2: Issue Detail** (side panel or full page)
- Issue metadata: type, status, priority, project, labels
- Description (rendered markdown)
- Parent issue (if child) or children list (if root)
- Relations (blocking/blocked by with links)
- Agent results: summary, commits, PRs
- Threaded comments
- Signal data display (if type=signal, show source + payload)
- Hypothesis data display (if type=hypothesis, show statement, confidence, evidence, validation criteria)

**View 3: Loop Activity** (the "wow" view)
- Timeline/feed showing the autonomous loop in action
- Each entry shows: signal received → hypothesis created → tasks created → tasks completed → monitor checking → hypothesis validated/invalidated
- Visual chain linking related issues
- This view demonstrates the core value proposition

**View 4: Goals Dashboard**
- Overview of all active goals with progress indicators
- Goal title, target value, current value, trend arrow
- Linked project with status
- Issues contributing to each goal

**View 5: Prompt Health**
- Overview of all prompt templates with quality metrics
- Template name, slug, active version, usage count
- Average review scores (clarity, completeness, relevance)
- Completion rate (% of dispatched issues that reached done)
- Version history with changelogs
- "Needs attention" flag when score drops below threshold

**NOT in scope for this phase:**
- CLI tool (Phase 4 — independent, can be built in parallel)
- Prompt template editing UX (post-MVP)
- Custom/saved views (post-MVP)
```

---

## Phase 4: CLI

**What's in scope:**
- `loop` CLI tool for issue management, signals, triage, projects, goals, templates, dispatch, config, and status
- Published as npm package or local binary

### `/ideate` Prompt

```
Loop MVP Phase 4: CLI Tool

Review the following documents for full context:
- `meta/loop-litepaper.md` — The Loop vision and architecture
- `meta/loop-mvp.md` — The complete MVP specification (see "CLI" section)
- `specs/mvp-build-plan.md` — The 4-phase build plan

Also review the work completed in Phases 1-3 by examining:
- The API routes in `apps/api/` (the CLI will call these)
- The data model and types
- Any shared packages in the monorepo

We are building Phase 4: the CLI. Phases 1-3 are complete. The full API and dashboard are available. The CLI is a thin client that calls the Loop API.

## What to Build

Build a `loop` CLI tool that provides command-line access to the Loop API. This should live in a new `apps/cli/` or `packages/cli/` directory in the monorepo.

**Issue management:**
- loop list — List issues (default: current + recent)
- loop list --status todo — Filter by status
- loop list --type signal — Filter by type
- loop list --project "onboarding" — Filter by project
- loop show 42 — Issue detail with parent + children + relations
- loop create "Fix login timeout" — Create issue (interactive prompts for type, priority, etc.)
- loop create --type bug --priority 2 "Login times out after 30s" — Create with flags

**Signal submission:**
- loop signal "Users reporting slow checkout" — Manual signal
- loop signal --source manual --severity medium "..." — With metadata

**Triage:**
- loop triage — Show triage queue
- loop triage accept 31 — Accept into backlog
- loop triage decline 32 "Noise" — Decline with reason

**Projects and goals:**
- loop projects — List projects
- loop goals — List goals with progress

**Prompt templates:**
- loop templates — List templates with review scores
- loop templates show task-execute — Show template details + version history
- loop templates promote <version-id> — Promote draft version to active

**Dispatch (debugging/manual use):**
- loop next — Preview what dispatch/next would return
- loop dispatch 42 — Manually mark issue for dispatch

**Configuration:**
- loop config set url https://loop.example.com
- loop config set token tok_...

**Status:**
- loop status — Loop health: queue depth, active issues, goal progress

**Implementation notes:**
- Use a CLI framework (Commander.js, oclif, or similar)
- Config stored in ~/.loop/config.json or similar
- Table output for lists (use cli-table3 or similar)
- Colored output for status/priority indicators
- JSON output flag (--json) for scripting

**NOT in scope:**
- Interactive TUI (post-MVP)
- Shell completions (post-MVP)
- Plugin system (post-MVP)
```

---

## Execution Checklist

- [ ] Phase 1: `/ideate` → `/ideate-to-spec` → `/spec:decompose` → `/spec:execute`
- [ ] Phase 2: `/ideate` → `/ideate-to-spec` → `/spec:decompose` → `/spec:execute`
- [ ] Phase 3: `/ideate` → `/ideate-to-spec` → `/spec:decompose` → `/spec:execute`
- [ ] Phase 4: `/ideate` → `/ideate-to-spec` → `/spec:decompose` → `/spec:execute`
