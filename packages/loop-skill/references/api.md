# Loop API Reference

Loop exposes a REST API for managing issues, signals, projects, goals, prompt templates, and dashboard metrics.

**Base URL:** `https://app.looped.me/api`

## Authentication

All `/api/*` endpoints require a Bearer token:

```
Authorization: Bearer $LOOP_API_KEY
```

Set the environment variable before making calls:

```bash
export LOOP_API_KEY=loop_...
```

Get a key at https://app.looped.me/settings/api-keys.

---

## Protected Endpoints

All endpoints below require `Authorization: Bearer $LOOP_API_KEY`.

### Issues

| Method   | Path                        | Description                                                    |
| -------- | --------------------------- | -------------------------------------------------------------- |
| `GET`    | `/api/issues`               | List issues (filterable by status, type, projectId; paginated) |
| `POST`   | `/api/issues`               | Create an issue                                                |
| `GET`    | `/api/issues/:id`           | Get issue by ID with labels, relations, comments               |
| `PATCH`  | `/api/issues/:id`           | Update an issue                                                |
| `DELETE` | `/api/issues/:id`           | Soft-delete an issue                                           |
| `POST`   | `/api/issues/:id/relations` | Create a relation between two issues                           |
| `GET`    | `/api/issues/:id/comments`  | List comments for an issue (threaded)                          |
| `POST`   | `/api/issues/:id/comments`  | Add a comment to an issue                                      |

### Projects

| Method   | Path                | Description                            |
| -------- | ------------------- | -------------------------------------- |
| `GET`    | `/api/projects`     | List projects (paginated)              |
| `POST`   | `/api/projects`     | Create a project                       |
| `GET`    | `/api/projects/:id` | Get project with goal and issue counts |
| `PATCH`  | `/api/projects/:id` | Update a project                       |
| `DELETE` | `/api/projects/:id` | Soft-delete a project                  |

### Goals

| Method   | Path             | Description            |
| -------- | ---------------- | ---------------------- |
| `GET`    | `/api/goals`     | List goals (paginated) |
| `POST`   | `/api/goals`     | Create a goal          |
| `GET`    | `/api/goals/:id` | Get goal by ID         |
| `PATCH`  | `/api/goals/:id` | Update a goal          |
| `DELETE` | `/api/goals/:id` | Soft-delete a goal     |

### Labels

| Method   | Path              | Description             |
| -------- | ----------------- | ----------------------- |
| `GET`    | `/api/labels`     | List labels (paginated) |
| `POST`   | `/api/labels`     | Create a label          |
| `DELETE` | `/api/labels/:id` | Soft-delete a label     |

### Relations

| Method   | Path                 | Description            |
| -------- | -------------------- | ---------------------- |
| `DELETE` | `/api/relations/:id` | Hard-delete a relation |

### Signals

| Method | Path           | Description                                     |
| ------ | -------------- | ----------------------------------------------- |
| `POST` | `/api/signals` | Ingest a signal (creates signal + linked issue) |

### Prompt Templates

| Method   | Path                                             | Description                       |
| -------- | ------------------------------------------------ | --------------------------------- |
| `GET`    | `/api/templates`                                 | List prompt templates (paginated) |
| `POST`   | `/api/templates`                                 | Create a prompt template          |
| `GET`    | `/api/templates/:id`                             | Get template with active version  |
| `PATCH`  | `/api/templates/:id`                             | Update a template                 |
| `DELETE` | `/api/templates/:id`                             | Soft-delete a template            |
| `GET`    | `/api/templates/:id/versions`                    | List versions for a template      |
| `POST`   | `/api/templates/:id/versions`                    | Create a new version              |
| `POST`   | `/api/templates/:id/versions/:versionId/promote` | Promote a version to active       |
| `GET`    | `/api/templates/:id/reviews`                     | List reviews across all versions  |
| `POST`   | `/api/prompt-reviews`                            | Create a prompt review            |

### Dashboard

| Method | Path                      | Description                         |
| ------ | ------------------------- | ----------------------------------- |
| `GET`  | `/api/dashboard/stats`    | System health metrics               |
| `GET`  | `/api/dashboard/activity` | Signal chains for activity timeline |
| `GET`  | `/api/dashboard/prompts`  | Template health with scores         |

---

## Webhook Endpoints

Webhook endpoints use provider-specific authentication, not Bearer tokens.

| Method | Path                   | Auth                                  | Description           |
| ------ | ---------------------- | ------------------------------------- | --------------------- |
| `POST` | `/api/signals/posthog` | `POSTHOG_WEBHOOK_SECRET`              | PostHog metric alerts |
| `POST` | `/api/signals/github`  | `GITHUB_WEBHOOK_SECRET` (HMAC-SHA256) | GitHub events         |
| `POST` | `/api/signals/sentry`  | `SENTRY_CLIENT_SECRET` (HMAC-SHA256)  | Sentry error alerts   |

---

## Public Endpoints

No authentication required.

| Method | Path      | Description                                 |
| ------ | --------- | ------------------------------------------- |
| `GET`  | `/health` | Health check (`{ ok, service, timestamp }`) |
| `GET`  | `/`       | Service info (`{ name, version }`)          |

---

## Request/Response Examples

### Create an Issue

```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix OAuth redirect showing blank page",
    "type": "bug",
    "status": "todo",
    "priority": 1,
    "projectId": "clx..."
  }' \
  https://app.looped.me/api/issues
```

Response (`201`):

```json
{
  "id": "clx...",
  "title": "Fix OAuth redirect showing blank page",
  "type": "bug",
  "status": "todo",
  "priority": 1,
  "projectId": "clx...",
  "createdAt": "2026-02-23T12:00:00.000Z",
  "updatedAt": "2026-02-23T12:00:00.000Z"
}
```

### List Issues

```bash
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open&type=bug&limit=10&offset=0"
```

Response (`200`):

```json
{
  "data": [
    {
      "id": "clx...",
      "title": "Fix OAuth redirect showing blank page",
      "type": "bug",
      "status": "todo",
      "priority": 1
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0
}
```

### Ingest a Signal

```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "agent",
    "title": "Error rate spike detected",
    "data": { "errorCount": 47, "threshold": 10 }
  }' \
  https://app.looped.me/api/signals
```

Response (`201`):

```json
{
  "signal": {
    "id": "clx...",
    "source": "agent",
    "title": "Error rate spike detected",
    "data": { "errorCount": 47, "threshold": 10 },
    "createdAt": "2026-02-23T12:00:00.000Z"
  },
  "issue": {
    "id": "clx...",
    "title": "Error rate spike detected",
    "type": "signal",
    "status": "triage"
  }
}
```

### Create a Project

```bash
curl -X POST \
  -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Improve Onboarding",
    "description": "Increase sign-up conversion to 4%"
  }' \
  https://app.looped.me/api/projects
```

Response (`201`):

```json
{
  "id": "clx...",
  "name": "Improve Onboarding",
  "description": "Increase sign-up conversion to 4%",
  "createdAt": "2026-02-23T12:00:00.000Z",
  "updatedAt": "2026-02-23T12:00:00.000Z"
}
```

### Dashboard Stats

```bash
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  https://app.looped.me/api/dashboard/stats
```

Response (`200`):

```json
{
  "issues": { "total": 142, "open": 38, "done": 97, "canceled": 7 },
  "signals": { "total": 256, "last24h": 12 },
  "projects": { "total": 5, "active": 3 },
  "loopVelocity": { "avgHours": 18.4 }
}
```
