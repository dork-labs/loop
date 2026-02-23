---
slug: mcp-server
spec: specs/mcp-server/02-specification.md
lastDecompose: 2026-02-22
mode: full
---

# MCP Server — Task Breakdown

## Phase 1: Foundation — Core Package + Dispatch Cycle

### Task 1.1: Initialize `packages/mcp/` with package config and build tooling

Set up the package directory, `package.json`, `tsconfig.json`, `tsup.config.ts`, and `src/types.ts`.

**Files to create:**

- `packages/mcp/package.json`
- `packages/mcp/tsconfig.json`
- `packages/mcp/tsup.config.ts`
- `packages/mcp/src/types.ts`

**Acceptance criteria:**

- `npm install` from repo root resolves the new workspace
- `npm run build` in `packages/mcp/` produces `dist/` output
- `npm run typecheck` passes

### Task 1.2: Implement internal API client (`src/client.ts`)

Create the ky-based HTTP client that all tool handlers use to call the Loop REST API.

**File:** `packages/mcp/src/client.ts`

**Acceptance criteria:**

- Exports `createApiClient(config): KyInstance`
- Sets `Authorization: Bearer <apiKey>` header
- Sets `prefixUrl` to `config.apiUrl`
- Configures retry on 429, 500, 503 with limit of 2
- Unit test verifying client creation

### Task 1.3: Implement server factory and stdio entry point

Create `src/index.ts` with `createLoopMcpServer` factory and `src/stdio.ts` CLI entry point.

**Files:**

- `packages/mcp/src/index.ts`
- `packages/mcp/src/stdio.ts`
- `packages/mcp/src/tools/index.ts` (empty registration scaffold)

**Acceptance criteria:**

- `createLoopMcpServer({ apiKey, apiUrl })` returns an `McpServer` instance
- stdio entry reads `LOOP_API_KEY` from env, exits 1 with helpful message if missing
- `bin` entry in package.json points to `dist/stdio.js`
- Integration test: server registers tools, stdio exits on missing key

### Task 1.4: Implement `loop_get_next_task` tool

The signature dispatch tool. Returns highest-priority unblocked issue with hydrated prompt.

**File:** `packages/mcp/src/tools/get-next-task.ts`

**REST API mapping:** `GET /api/dispatch/next?projectId={projectId}`

**Acceptance criteria:**

- Registered with correct annotations (`readOnlyHint: false, idempotentHint: false`)
- Input: optional `projectId` string
- Output: `{ issue, prompt, meta }` or null
- Returns text "No tasks available. The dispatch queue is empty." when queue empty
- Returns both `structuredContent` and `content` text
- Error handling: 401 -> auth message, 404 -> helpful message, 500 -> generic
- Unit tests for happy path, empty queue, and error cases

### Task 1.5: Implement `loop_complete_task` tool

Reports task completion with outcome comment and returns unblocked issues.

**File:** `packages/mcp/src/tools/complete-task.ts`

**Implementation steps:**
1. `PATCH /api/issues/{issueId}` with `{ status: 'done' }`
2. `POST /api/issues/{issueId}/comments` with `{ body: outcome, authorName: 'agent', authorType: 'agent' }`
3. `GET /api/issues?status=todo` then filter for issues blocked by this one

**Acceptance criteria:**

- Input: `issueId` (required), `outcome` (required)
- Output: `{ issue, comment, unblockedIssues }`
- All three API calls are made in sequence
- Error: issueId not found -> `isError: true` with "Use loop_list_issues" suggestion
- Annotations: `readOnlyHint: false, idempotentHint: true`
- Unit tests for happy path, not-found error, and auth error

### Task 1.6: Implement shared error handling utility

Create the `handleToolCall` wrapper used by all tool handlers.

**File:** `packages/mcp/src/tools/error-handler.ts`

**Acceptance criteria:**

- Wraps async tool handler functions
- Catches ky `HTTPError` and returns structured error responses
- 404 -> "Not found" with "Use loop_list_issues" suggestion
- 401 -> "Authentication failed. Check your LOOP_API_KEY."
- Other HTTP errors -> "API error ({status}): {message}"
- Unexpected errors -> "Unexpected error: {message}"
- All error responses have `isError: true`
- Unit tests for each error type

## Phase 2: Issue CRUD Tools

### Task 2.1: Implement `loop_create_issue` tool

Creates a new issue with flat arguments.

**File:** `packages/mcp/src/tools/create-issue.ts`

**REST API mapping:** `POST /api/issues`

**Acceptance criteria:**

