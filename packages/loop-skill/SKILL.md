---
name: loop
description: >
  Interact with Loop (looped.me), the autonomous improvement engine for AI-powered
  development. Use when: (1) creating, listing, or updating issues in Loop, (2) ingesting
  signals or anomalies into the triage queue, (3) fetching the next prioritized work item
  for an agent to execute, (4) managing projects, goals, or prompt templates, or
  (5) checking system health via the dashboard API. Loop's REST API is at
  https://app.looped.me/api with Bearer token auth.
license: MIT
compatibility: Requires internet access to reach https://app.looped.me
metadata:
  author: dork-labs
  version: "1.0"
---

# Loop

Loop is an autonomous improvement engine with a REST API at https://app.looped.me/api.
Two core capabilities: **issue management** (create, list, update, dispatch work items)
and **signal ingestion** (webhook-style data that auto-creates triage issues).

## Authentication

Set before making API calls:

```bash
export LOOP_API_KEY=loop_...
```

Base URL: `https://app.looped.me/api`
All `/api/*` endpoints require: `Authorization: Bearer $LOOP_API_KEY`

Get a key at https://app.looped.me/settings/api-keys.
If the env var is not set, ask the user for their API key.

## The Dispatch Loop

The core agent workflow:

1. **Get next task:** Fetch the highest-priority unblocked issue
2. **Do the work:** Execute what the issue describes
3. **Report completion:** Update the issue status and add outcome notes
4. **Create discovered issues:** If you find bugs or tasks during work, create new issues
5. **Repeat:** Get the next task

## Common Operations

### Get the next issue to work on

```bash
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open&limit=1"
```

### Create an issue

```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login redirect","type":"bug"}' \
  https://app.looped.me/api/issues
```

### Ingest a signal

```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"agent","title":"Error rate spike","data":{"count":47}}' \
  https://app.looped.me/api/signals
```

### Complete an issue

```bash
curl -X PATCH -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"done"}' \
  https://app.looped.me/api/issues/{id}
```

### Add a progress comment

```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"Investigating root cause...","authorName":"agent"}' \
  https://app.looped.me/api/issues/{id}/comments
```

## Issue Types

`signal` | `hypothesis` | `plan` | `task` | `monitor`

## Status Values

`triage` | `backlog` | `todo` | `in_progress` | `done` | `canceled`

## Error Handling

- **401:** Check `LOOP_API_KEY` is set and valid
- **404:** Issue/project ID doesn't exist — use list endpoints to find valid IDs
- **422:** Validation error — check required fields in request body

## Documentation

1. Fetch the docs index: `curl -s https://www.looped.me/llms.txt`
2. Full endpoint reference: see [references/api.md](references/api.md)
