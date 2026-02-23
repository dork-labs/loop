---
slug: mcp-server
number: 11
created: 2026-02-22
status: draft
---

# MCP Server — Native AI Agent Interface for Loop

**Status:** Draft
**Authors:** Claude Code, 2026-02-22
**Related:** specs/agent-integration-strategy.md (Feature 2), specs/mcp-server/01-ideation.md

---

## 1. Overview

Build a dual-transport MCP (Model Context Protocol) server package that lets AI agents in Claude Code, Cursor, Windsurf, and any MCP-capable environment interact with Loop natively. The server exposes 9 tools designed around the agent dispatch loop — not a 1:1 REST endpoint mapping. Published as `@dork-labs/loop-mcp` on npm, it lives at `packages/mcp/` in the monorepo.

The signature tool `loop_get_next_task` returns the highest-priority unblocked issue with fully-hydrated dispatch instructions, enabling a complete autonomous work cycle: get task, do work, report completion, repeat.

## 2. Background / Problem Statement

Loop's REST API is fully functional, but AI agents can't easily discover or interact with it. Agents need:

1. **Native protocol support** — MCP is the emerging standard for agent-tool communication. Claude Code, Cursor, Windsurf, and others support it natively.
2. **Intent-oriented tools** — Agents think in terms of "get my next task" and "report completion," not "PATCH /api/issues/:id with status=done then POST /api/issues/:id/comments."
3. **Zero-config setup** — `npx @dork-labs/loop-mcp` should just work with an API key.
4. **Team-wide sharing** — A `.mcp.json` template lets teams share Loop MCP config via version control.

Without an MCP server, agents must be manually configured with REST API details, auth headers, and multi-step workflows for basic operations.

## 3. Goals

- Expose Loop's core capabilities as 9 agent-intent MCP tools
- Support both stdio (local/npx) and Streamable HTTP (remote/API-mounted) transports
- Keep total tool description token budget under 1,000 tokens
- Publish to npm as `@dork-labs/loop-mcp` with CLI entry point
- Provide `.mcp.json` template for team sharing
- Return structured responses via `outputSchema` with text fallback

## 4. Non-Goals

- OAuth 2.1 auth flow (Phase 2, post-launch)
- Remote hosted MCP at mcp.looped.me (requires OAuth)
- Cursor/Claude deeplink buttons (Feature 8: Marketing Site)
- Webhook receiver tools (signals come via existing webhook endpoints)
- Wrapping every REST endpoint (agent-intent tools only)
- MCP SDK v2 migration (wait for stable release)
- Python/Go SDKs
- MCP Registry publishing automation (manual first release)

## 5. Technical Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.26.0 | MCP TypeScript SDK — server, transports, tool registration |
| `@hono/mcp` | latest | Hono middleware for Streamable HTTP transport |
| `ky` | ^1.14 | HTTP client for internal REST API calls |
| `zod` | ^4.3 | Tool input/output schema validation |
| `hono` | ^4 | Peer dependency for HTTP transport handler |

**Dev dependencies:**

| Dependency | Version | Purpose |
|------------|---------|---------|
| `tsup` | latest | Build/bundle for npm publishing |
| `vitest` | ^3.2 | Unit testing |
| `tsx` | latest | Local development |

## 6. Detailed Design

### 6.1 Architecture

```
packages/mcp/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts              # createLoopMcpServer(config) factory
│   ├── stdio.ts              # #!/usr/bin/env node — stdio entry point
│   ├── http.ts               # Hono route handler export
│   ├── client.ts             # Internal ky HTTP client
│   ├── types.ts              # Shared TypeScript types
│   └── tools/
│       ├── index.ts          # registerAllTools(server, client)
│       ├── get-next-task.ts
│       ├── complete-task.ts
│       ├── create-issue.ts
│       ├── update-issue.ts
│       ├── list-issues.ts
│       ├── get-issue.ts
│       ├── ingest-signal.ts
│       ├── create-comment.ts
│       └── get-dashboard.ts
└── __tests__/
    ├── tools.test.ts         # Tool handler unit tests
    └── server.test.ts        # Server creation + transport tests
```

