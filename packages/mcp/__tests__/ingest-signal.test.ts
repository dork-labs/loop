import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import ky from 'ky';

import { registerIngestSignal } from '../src/tools/ingest-signal.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Captured tool registration from McpServer.tool() */
interface RegisteredTool {
  name: string;
  callback: (
    args: Record<string, unknown>
  ) => Promise<{ content: { type: string; text: string }[]; isError?: boolean }>;
}

let registeredTool: RegisteredTool;

function createMockServer(): McpServer {
  const server = {
    tool: vi.fn((...args: unknown[]) => {
      // Signature: (name, description, paramsSchema, annotations, cb)
      const name = args[0] as string;
      const callback = args[args.length - 1] as RegisteredTool['callback'];
      registeredTool = { name, callback };
    }),
  } as unknown as McpServer;

  return server;
}

function createMockClient(response: unknown) {
  const jsonFn = vi.fn().mockResolvedValue(response);
  const postFn = vi.fn().mockReturnValue({ json: jsonFn });

  return {
    client: ky.create() as unknown as ReturnType<typeof ky.create>,
    postFn,
    jsonFn,
    install: () => {
      const mockClient = { post: postFn } as unknown as ReturnType<typeof ky.create>;
      return mockClient;
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('loop_ingest_signal', () => {
  const signalResponse = {
    data: {
      signal: { id: 'sig_abc123', source: 'agent' },
      issue: {
        id: 'iss_xyz789',
        number: 42,
        title: '[agent] error: Something broke',
        status: 'triage',
      },
    },
  };

  let mockPost: ReturnType<typeof vi.fn>;
  let mockJson: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockJson = vi.fn().mockResolvedValue(signalResponse);
    mockPost = vi.fn().mockReturnValue({ json: mockJson });

    const server = createMockServer();
    const client = { post: mockPost } as unknown as ReturnType<typeof ky.create>;
    registerIngestSignal(server, client);
  });

  it('registers tool with correct name', () => {
    expect(registeredTool.name).toBe('loop_ingest_signal');
  });

  it('POST succeeds and returns structured signal + issue output', async () => {
    const args = {
      source: 'agent',
      type: 'error',
      severity: 'high',
      payload: { message: 'Something broke' },
    };

    const result = await registeredTool.callback(args);

    // Verify POST was called with correct endpoint and body
    expect(mockPost).toHaveBeenCalledWith('api/signals', { json: args });

    // Verify structured output
    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual({
      signal: { id: 'sig_abc123', source: 'agent' },
      issue: {
        id: 'iss_xyz789',
        number: 42,
        title: '[agent] error: Something broke',
        status: 'triage',
      },
    });
  });

  it('passes optional projectId through to the API', async () => {
    const args = {
      source: 'posthog',
      type: 'metric_change',
      severity: 'medium',
      payload: { metric: 'conversion', delta: -0.12 },
      projectId: 'proj_123',
    };

    await registeredTool.callback(args);

    expect(mockPost).toHaveBeenCalledWith('api/signals', { json: args });
  });
});
