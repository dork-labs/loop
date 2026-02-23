# @dork-labs/loop

Agent skill for **Loop** — the autonomous improvement engine.

Loop is an open-source data layer and prompt engine that turns signals into prioritized, actionable issues for AI agents. This package teaches AI agents how to use Loop's REST API to create issues, ingest signals, fetch work items, and manage projects and goals.

## What's Included

This package contains:

- **SKILL.md** — Cross-agent skill definition for Claude Code, Codex, Cursor, Amp, Goose, and other AI agent platforms that support agent skills
- **templates/** — Ready-to-use integration templates for different platforms:
  - `AGENTS.md` — Paste into your repo's AGENTS.md file
  - `loop.mdc` — Cursor rule file for `.cursor/rules/`
  - `openhands-loop.md` — OpenHands microagent for `.openhands/microagents/`
- **references/api.md** — Full API endpoint reference with request/response examples
- **README.md** — This file

## Installation

### Via openskills

The easiest way to install Loop skill across any agent platform that supports openskills:

```bash
npx openskills install @dork-labs/loop
```

This will:

- Download the package
- Copy SKILL.md to your agent's skill directory
- Register the skill for discovery

### Via npm

Install the package as a dependency in your project:

```bash
npm install @dork-labs/loop
```

Then reference the files in `node_modules/@dork-labs/loop/` when configuring your agent.

## Artifact Descriptions

### SKILL.md

The primary agent skill definition in agentskills.io format. This file teaches agents:

- How to authenticate with Loop (Bearer token via `$LOOP_API_KEY`)
- The core dispatch loop workflow (get task → do work → report completion)
- Common API operations (create issues, list issues, ingest signals, etc.)
- Issue types and status values
- Error handling patterns

**Use this for:** Claude Code, Codex, Cursor, Amp, Goose, and any agent platform that loads SKILL.md files.

### templates/AGENTS.md

A ready-to-paste snippet for your repository's AGENTS.md file. Follows the Linux Foundation agents.md standard.

Includes:

- Auth configuration (LOOP_API_KEY)
- When to create issues
- Quick reference curl commands
- Links to full documentation

**Use this for:** Adding Loop integration context to your repo that agents read on every session.

### templates/loop.mdc

A Cursor rule file in MDC (Markdown with Config) format. Place in `.cursor/rules/loop.mdc`.

Includes:

- When to apply the rule (on request, not auto-applied)
- Auth setup
- Common operations
- Issue types and status values
- Documentation links

**Use this for:** Cursor IDE users who want agent-requested Loop context in their editor.

### templates/openhands-loop.md

An OpenHands microagent definition with keyword triggers (`loop`, `looped`, `looped.me`, `loop api`, `loop issue`, `ingest signal`).

Place in `.openhands/microagents/loop.md`.

Includes:

- Key endpoints table
- Create issue example
- Ingest signal example
- Full documentation links

**Use this for:** OpenHands agent users who want Loop context triggered by keywords.

### references/api.md

A complete API endpoint reference loaded on-demand by agents who need full technical details.

Includes:

- All protected endpoints (`/api/*`)
- Webhook endpoints (`/api/signals/*`)
- Public endpoints
- Request/response examples for key operations

**Use this for:** Looking up exact endpoint paths, methods, and parameters.

## Quick Start

### Get Your API Key

1. Visit https://app.looped.me/settings/api-keys
2. Create a new API key (will be prefixed `loop_`)
3. Set it as an environment variable:

```bash
export LOOP_API_KEY=loop_...
```

### Create Your First Issue

```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Fix login redirect","type":"bug"}' \
  https://app.looped.me/api/issues
```

### Get the Next Priority Task

```bash
curl -H "Authorization: Bearer $LOOP_API_KEY" \
  "https://app.looped.me/api/issues?status=open&limit=1"
```

### Ingest a Signal (Alert)

```bash
curl -X POST -H "Authorization: Bearer $LOOP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"custom","title":"Error rate spike","data":{"count":47}}' \
  https://app.looped.me/api/signals
```

## Documentation

- **User Docs:** https://www.looped.me/docs
- **API Reference:** https://www.looped.me/docs/api
- **Machine-Readable Index:** https://www.looped.me/llms.txt
- **GitHub:** https://github.com/dork-labs/loop

## License

MIT. See the Loop repository for details.

## About Loop

Loop is developed by **Dork Labs**, the team behind DorkOS — the open-source web interface and CLI for Claude Code.

Learn more at https://looped.me