### 6.2 Server Factory

`src/index.ts` exports a single factory function:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createApiClient } from './client.js'
import { registerAllTools } from './tools/index.js'

export interface LoopMcpConfig {
  apiKey: string
  apiUrl?: string // default: 'http://localhost:5667'
}

export function createLoopMcpServer(config: LoopMcpConfig): McpServer {
  const server = new McpServer({
    name: 'loop-mcp',
    version: '0.1.0',
  })

  const client = createApiClient({
    apiKey: config.apiKey,
    apiUrl: config.apiUrl ?? 'http://localhost:5667',
  })

  registerAllTools(server, client)

  return server
}
```

### 6.3 Stdio Entry Point

`src/stdio.ts` — the `npx @dork-labs/loop-mcp` entry point:

```typescript
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createLoopMcpServer } from './index.js'

const apiKey = process.env.LOOP_API_KEY
if (!apiKey) {
  console.error('Missing LOOP_API_KEY environment variable.')
  console.error('Generate one with: node -e "console.log(\'loop_\' + require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  process.exit(1)
}

const server = createLoopMcpServer({
  apiKey,
  apiUrl: process.env.LOOP_API_URL,
})

const transport = new StdioServerTransport()
await server.connect(transport)
```

### 6.4 HTTP Transport (Hono Handler)

`src/http.ts` — mountable on the existing API server:

```typescript
import { StreamableHTTPTransport } from '@hono/mcp'
import { Hono } from 'hono'
import { createLoopMcpServer } from './index.js'

export interface HttpTransportConfig {
  apiKey: string
  apiUrl?: string
}

export function createMcpHandler(config: HttpTransportConfig) {
  const app = new Hono()
  const server = createLoopMcpServer(config)
  const transport = new StreamableHTTPTransport()

  app.all('/*', async (c) => {
    if (!server.isConnected()) {
      await server.connect(transport)
    }
    return transport.handleRequest(c)
  })

  return app
}
```

**Mounting in `apps/api/src/app.ts`:**

```typescript
import { createMcpHandler } from '../../packages/mcp/src/http.js'

// Mount after existing routes
const mcpHandler = createMcpHandler({
  apiKey: env.LOOP_API_KEY,
  apiUrl: env.LOOP_URL,
})
app.route('/mcp', mcpHandler)
```

Note: The MCP HTTP endpoint at `/mcp` does NOT use the `apiKeyAuth` middleware from the API. Instead, auth is handled by the MCP server itself reading the `Authorization` header from incoming MCP requests and passing it through to the REST API via the internal ky client. The `/mcp` endpoint is public-facing — the REST API layer validates the Bearer token on each internal call.

### 6.5 Internal API Client

`src/client.ts` — wraps ky for REST API calls (follows CLI pattern from `apps/cli/src/lib/api-client.ts`):

```typescript
import ky, { type KyInstance } from 'ky'

export interface ApiClientConfig {
  apiKey: string
  apiUrl: string
}

export function createApiClient(config: ApiClientConfig): KyInstance {
  return ky.create({
    prefixUrl: config.apiUrl,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    retry: {
      limit: 2,
      statusCodes: [429, 500, 503],
    },
  })
}
```

### 6.6 Tool Implementations

All 9 tools follow the "outcomes over operations" principle. Each tool:

1. Validates input via Zod schema
2. Calls the REST API via the internal ky client
3. Transforms the response for agent consumption
4. Returns `structuredContent` + text fallback
5. Handles errors with actionable messages (never throws)

#### Tool Annotations

Each tool includes MCP annotations for client hints:

| Tool | `readOnlyHint` | `destructiveHint` | `idempotentHint` |
|------|---------------|-------------------|------------------|
| `loop_get_next_task` | false | false | false |
| `loop_complete_task` | false | false | true |
| `loop_create_issue` | false | false | false |
| `loop_update_issue` | false | false | true |
| `loop_list_issues` | true | false | true |
| `loop_get_issue` | true | false | true |
| `loop_ingest_signal` | false | false | false |
| `loop_create_comment` | false | false | false |
| `loop_get_dashboard` | true | false | true |

#### 6.6.1 loop_get_next_task

Loop's signature tool. Returns the highest-priority unblocked issue with hydrated dispatch instructions.

```typescript
server.registerTool(
  'loop_get_next_task',
  {
    title: 'Get Next Task',
    description: 'Get the highest-priority unblocked issue with dispatch instructions. Atomically claims the issue and transitions it to in_progress. Returns the issue details and a hydrated prompt with full context.',
    inputSchema: z.object({
      projectId: z.string().optional().describe('Filter to a specific project'),
    }),
    outputSchema: z.object({
      issue: z.object({
        id: z.string(),
        number: z.number(),
        title: z.string(),
        type: z.string(),
        priority: z.number(),
        status: z.string(),
      }),
      prompt: z.string().nullable(),
      meta: z.object({
        templateSlug: z.string(),
        templateId: z.string(),
        versionId: z.string(),
        versionNumber: z.number(),
      }).nullable(),
    }).nullable(),
    annotations: { readOnlyHint: false, idempotentHint: false },
  },
  async ({ projectId }) => {
    // Call GET /api/dispatch/next?projectId=...
    // Return structuredContent + text fallback
    // Handle 204 (empty queue) → return null with message
  }
)
```

**REST API mapping:** `GET /api/dispatch/next?projectId={projectId}`
**Empty queue:** Returns text "No tasks available. The dispatch queue is empty." with `structuredContent: null`.

#### 6.6.2 loop_complete_task

Reports task completion. Sets status to `done`, adds an outcome comment, and returns newly-unblocked downstream issues.

```typescript
// inputSchema
z.object({
  issueId: z.string().describe('ID of the issue to complete'),
  outcome: z.string().describe('Summary of what was accomplished'),
})

// outputSchema
z.object({
  issue: z.object({ id: z.string(), number: z.number(), title: z.string(), status: z.string() }),
  comment: z.object({ id: z.string() }),
  unblockedIssues: z.array(z.object({ id: z.string(), number: z.number(), title: z.string() })),
})
```

**Implementation steps:**
1. `PATCH /api/issues/{issueId}` with `{ status: 'done' }`
2. `POST /api/issues/{issueId}/comments` with `{ body: outcome, authorName: 'agent', authorType: 'agent' }`
3. `GET /api/issues?status=todo` then filter for issues that were blocked by this one (check relations)

**Error case:** If issueId not found → `isError: true` with message "Issue '{issueId}' not found. Use loop_list_issues to find valid IDs."

#### 6.6.3 loop_create_issue

Creates a new issue with flat arguments.

```typescript
// inputSchema
z.object({
  title: z.string().min(1).max(500).describe('Issue title'),
  type: z.enum(['signal', 'hypothesis', 'plan', 'task', 'monitor']).default('task'),
  priority: z.number().int().min(0).max(4).default(0).describe('0=none, 1=urgent, 2=high, 3=medium, 4=low'),
  projectId: z.string().optional().describe('Project to assign the issue to'),
  description: z.string().optional(),
  parentId: z.string().optional().describe('Parent issue ID for hierarchy'),
})

// outputSchema
z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
  priority: z.number(),
})
```

**REST API mapping:** `POST /api/issues`

#### 6.6.4 loop_update_issue

Partial update of an existing issue.

```typescript
// inputSchema
z.object({
  issueId: z.string().describe('ID of the issue to update'),
  status: z.enum(['triage', 'backlog', 'todo', 'in_progress', 'done', 'canceled']).optional(),
  priority: z.number().int().min(0).max(4).optional(),
  type: z.enum(['signal', 'hypothesis', 'plan', 'task', 'monitor']).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
})

