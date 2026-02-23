## Loop Integration

This project uses [Loop](https://looped.me) as its autonomous improvement engine.
Loop manages issues, signals, projects, and prompt templates via a REST API.

### Auth

API key is in `LOOP_API_KEY` (environment variable). All endpoints use:
`Authorization: Bearer $LOOP_API_KEY`

Base URL: `https://app.looped.me/api`

### When to Create a Loop Issue

- Bug found during work: `POST /api/issues` with `type: "bug"`
- External anomaly detected: `POST /api/signals`
- Task blocked by another: `POST /api/issues/:id/relations`

### Quick Reference

```bash
# List open issues
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open"

# Create an issue
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"...","type":"bug"}' \
  https://app.looped.me/api/issues

# Dashboard stats
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  https://app.looped.me/api/dashboard/stats
```

### Docs

- Full API: https://www.looped.me/docs
- Machine-readable: https://www.looped.me/llms.txt
- Agent Skill: `npx openskills install @dork-labs/loop`