- Input: `title` (required), `type` (default 'task'), `priority` (default 0), optional `projectId`, `description`, `parentId`
- Output: `{ id, number, title, type, status, priority }`
- Annotations: `readOnlyHint: false, idempotentHint: false`
- Unit tests for happy path and validation errors

### Task 2.2: Implement `loop_update_issue` tool

Partial update of an existing issue.

**File:** `packages/mcp/src/tools/update-issue.ts`

**REST API mapping:** `PATCH /api/issues/{issueId}`

**Acceptance criteria:**

- Input: `issueId` (required), optional `status`, `priority`, `type`, `title`, `description`
- Output: `{ id, number, title, type, status, priority }`
- Annotations: `readOnlyHint: false, idempotentHint: true`
- Unit tests for happy path and not-found error

### Task 2.3: Implement `loop_list_issues` tool

Filtered listing with pagination.

**File:** `packages/mcp/src/tools/list-issues.ts`

**REST API mapping:** `GET /api/issues?status={status}&type={type}&projectId={projectId}&limit={limit}&offset={offset}`

**Acceptance criteria:**

- Input: optional `status`, `type`, `projectId`, `limit` (default 20), `offset` (default 0)
- Output: `{ issues[], total, hasMore }`
- Issues contain only essential fields: id, number, title, type, status, priority
- Annotations: `readOnlyHint: true, idempotentHint: true`
- Unit tests for happy path and empty results

### Task 2.4: Implement `loop_get_issue` tool

Full issue detail with parent chain, labels, relations, and comments.

**File:** `packages/mcp/src/tools/get-issue.ts`

**REST API mapping:** `GET /api/issues/{issueId}`

**Acceptance criteria:**

- Input: `issueId` (required)
- Output: full issue with `parent`, `labels`, `comments`, `relations`, `projectId`, `createdAt`
- Annotations: `readOnlyHint: true, idempotentHint: true`
- Unit tests for happy path and not-found error

## Phase 3: Advanced Tools + HTTP Transport

### Task 3.1: Implement `loop_ingest_signal` tool

Pushes a signal into the triage queue.

**File:** `packages/mcp/src/tools/ingest-signal.ts`

**REST API mapping:** `POST /api/signals`

**Acceptance criteria:**

- Input: `source` (required), `type` (required), `severity` (default 'medium'), `payload` (required), optional `projectId`
- Output: `{ signal: { id, source }, issue: { id, number, title, status } }`
- Annotations: `readOnlyHint: false, idempotentHint: false`
- Unit tests for happy path

### Task 3.2: Implement `loop_create_comment` tool

Agent progress report on an issue.

**File:** `packages/mcp/src/tools/create-comment.ts`

**REST API mapping:** `POST /api/issues/{issueId}/comments` with `authorName: 'agent'` and `authorType: 'agent'`

**Acceptance criteria:**

- Input: `issueId` (required), `body` (required, min 1 char)
- Output: `{ id, body, authorName, createdAt }`
- Annotations: `readOnlyHint: false, idempotentHint: false`
- Unit tests for happy path and not-found error

### Task 3.3: Implement `loop_get_dashboard` tool

System health overview.

**File:** `packages/mcp/src/tools/get-dashboard.ts`

**REST API mapping:** `GET /api/dashboard/stats`

**Acceptance criteria:**

- Input: empty object (no inputs)
- Output: `{ issues: { total, byStatus, byType }, goals: { total, active, achieved }, dispatch: { queueDepth, activeCount, completedLast24h } }`
- Annotations: `readOnlyHint: true, idempotentHint: true`
- Unit tests for happy path

### Task 3.4: Implement HTTP transport handler (`src/http.ts`)

Create the Hono-based HTTP transport handler and mount it on the API server.

**Files:**

- `packages/mcp/src/http.ts`
- Modify `apps/api/src/app.ts` to mount at `/mcp`

**Acceptance criteria:**

- `createMcpHandler(config)` returns a Hono app
- Mounts at `/mcp` in the API server WITHOUT `apiKeyAuth` middleware
- Auth passes through to REST API via internal ky client Bearer token
- Integration test: HTTP transport accepts MCP protocol requests

### Task 3.5: Integration tests and `.mcp.json` template

End-to-end server tests and team config template.

**Files:**

- `packages/mcp/__tests__/server.test.ts`
- `.mcp.json` template in repo root (or `packages/mcp/.mcp.json.example`)

**Acceptance criteria:**

- Test: `createLoopMcpServer` registers all 9 tools with correct names
- Test: tool annotations are correct for each tool
- Test: stdio entry exits with error when `LOOP_API_KEY` missing
- `.mcp.json` template has correct npx command and env vars
- All 9 tools appear in `tools/list` response
