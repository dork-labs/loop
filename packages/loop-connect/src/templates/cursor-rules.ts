/** Cursor rules file content for Loop integration. Sourced from packages/loop-skill/templates/loop.mdc. */
export const CURSOR_RULES_CONTENT = `---
description: >
  Use when working with Loop (looped.me), the autonomous improvement engine.
  Apply when: creating or updating issues via the Loop API, ingesting signals,
  fetching the next work item for an agent, managing projects or goals, or
  accessing prompt templates. Loop API base: https://app.looped.me/api.
alwaysApply: false
---

# Loop — Autonomous Improvement Engine

## Auth

\`\`\`bash
export LOOP_API_KEY=loop_...
\`\`\`

All \`/api/*\` endpoints: \`Authorization: Bearer $LOOP_API_KEY\`

## Common Operations

\`\`\`bash
# List open issues
curl -H "Authorization: Bearer $LOOP_API_KEY" \\
  "https://app.looped.me/api/issues?status=open"

# Create issue
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"<title>","type":"bug|feature|task"}' \\
  https://app.looped.me/api/issues

# Ingest a signal
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"source":"custom","title":"<title>","data":{}}' \\
  https://app.looped.me/api/signals
\`\`\`

## Issue Types

\`signal\` | \`hypothesis\` | \`plan\` | \`task\` | \`monitor\`

## Status Values

\`triage\` | \`backlog\` | \`todo\` | \`in_progress\` | \`done\` | \`canceled\`

## Docs

Full API: https://www.looped.me/docs
Machine-readable: https://www.looped.me/llms.txt
`;