// outputSchema
z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  type: z.string(),
  status: z.string(),
  priority: z.number(),
})
```

**REST API mapping:** `PATCH /api/issues/{issueId}`

#### 6.6.5 loop_list_issues

Filtered listing with pagination.

```typescript
// inputSchema
z.object({
  status: z.enum(['triage', 'backlog', 'todo', 'in_progress', 'done', 'canceled']).optional(),
  type: z.enum(['signal', 'hypothesis', 'plan', 'task', 'monitor']).optional(),
  projectId: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
})

// outputSchema
z.object({
  issues: z.array(z.object({
    id: z.string(),
    number: z.number(),
    title: z.string(),
    type: z.string(),
    status: z.string(),
    priority: z.number(),
  })),
  total: z.number(),
  hasMore: z.boolean(),
})
```

**REST API mapping:** `GET /api/issues?status={status}&type={type}&projectId={projectId}&limit={limit}&offset={offset}`
**Token efficiency:** Returns only essential fields (id, number, title, type, status, priority). Use `loop_get_issue` for full detail.

#### 6.6.6 loop_get_issue

Full issue detail with parent chain, labels, relations, and comments.

```typescript
// inputSchema
z.object({
  issueId: z.string().describe('ID of the issue to retrieve'),
})

// outputSchema
z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  priority: z.number(),
  parent: z.object({ id: z.string(), number: z.number(), title: z.string() }).nullable(),
  labels: z.array(z.object({ id: z.string(), name: z.string() })),
  comments: z.array(z.object({ id: z.string(), body: z.string(), authorName: z.string() })),
  relations: z.array(z.object({ id: z.string(), type: z.string(), relatedIssue: z.object({ id: z.string(), number: z.number(), title: z.string() }) })),
  projectId: z.string().nullable(),
  createdAt: z.string(),
})
```

**REST API mapping:** `GET /api/issues/{issueId}`

#### 6.6.7 loop_ingest_signal

Pushes a signal into the triage queue. Creates a signal + linked triage issue atomically.

```typescript
// inputSchema
z.object({
  source: z.string().describe('Signal source (e.g., "agent", "posthog", "sentry")'),
  type: z.string().describe('Signal type (e.g., "error", "metric_change", "user_feedback")'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  payload: z.record(z.unknown()).describe('Signal data as key-value pairs'),
  projectId: z.string().optional(),
})

// outputSchema
z.object({
  signal: z.object({ id: z.string(), source: z.string() }),
  issue: z.object({ id: z.string(), number: z.number(), title: z.string(), status: z.string() }),
})
```

**REST API mapping:** `POST /api/signals`

#### 6.6.8 loop_create_comment

Agent progress report on an issue.

```typescript
// inputSchema
z.object({
  issueId: z.string().describe('ID of the issue to comment on'),
  body: z.string().min(1).describe('Comment text'),
})

// outputSchema
z.object({
  id: z.string(),
  body: z.string(),
  authorName: z.string(),
  createdAt: z.string(),
})
```

**REST API mapping:** `POST /api/issues/{issueId}/comments` with `authorName: 'agent'` and `authorType: 'agent'`.

#### 6.6.9 loop_get_dashboard

System health overview.

```typescript
// inputSchema
z.object({}) // No inputs

// outputSchema
z.object({
  issues: z.object({
    total: z.number(),
    byStatus: z.record(z.number()),
    byType: z.record(z.number()),
  }),
  goals: z.object({
    total: z.number(),
    active: z.number(),
    achieved: z.number(),
  }),
  dispatch: z.object({
    queueDepth: z.number(),
    activeCount: z.number(),
    completedLast24h: z.number(),
  }),
})
```

**REST API mapping:** `GET /api/dashboard/stats`

### 6.7 Error Handling Pattern

All tool handlers follow this error pattern — never throw from handlers:

```typescript
async function handleToolCall(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof HTTPError) {
      const status = error.response.status
      const body = await error.response.json().catch(() => null)
      const message = body?.message ?? error.message

      if (status === 404) {
        return {
          content: [{ type: 'text', text: `Not found: ${message}. Use loop_list_issues to find valid IDs.` }],
          isError: true,
        }
      }
      if (status === 401) {
        return {
          content: [{ type: 'text', text: 'Authentication failed. Check your LOOP_API_KEY.' }],
          isError: true,
        }
      }
      return {
        content: [{ type: 'text', text: `API error (${status}): ${message}` }],
        isError: true,
      }
    }

    return {
      content: [{ type: 'text', text: `Unexpected error: ${String(error)}` }],
      isError: true,
    }
  }
}
```

Each error response includes actionable next steps so agents can self-recover.

### 6.8 Response Format

Every tool returns both `structuredContent` (for typed parsing) and `content` text (for backward compatibility):

```typescript
return {
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
  structuredContent: result,
}
```

### 6.9 Package Configuration

**`packages/mcp/package.json`:**

```json
{
  "name": "@dork-labs/loop-mcp",
  "version": "0.1.0",
  "description": "MCP server for Loop — the autonomous improvement engine",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "loop-mcp": "./dist/stdio.js"
  },
  "files": ["dist"],
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./http": {
      "import": "./dist/http.js",
      "types": "./dist/http.d.ts"
    }
  },
  "scripts": {
    "dev": "tsup --watch",
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.26.0",
    "ky": "^1.14",
    "zod": "^4.3"
  },
  "peerDependencies": {
    "hono": "^4"
  },
  "peerDependenciesMeta": {
    "hono": { "optional": true }
  },
  "devDependencies": {
    "@hono/mcp": "latest",
    "hono": "^4",
    "tsup": "latest",
    "tsx": "latest",
    "typescript": "^5",
    "vitest": "^3.2"
  },
  "mcpName": "io.github.dork-labs/loop"
}
```

Note: `hono` is a peer dependency (optional) since it's only needed for the HTTP transport. The `@hono/mcp` middleware is a dev dependency used for the HTTP handler build — it gets bundled into the output.

**`packages/mcp/tsup.config.ts`:**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/stdio.ts', 'src/http.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  splitting: false,
  banner: {
    js: (ctx) => ctx.options.entry?.includes('src/stdio.ts')
      ? '#!/usr/bin/env node'
      : '',
  },
})
```

