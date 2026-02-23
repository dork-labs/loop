import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerListIssues } from '../src/tools/list-issues.js';

interface ToolRegistration {
  name: string;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

let toolRegistration: ToolRegistration;

function createMockServer(): McpServer {
  return {
    tool: vi.fn((...args: unknown[]) => {
      const handler = args[args.length - 1] as ToolRegistration['handler'];
      toolRegistration = { name: args[0] as string, handler };
    }),
  } as unknown as McpServer;
}

function createMockClient(response: unknown) {
  return {
    get: vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue(response),
    }),
  };
}

describe('loop_list_issues', () => {
  beforeEach(() => {
    toolRegistration = undefined as unknown as ToolRegistration;
  });

  it('returns issues with essential fields on happy path', async () => {
    const apiResponse = {
      data: [
        {
          id: 'iss_1',
          number: 1,
          title: 'Fix login bug',
          type: 'task',
          status: 'todo',
          priority: 2,
          description: 'Full description here',
          createdAt: '2026-01-01T00:00:00Z',
          extra: 'should be stripped',
        },
        {
          id: 'iss_2',
          number: 2,
          title: 'Investigate metric drop',
          type: 'hypothesis',
          status: 'in_progress',
          priority: 1,
        },
      ],
      total: 42,
    };

    const server = createMockServer();
    const client = createMockClient(apiResponse);

    registerListIssues(server, client as never);

    expect(server.tool).toHaveBeenCalledOnce();
    expect(toolRegistration.name).toBe('loop_list_issues');

    const result = (await toolRegistration.handler({
      limit: 20,
      offset: 0,
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.total).toBe(42);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.issues).toHaveLength(2);

    expect(parsed.issues[0]).toEqual({
      id: 'iss_1',
      number: 1,
      title: 'Fix login bug',
      type: 'task',
      status: 'todo',
      priority: 2,
    });

    // Verify extra fields are stripped
    expect(parsed.issues[0].description).toBeUndefined();
    expect(parsed.issues[0].extra).toBeUndefined();
    expect(parsed.issues[0].createdAt).toBeUndefined();
  });

  it('returns empty results correctly', async () => {
    const apiResponse = {
      data: [],
      total: 0,
    };

    const server = createMockServer();
    const client = createMockClient(apiResponse);

    registerListIssues(server, client as never);

    const result = (await toolRegistration.handler({
      limit: 20,
      offset: 0,
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean };

    expect(result.isError).toBeUndefined();

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.issues).toEqual([]);
    expect(parsed.total).toBe(0);
    expect(parsed.hasMore).toBe(false);
  });
});
