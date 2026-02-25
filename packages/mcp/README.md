# @dork-labs/loop-mcp

MCP server for [Loop](https://www.looped.me) — the Autonomous Improvement Engine.

Connects any MCP-compatible AI agent (Claude Code, Cursor, OpenHands, Windsurf) to your Loop instance. Agents call MCP tools instead of raw HTTP endpoints.

## Installation

```bash
npm install @dork-labs/loop-mcp
# or
pnpm add @dork-labs/loop-mcp
```

## Quick Start

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "loop": {
      "command": "npx",
      "args": ["-y", "@dork-labs/loop-mcp"],
      "env": {
        "LOOP_API_KEY": "your-api-key",
        "LOOP_API_URL": "https://api.looped.me"
      }
    }
  }
}
```

Or use `loop-connect` to configure automatically:

```bash
npx @dork-labs/loop-connect
```

## Available Tools

| Tool | Description |
| ---- | ----------- |
| `get-next-task` | Fetch highest-priority unblocked issue for dispatch |
| `complete-task` | Mark task done and record outcomes |
| `create-issue` | Create a new issue |
| `update-issue` | Update an existing issue |
| `list-issues` | Query issues with filters |
| `get-issue` | Fetch a single issue by ID |
| `ingest-signal` | Ingest an external signal (errors, metrics, feedback) |
| `create-comment` | Add a comment to an issue |
| `get-dashboard` | System health metrics and activity |

## Programmatic Usage

```typescript
import { createLoopMcpServer } from '@dork-labs/loop-mcp';

const server = createLoopMcpServer({
  apiKey: 'your-api-key',
  apiUrl: 'https://api.looped.me',
});

await server.connect(transport);
```

## HTTP Server Mode

Includes an optional Hono HTTP transport for edge/server deployments. Requires `hono` as a peer dependency.

```typescript
import { createHttpApp } from '@dork-labs/loop-mcp/http';

const app = createHttpApp({
  apiKey: process.env.LOOP_API_KEY!,
});
```

## License

MIT
