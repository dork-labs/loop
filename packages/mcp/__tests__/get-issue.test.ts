import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HTTPError } from 'ky';
import type { NormalizedOptions } from 'ky/distribution/types/options.js';

import { registerGetIssue } from '../src/tools/get-issue.js';

/** Captured tool registration from server.tool() */
interface ToolRegistration {
  name: string;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

let toolRegistration: ToolRegistration;

/** Create a mock MCP server that captures tool registrations. */
function createMockServer(): McpServer {
  return {
    tool: vi.fn((...args: unknown[]) => {
      const handler = args[args.length - 1] as ToolRegistration['handler'];
      toolRegistration = { name: args[0] as string, handler };
    }),
  } as unknown as McpServer;
}

/** Create a ky HTTPError with the given status and optional JSON body. */
function createHTTPError(status: number, body?: Record<string, unknown>): HTTPError {
  const responseInit: ResponseInit = {
    status,
    headers: { 'Content-Type': 'application/json' },
  };
  const responseBody = body ? JSON.stringify(body) : undefined;
  const response = new Response(responseBody, responseInit);
  const request = new Request('http://localhost:5667/api/issues/test-id');

  return new HTTPError(response, request, {} as NormalizedOptions);
}

/** Create a mock ky client that returns the given response on get(). */
function createMockClient(response: Record<string, unknown>) {
  return {
    get: vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue(response),
    }),
  };
}

describe('loop_get_issue', () => {
  const fullIssue = {
    id: 'iss_abc123',
    number: 7,
    title: 'Fix OAuth redirect',
    type: 'task',
    status: 'in_progress',
    priority: 2,
    description: 'OAuth redirect shows blank page',
    projectId: 'proj_xyz',
    parentId: 'iss_parent1',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-16T12:00:00Z',
    labels: [{ id: 'lbl_1', name: 'bug', color: '#ff0000' }],
    comments: [
      {
        id: 'cmt_1',
        body: 'Investigating root cause',
        source: 'agent',
        createdAt: '2026-01-15T11:00:00Z',
      },
    ],
    relations: [{ id: 'rel_1', type: 'blocks', relatedIssueId: 'iss_other' }],
  };

  beforeEach(() => {
    toolRegistration = undefined as unknown as ToolRegistration;
  });

  it('returns full issue detail on happy path', async () => {
    const server = createMockServer();
    const client = createMockClient({ data: fullIssue });

    registerGetIssue(server, client as never);

    expect(server.tool).toHaveBeenCalledOnce();
    expect(toolRegistration.name).toBe('loop_get_issue');

    const result = (await toolRegistration.handler({
      issueId: 'iss_abc123',
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.id).toBe('iss_abc123');
    expect(parsed.title).toBe('Fix OAuth redirect');
    expect(parsed.labels).toHaveLength(1);
    expect(parsed.labels[0].name).toBe('bug');
    expect(parsed.comments).toHaveLength(1);
    expect(parsed.relations).toHaveLength(1);
    expect(parsed.projectId).toBe('proj_xyz');
    expect(parsed.createdAt).toBe('2026-01-15T10:00:00Z');

    expect(client.get).toHaveBeenCalledWith('api/issues/iss_abc123');
  });

  it('returns not found error for 404', async () => {
    const server = createMockServer();
    const client = {
      get: vi.fn().mockReturnValue({
        json: vi.fn().mockRejectedValue(createHTTPError(404, { message: 'Issue not found' })),
      }),
    };

    registerGetIssue(server, client as never);

    const result = (await toolRegistration.handler({
      issueId: 'nonexistent-id',
    })) as {
      content: Array<{ type: string; text: string }>;
      isError: boolean;
    };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Not found');
    expect(result.content[0].text).toContain('Issue not found');
  });
});
