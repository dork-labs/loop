const LLMS_TXT_CONTENT = `# Loop

> Loop is the Autonomous Improvement Engine — an open-source data layer and
> prompt engine that turns signals into prioritized, actionable issues for
> AI agents. REST API at https://app.looped.me/api.

## Getting Started

- [Quick Start](https://www.looped.me/docs/quickstart): Install and create your first issue
- [Authentication](https://www.looped.me/docs/auth): Bearer token setup with \`loop_\` prefixed keys
- [Core Concepts](https://www.looped.me/docs/concepts): Signals, issues, projects, goals, dispatch

## Issues

- [List Issues](https://www.looped.me/docs/api/issues): GET /api/issues — filter by status, type, project
- [Create Issue](https://www.looped.me/docs/api/issues-create): POST /api/issues
- [Update Issue](https://www.looped.me/docs/api/issues-update): PATCH /api/issues/:id
- [Issue Relations](https://www.looped.me/docs/api/relations): Blocking and dependency graphs

## Signals

- [Ingest Signal](https://www.looped.me/docs/api/signals): POST /api/signals — creates signal + triage issue
- [PostHog Webhook](https://www.looped.me/docs/webhooks/posthog)
- [Sentry Webhook](https://www.looped.me/docs/webhooks/sentry)
- [GitHub Webhook](https://www.looped.me/docs/webhooks/github)

## Agent Dispatch

- [Get Next Task](https://www.looped.me/docs/api/dispatch): Highest-priority unblocked issue with instructions
- [Complete Task](https://www.looped.me/docs/api/complete): Report completion with outcome notes

## Projects and Goals

- [Projects](https://www.looped.me/docs/api/projects): Group issues toward shared objectives
- [Goals](https://www.looped.me/docs/api/goals): Measurable success indicators

## Prompt Templates

- [Templates](https://www.looped.me/docs/prompts/overview): Manage agent instruction templates
- [Versions](https://www.looped.me/docs/prompts/versions): Version control and promotion

## Agent Integration

- [Agent Skill](https://www.looped.me/docs/agent-skill): \`npx openskills install @dork-labs/loop\`
- [AGENTS.md Snippet](https://www.looped.me/docs/agents-md): Paste into your repo
- [Cursor Rule](https://www.looped.me/docs/cursor-rule): Auto-activates in Cursor
- [MCP Server](https://www.looped.me/docs/mcp): Native tool access via MCP

## Optional

- [Dashboard Stats](https://www.looped.me/docs/api/dashboard): System health metrics
- [OpenAPI Spec](https://app.looped.me/api/openapi.json): Machine-readable API schema
- [Self-Hosting](https://www.looped.me/docs/self-hosting)`;

export async function GET() {
  return new Response(LLMS_TXT_CONTENT, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