### 6.10 .mcp.json Template

For team-wide sharing via version control:

```json
{
  "mcpServers": {
    "loop": {
      "command": "npx",
      "args": ["-y", "@dork-labs/loop-mcp"],
      "env": {
        "LOOP_API_KEY": "<your-api-key>",
        "LOOP_API_URL": "http://localhost:5667"
      }
    }
  }
}
```

### 6.11 Files to Modify in Existing Codebase

1. **`apps/api/src/app.ts`** — Add MCP HTTP transport mount at `/mcp`:
   ```typescript
   import { createMcpHandler } from '../../packages/mcp/src/http.js'
   const mcpHandler = createMcpHandler({ apiKey: env.LOOP_API_KEY, apiUrl: env.LOOP_URL })
   app.route('/mcp', mcpHandler)
   ```

2. **`turbo.json`** — No changes needed. The `packages/mcp/` package inherits existing `build`, `dev`, `test`, `typecheck`, `lint` tasks from the root pipeline.

3. **Root `package.json`** — No changes needed. `packages/*` workspace pattern is already configured.

## 7. User Experience

### Setup Flow (stdio)

1. Install: `npx @dork-labs/loop-mcp` (or add to Claude Code: `claude mcp add loop -- npx -y @dork-labs/loop-mcp`)
2. Set `LOOP_API_KEY` env var
3. Agent sees 9 Loop tools immediately

