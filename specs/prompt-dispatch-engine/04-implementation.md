# Implementation Summary: Prompt & Dispatch Engine (MVP Phase 2)

**Created:** 2026-02-20
**Last Updated:** 2026-02-20
**Spec:** specs/prompt-dispatch-engine/02-specification.md

## Progress

**Status:** Complete
**Tasks Completed:** 20 / 20

## Tasks Completed

### Session 1 - 2026-02-20

- Task #1: Add handlebars dependency (handlebars@4.7.8)
- Task #2: Implement priority-scoring.ts
- Task #3: Implement template selection types and functions
- Task #4: Write unit tests for priority-scoring (18 tests passing)
- Task #5: Write unit tests for template selection (14 tests passing)
- Task #6: Implement partials.ts with all 5 partial contents
- Task #9: Add triple-brace validation to version creation
- Task #7: Implement Handlebars setup (HydrationContext, initHandlebars, compileTemplate, hydrateTemplate)
- Task #11: Generate custom migration and seed 5 default templates
- Task #8: Implement buildHydrationContext with parallel DB queries
- Task #10: Write hydration unit tests (7 tests, 21 total in prompt-engine.test.ts)
- Task #17: Replace simple average with EWMA scoring (alpha=0.3, 7 tests passing)
- Task #12: Implement dispatch.ts with GET /next (FOR UPDATE SKIP LOCKED) and GET /queue
- Task #13: Implement template preview endpoint (GET /preview/:issueId)
- Task #15: Update conditions validation to strict TemplateConditionsSchema
- Task #18: Add improvement loop trigger (threshold check + auto-create issue)
- Task #14: Mount dispatch routes in app.ts
- Task #16: Write dispatch integration tests (12 tests)
- Task #19: Write EWMA + improvement loop integration tests (4 tests, 11 total in prompt-reviews.test.ts)
- Task #20: Full verification — 208 tests passing, 0 errors, typecheck clean

## Files Modified/Created

**Source files:**

- `apps/api/src/lib/priority-scoring.ts` (new) — Priority scoring constants and scoreIssue()
- `apps/api/src/lib/prompt-engine.ts` (new) — Template selection + Handlebars hydration (HydrationContext, initHandlebars, compileTemplate, hydrateTemplate)
- `apps/api/package.json` (modified) — Added handlebars@^4.7.0
- `apps/api/src/lib/partials.ts` (new) — 5 Handlebars partials (api_reference, review_instructions, parent_context, sibling_context, project_and_goal_context)
- `apps/api/src/routes/templates.ts` (modified) — Triple-brace validation, strict conditions schema, preview endpoint
- `apps/api/src/routes/prompt-reviews.ts` (modified) — EWMA scoring with alpha=0.3, improvement loop trigger
- `apps/api/src/routes/dispatch.ts` (new) — GET /next (FOR UPDATE SKIP LOCKED) + GET /queue
- `apps/api/src/app.ts` (modified) — Mount dispatch routes
- `apps/api/drizzle/migrations/0002_purple_selene.sql` (new) — Seed 5 default templates + versions

**Test files:**

- `apps/api/src/__tests__/priority-scoring.test.ts` (new) — 18 unit tests for scoreIssue()
- `apps/api/src/__tests__/prompt-engine.test.ts` (new) — 21 unit tests (14 selection + 7 hydration)
- `apps/api/src/__tests__/prompt-reviews.test.ts` (modified) — 11 tests (7 existing + 4 EWMA/improvement)
- `apps/api/src/__tests__/dispatch.test.ts` (new) — 12 integration tests for dispatch/next, dispatch/queue, templates/preview

## Known Issues

- `@loop/web` lint has pre-existing failures (unrelated to Phase 2)

## Implementation Notes

### Session 1 — 2026-02-20

- All 20 tasks completed across 8 parallel batches
- Fixed 3 pre-existing template tests broken by seed migration (expected count +5)
- Removed unused `projects` import from dispatch.ts (lint warning)
- Total: 208 tests passing, typecheck clean, 0 lint errors
