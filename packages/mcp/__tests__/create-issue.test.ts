import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerCreateIssue } from '../src/tools/create-issue.js';

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
      // The callback is the last argument
      const handler = args[args.length - 1] as ToolRegistration['handler'];
      toolRegistration = { name: args[0] as string, handler };
    }),
  } as unknown as McpServer;
}

/** Create a mock ky client that returns the given response on post(). */
function createMockClient(response: Record<string, unknown>) {
  return {
    post: vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue(response),
    }),
  };
}

describe('registerCreateIssue', () => {
  const issueResponse = {
    id: 'iss_abc123',
    number: 42,
    title: 'Fix OAuth redirect',
    type: 'task',
    status: 'open',
    priority: 2,
    description: 'Some description',
    createdAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(() => {
    toolRegistration = undefined as unknown as ToolRegistration;
  });

  it('registers tool with correct name', () => {
    const server = createMockServer();
    const client = createMockClient({ data: issueResponse });

    registerCreateIssue(server, client as never);

    expect(server.tool).toHaveBeenCalledOnce();
    expect(toolRegistration.name).toBe('loop_create_issue');
  });

  it('creates an issue and returns the expected output shape', async () => {
    const server = createMockServer();
    const client = createMockClient({ data: issueResponse });

    registerCreateIssue(server, client as never);

    const result = (await toolRegistration.handler({
      title: 'Fix OAuth redirect',
      type: 'task',
      priority: 2,
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({
      id: 'iss_abc123',
      number: 42,
      title: 'Fix OAuth redirect',
      type: 'task',
      status: 'open',
      priority: 2,
    });

    // Verify POST was called with the right payload
    expect(client.post).toHaveBeenCalledWith('api/issues', {
      json: { title: 'Fix OAuth redirect', type: 'task', priority: 2 },
    });
  });

  it('excludes extra fields from the API response', async () => {
    const server = createMockServer();
    const client = createMockClient({ data: issueResponse });

    registerCreateIssue(server, client as never);

    const result = (await toolRegistration.handler({
      title: 'Fix OAuth redirect',
    })) as { content: Array<{ type: string; text: string }> };

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).not.toHaveProperty('description');
    expect(parsed).not.toHaveProperty('createdAt');
  });

  it('returns an error when the API call fails', async () => {
    const server = createMockServer();
    const client = {
      post: vi.fn().mockReturnValue({
        json: vi.fn().mockRejectedValue(new Error('Network error')),
      }),
    };

    registerCreateIssue(server, client as never);

    const result = (await toolRegistration.handler({
      title: 'Test issue',
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unexpected error');
  });
});
