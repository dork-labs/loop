import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HTTPError } from 'ky';
import type { NormalizedOptions } from 'ky/distribution/types/options.js';

import type { ApiClient } from '../src/types.js';
import { registerCompleteTask } from '../src/tools/complete-task.js';

/** Create a ky HTTPError with the given status and optional JSON body. */
function createHTTPError(status: number, body?: Record<string, unknown>): HTTPError {
  const responseInit: ResponseInit = {
    status,
    headers: { 'Content-Type': 'application/json' },
  };
  const responseBody = body ? JSON.stringify(body) : undefined;
  const response = new Response(responseBody, responseInit);
  const request = new Request('http://localhost:5667/api/test');

  return new HTTPError(response, request, {} as NormalizedOptions);
}

/**
 * Create a mock ky client with chainable `.patch().json()`, `.post().json()`,
 * and `.get().json()` methods.
 */
function createMockClient(overrides?: {
  patchJson?: () => Promise<unknown>;
  postJson?: () => Promise<unknown>;
  getJson?: () => Promise<unknown>;
}): ApiClient {
  return {
    patch: vi.fn().mockReturnValue({
      json:
        overrides?.patchJson ??
        vi.fn().mockResolvedValue({ data: { id: 'issue-1', status: 'done' } }),
    }),
    post: vi.fn().mockReturnValue({
      json:
        overrides?.postJson ??
        vi.fn().mockResolvedValue({ data: { id: 'comment-1', body: 'Done' } }),
    }),
    get: vi.fn().mockReturnValue({
      json:
        overrides?.getJson ??
        vi.fn().mockResolvedValue({
          data: [
            {
              id: 'issue-2',
              status: 'todo',
              relations: [{ type: 'blocked_by', targetId: 'issue-1' }],
            },
            {
              id: 'issue-3',
              status: 'todo',
              relations: [{ type: 'blocked_by', targetId: 'other-issue' }],
            },
          ],
        }),
    }),
  } as unknown as ApiClient;
}

/**
 * Extract the tool handler registered on the server.
 *
 * We spy on `server.tool` to capture the callback, then invoke it directly
 * to test the handler logic without going through MCP transport.
 */
function extractHandler(server: McpServer) {
  const toolSpy = vi.spyOn(server, 'tool');
  registerCompleteTask(server, createMockClient());
  // The callback is the last argument regardless of overload
  const args = toolSpy.mock.calls[0];
  return args[args.length - 1] as (params: {
    issueId: string;
    outcome: string;
  }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
}

/** Register the tool with a custom mock client and invoke the handler. */
async function callWithClient(client: ApiClient, params: { issueId: string; outcome: string }) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  const toolSpy = vi.spyOn(server, 'tool');
  registerCompleteTask(server, client);
  const args = toolSpy.mock.calls[0];
  const handler = args[args.length - 1] as (params: {
    issueId: string;
    outcome: string;
  }) => Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }>;
  return handler(params);
}

describe('registerCompleteTask', () => {
  it('registers the tool with correct name and annotations', () => {
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    const toolSpy = vi.spyOn(server, 'tool');
    const client = createMockClient();

    registerCompleteTask(server, client);

    expect(toolSpy).toHaveBeenCalledOnce();
    expect(toolSpy.mock.calls[0][0]).toBe('loop_complete_task');
  });

  it('happy path: completes issue, posts comment, returns unblocked issues', async () => {
    const mockIssue = { id: 'issue-1', title: 'Fix bug', status: 'done' };
    const mockComment = { id: 'comment-1', body: 'Fixed the bug' };
    const mockTodoIssues = {
      data: [
        {
          id: 'issue-2',
          status: 'todo',
          relations: [{ type: 'blocked_by', targetId: 'issue-1' }],
        },
        {
          id: 'issue-3',
          status: 'todo',
          relations: [{ type: 'relates_to', targetId: 'issue-1' }],
        },
        {
          id: 'issue-4',
          status: 'todo',
          relations: [],
        },
      ],
    };

    const client = createMockClient({
      patchJson: vi.fn().mockResolvedValue({ data: mockIssue }),
      postJson: vi.fn().mockResolvedValue({ data: mockComment }),
      getJson: vi.fn().mockResolvedValue(mockTodoIssues),
    });

    const result = await callWithClient(client, {
      issueId: 'issue-1',
      outcome: 'Fixed the bug',
    });

    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.issue).toEqual(mockIssue);
    expect(parsed.comment).toEqual(mockComment);
    expect(parsed.unblockedIssues).toHaveLength(1);
    expect(parsed.unblockedIssues[0].id).toBe('issue-2');

    // Verify API calls
    expect(client.patch).toHaveBeenCalledWith('api/issues/issue-1', {
      json: { status: 'done' },
    });
    expect(client.post).toHaveBeenCalledWith('api/issues/issue-1/comments', {
      json: { body: 'Fixed the bug', authorName: 'agent', authorType: 'agent' },
    });
    expect(client.get).toHaveBeenCalledWith('api/issues', {
      searchParams: { status: 'todo' },
    });
  });

  it('returns not-found error when PATCH returns 404', async () => {
    const client = createMockClient({
      patchJson: vi.fn().mockRejectedValue(createHTTPError(404, { message: 'Issue not found' })),
    });

    const result = await callWithClient(client, {
      issueId: 'nonexistent',
      outcome: 'N/A',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Not found');
    expect(result.content[0].text).toContain('loop_list_issues');
  });

  it('returns auth error when API returns 401', async () => {
    const client = createMockClient({
      patchJson: vi.fn().mockRejectedValue(createHTTPError(401, { message: 'Unauthorized' })),
    });

    const result = await callWithClient(client, {
      issueId: 'issue-1',
      outcome: 'N/A',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Authentication failed');
    expect(result.content[0].text).toContain('LOOP_API_KEY');
  });
});