### Setup Flow (HTTP)

1. API server automatically exposes MCP at `/mcp` when running
2. Configure agent to connect to `http://localhost:5667/mcp` (or production URL)
3. Bearer token auth via standard MCP protocol headers

### Agent Workflow

```
Agent connects → calls loop_get_next_task
  → receives issue #42 with hydrated prompt
  → does work (writes code, runs tests, etc.)
  → calls loop_create_comment with progress updates
  → calls loop_complete_task with outcome summary
  → calls loop_get_next_task again (repeat)
```

## 8. Testing Strategy

### Unit Tests (`packages/mcp/__tests__/tools.test.ts`)

Test each tool handler in isolation by mocking the ky HTTP client:

```typescript
// Purpose: Verify loop_get_next_task correctly transforms dispatch API response
// into MCP-formatted structuredContent with text fallback
test('loop_get_next_task returns structured dispatch result', async () => {
  // Mock ky.get('/api/dispatch/next').json() → dispatch response
  // Call tool handler
  // Assert structuredContent matches outputSchema
  // Assert text content is valid JSON
})

// Purpose: Verify loop_get_next_task handles empty queue gracefully
test('loop_get_next_task returns null when queue is empty', async () => {
  // Mock ky.get → 204 response
  // Assert structuredContent is null
  // Assert text says "No tasks available"
})

// Purpose: Verify loop_complete_task performs all three operations
test('loop_complete_task updates status, adds comment, and returns unblocked issues', async () => {
  // Mock PATCH /api/issues/:id → success
  // Mock POST /api/issues/:id/comments → success
  // Mock GET /api/issues?status=todo → list with previously-blocked issues
  // Assert all three API calls were made
  // Assert response includes unblockedIssues
})

// Purpose: Verify error responses include actionable suggestions
test('tools return actionable errors for 404 responses', async () => {
  // Mock ky.get → 404
  // Assert isError: true
  // Assert text includes "Use loop_list_issues"
})

// Purpose: Verify auth errors produce clear messages
test('tools return clear message for 401 responses', async () => {
  // Mock ky → 401
  // Assert isError: true
  // Assert text includes "LOOP_API_KEY"
})
```

