import { describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HTTPError } from 'ky';
import type { NormalizedOptions } from 'ky/distribution/types/options.js';

import { registerGetNextTask } from '../src/tools/get-next-task.js';
import type { ApiClient } from '../src/types.js';

/** Create a mock ApiClient whose `.get()` resolves with a Response-like object. */
function createMockClient(jsonValue: unknown, status = 200): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({
      status,
      json: () => Promise.resolve(jsonValue),
    }),
  } as unknown as ApiClient;
}

/** Create a mock ApiClient that returns HTTP 204 (empty queue). */
function createEmptyQueueClient(): ApiClient {
  return {
    get: vi.fn().mockResolvedValue({
      status: 204,
      json: () => Promise.reject(new Error('No body on 204')),
    }),
  } as unknown as ApiClient;
}

/** Create a mock ApiClient whose `.get()` rejects with a ky HTTPError. */
function createErrorClient(status: number, body?: Record<string, unknown>): ApiClient {
  const responseInit: ResponseInit = {
    status,
    headers: { 'Content-Type': 'application/json' },
  };
  const responseBody = body ? JSON.stringify(body) : undefined;
  const response = new Response(responseBody, responseInit);
  const request = new Request('http://localhost:5667/api/dispatch/next');
  const error = new HTTPError(response, request, {} as NormalizedOptions);

  return {
    get: vi.fn().mockRejectedValue(error),
  } as unknown as ApiClient;
}

/**
 * Extract the registered tool callback from an McpServer.
 *
 * Spies on `server.tool()` to capture the callback argument, then invokes
 * `registerGetNextTask` to trigger registration.
 */
function getRegisteredCallback(client: ApiClient) {
  const server = new McpServer({ name: 'test', version: '0.0.1' });
  const toolSpy = vi.spyOn(server, 'tool');

  registerGetNextTask(server, client);

  expect(toolSpy).toHaveBeenCalledOnce();

  // The 6-arg overload: name, description, paramsSchema, annotations, callback
  const args = toolSpy.mock.calls[0];
  const callback = args[args.length - 1] as (
    params: { projectId?: string },
    extra: unknown
  ) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
    structuredContent?: unknown;
  }>;

  return { server, callback, toolSpy };
}

describe('registerGetNextTask', () => {
  it('registers the tool with correct name, description, and annotations', () => {
    const client = createMockClient({});
    const { toolSpy } = getRegisteredCallback(client);

    const [name, description] = toolSpy.mock.calls[0] as unknown[];
    expect(name).toBe('loop_get_next_task');
    expect(description).toContain('highest-priority');
  });

  it('returns structured issue data on happy path', async () => {
    const dispatchResult = {
      issue: {
        id: 'iss_abc123',
        number: 42,
        title: 'Fix OAuth redirect blank screen',
        type: 'task',
        priority: 'high',
        status: 'in_progress',
        extraField: 'should be stripped',
      },
      prompt: 'You are fixing an OAuth redirect issue...',
      meta: { templateId: 'tpl_1' },
    };

    const client = createMockClient(dispatchResult);
    const { callback } = getRegisteredCallback(client);

    const result = await callback({}, {});

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.issue).toEqual({
      id: 'iss_abc123',
      number: 42,
      title: 'Fix OAuth redirect blank screen',
      type: 'task',
      priority: 'high',
      status: 'in_progress',
    });
    expect(parsed.prompt).toBe('You are fixing an OAuth redirect issue...');
    expect(parsed.meta).toEqual({ templateId: 'tpl_1' });

    // Extra fields from the API should not appear
    expect(parsed.issue.extraField).toBeUndefined();
  });

  it('passes projectId as search param when provided', async () => {
    const client = createEmptyQueueClient();
    const { callback } = getRegisteredCallback(client);

    await callback({ projectId: 'proj_xyz' }, {});

    expect(client.get).toHaveBeenCalledWith('api/dispatch/next', {
      searchParams: { projectId: 'proj_xyz' },
    });
  });

  it('sends empty searchParams when no projectId is given', async () => {
    const client = createEmptyQueueClient();
    const { callback } = getRegisteredCallback(client);

    await callback({}, {});

    expect(client.get).toHaveBeenCalledWith('api/dispatch/next', {
      searchParams: {},
    });
  });

  it('returns empty queue message on 204 response', async () => {
    const client = createEmptyQueueClient();
    const { callback } = getRegisteredCallback(client);

    const result = await callback({}, {});

    expect(result.content[0].text).toBe('No tasks available. The dispatch queue is empty.');
    expect(result.isError).toBeUndefined();
  });

  it('returns empty queue message when result has no issue', async () => {
    const client = createMockClient({ issue: null });
    const { callback } = getRegisteredCallback(client);

    const result = await callback({}, {});

    expect(result.content[0].text).toBe('No tasks available. The dispatch queue is empty.');
  });

  it('handles 404 error with actionable message', async () => {
    const client = createErrorClient(404, { message: 'Dispatch not found' });
    const { callback } = getRegisteredCallback(client);

    const result = await callback({}, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Not found');
    expect(result.content[0].text).toContain('Dispatch not found');
  });

  it('handles 401 error with auth message', async () => {
    const client = createErrorClient(401, { message: 'Unauthorized' });
    const { callback } = getRegisteredCallback(client);

    const result = await callback({}, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Authentication failed');
  });

  it('handles 500 error with generic API error message', async () => {
    const client = createErrorClient(500, { message: 'Internal server error' });
    const { callback } = getRegisteredCallback(client);

    const result = await callback({}, {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('API error (500)');
  });

  it('sets prompt and meta to null when absent from response', async () => {
    const dispatchResult = {
      issue: {
        id: 'iss_1',
        number: 1,
        title: 'Test',
        type: 'bug',
        priority: 'low',
        status: 'open',
      },
    };

    const client = createMockClient(dispatchResult);
    const { callback } = getRegisteredCallback(client);

    const result = await callback({}, {});
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.prompt).toBeNull();
    expect(parsed.meta).toBeNull();
  });
});
