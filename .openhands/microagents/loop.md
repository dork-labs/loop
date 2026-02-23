---
name: loop
agent: CodeActAgent
trigger_type: keyword
triggers:
  - loop
  - looped
  - looped.me
  - loop api
  - loop issue
  - ingest signal
---

# Loop — Autonomous Improvement Engine

Loop is an open-source REST API for managing issues, signals, projects, and
prompt templates in an autonomous development workflow.

## API Base URL

```
https://app.looped.me/api
```

All protected endpoints require: `Authorization: Bearer $LOOP_API_KEY`

## Key Endpoints

| Method | Path                 | Description                                     |
| ------ | -------------------- | ----------------------------------------------- |
| GET    | /api/issues          | List issues (filter: status, type, projectId)   |
| POST   | /api/issues          | Create an issue                                 |
| PATCH  | /api/issues/:id      | Update an issue                                 |
| DELETE | /api/issues/:id      | Soft-delete an issue                            |
| POST   | /api/signals         | Ingest a signal (creates signal + triage issue) |
| GET    | /api/projects        | List projects                                   |
| POST   | /api/projects        | Create a project                                |
| GET    | /api/goals           | List goals                                      |
| GET    | /api/dashboard/stats | System health metrics                           |

## Create an Issue

```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login flow","type":"bug"}' \
  https://app.looped.me/api/issues
```

## Ingest a Signal

```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"agent","title":"Error spike","data":{"count":47}}' \
  https://app.looped.me/api/signals
```

## Documentation

Full docs: https://www.looped.me/docs
Machine-readable index: https://www.looped.me/llms.txt