Test every tool for:
- Happy path with valid response transformation
- Error handling (404, 401, 500, network errors)
- Input validation (invalid types, missing required fields)
- Output format (both `structuredContent` and `content` text present)

### Integration Tests (`packages/mcp/__tests__/server.test.ts`)

```typescript
// Purpose: Verify createLoopMcpServer registers all 9 tools
test('server registers all 9 tools', async () => {
  const server = createLoopMcpServer({ apiKey: 'test-key' })
  // Connect to in-memory transport
  // Call tools/list
  // Assert 9 tools with correct names and annotations
})

// Purpose: Verify stdio entry point starts without error
test('stdio transport connects successfully', async () => {
  // Spawn process with LOOP_API_KEY set
  // Verify it doesn't exit with error
})

// Purpose: Verify stdio exits with clear error when LOOP_API_KEY missing
test('stdio exits with error when LOOP_API_KEY missing', async () => {
  // Spawn process without env var
  // Assert exit code 1
  // Assert stderr includes generation command
})
```

### Mocking Strategy

- **ky HTTP client:** Create a mock factory that returns predetermined responses per URL pattern. Use `vi.mock('ky')` or dependency injection via the `createApiClient` function.
- **MCP transport:** Use `InMemoryTransport` from the MCP SDK for testing server behavior without stdio/HTTP.

## 9. Performance Considerations

- **stdio transport** adds <1ms latency (no network hop)
- **HTTP transport** adds one network hop: agent → MCP HTTP → REST API → DB
- Tool responses are token-efficient — `loop_list_issues` returns only essential fields (id, number, title, type, status, priority)
- Default pagination limit is 20 items to control response size
- The ky client retries on 429/500/503 with built-in exponential backoff
- No connection pooling needed — ky manages this internally

## 10. Security Considerations

- Bearer token validated per-request at the REST API layer (not at the MCP layer)
- `timingSafeEqual` comparison in auth middleware prevents timing attacks
- CORS on HTTP transport restricted to known origins (configured in `apps/api/src/app.ts`)
- Tool annotations mark read-only tools (`readOnlyHint: true`) so agents can distinguish safe operations
- Tool inputs validated via Zod schemas — no raw user input reaches the API
- The MCP server never stores or logs the API key beyond the initial config
- Signal payloads are passed through as-is — no server-side execution of payload content

## 11. Documentation

Documentation updates needed (deferred to Feature 7: Documentation Update):

- MCP Server installation guide (Claude Code, Cursor, Windsurf)
- Tool reference with descriptions, input/output schemas, and examples
- `.mcp.json` team config guide
- Troubleshooting (connection issues, auth errors, empty queue)

For now, the npm package README serves as the primary documentation.

## 12. Implementation Phases

### Phase 1: Core Package + Dispatch Cycle

Set up `packages/mcp/` with package config, build tooling, and the two most important tools:

- `packages/mcp/package.json`, `tsconfig.json`, `tsup.config.ts`
- `src/index.ts` — `createLoopMcpServer` factory
- `src/client.ts` — ky HTTP client
- `src/types.ts` — shared types
- `src/stdio.ts` — stdio entry point
- `src/tools/get-next-task.ts` — `loop_get_next_task`
- `src/tools/complete-task.ts` — `loop_complete_task`
- `src/tools/index.ts` — tool registration
- Unit tests for both tools

**Milestone:** `npx` runs the server, agent can get a task and report completion.

### Phase 2: Issue CRUD Tools

Add the core issue management tools:

- `src/tools/create-issue.ts` — `loop_create_issue`
- `src/tools/update-issue.ts` — `loop_update_issue`
- `src/tools/list-issues.ts` — `loop_list_issues`
- `src/tools/get-issue.ts` — `loop_get_issue`
- Unit tests for all 4 tools

**Milestone:** Agent can manage issues end-to-end.

### Phase 3: Advanced Tools + HTTP Transport

Add remaining tools and HTTP transport:

- `src/tools/ingest-signal.ts` — `loop_ingest_signal`
- `src/tools/create-comment.ts` — `loop_create_comment`
- `src/tools/get-dashboard.ts` — `loop_get_dashboard`
- `src/http.ts` — Hono HTTP handler
- Mount HTTP transport in `apps/api/src/app.ts`
- Integration tests
- `.mcp.json` template

**Milestone:** All 9 tools working, both transports functional, ready for npm publish.

## 13. Open Questions

*All clarifications from ideation have been resolved. No remaining open questions.*

## 14. Related ADRs

| # | Title | Relevance |
|---|-------|-----------|
| 1 | Use Hono over Express | MCP HTTP transport mounts on the same Hono server |
| 9 | Use FOR UPDATE SKIP LOCKED for dispatch | `loop_get_next_task` wraps this atomic claim mechanism |
| 8 | Use Handlebars for prompt hydration | Dispatch response includes Handlebars-rendered prompts |
| 20 | Use raw Zod safeParse for env validation | MCP stdio entry validates `LOOP_API_KEY` at startup |

## 15. References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — `@modelcontextprotocol/sdk` v1.26.0
- [@hono/mcp middleware](https://github.com/honojs/middleware/tree/main/packages/mcp) — Streamable HTTP transport for Hono
- [MCP Specification](https://spec.modelcontextprotocol.io/) — Protocol spec including `outputSchema`, tool annotations
- `research/20260222_mcp_servers_developer_tools.md` — GitHub, Linear, Sentry MCP patterns
- `research/20260222_mcp_server_implementation.md` — SDK API, transport comparison, tool design
- `specs/mcp-server/01-ideation.md` — Full ideation with codebase map
- `specs/agent-integration-strategy.md` — Feature 2 scope and dependencies
