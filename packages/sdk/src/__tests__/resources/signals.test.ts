import { describe, it, expect, vi } from 'vitest';
import { SignalsResource } from '../../resources/signals';
import type { HttpClient } from '../../http';

function makeHttpClient(
  overrides: Partial<Record<'get' | 'post' | 'patch' | 'delete', unknown>> = {}
): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as HttpClient;
}

const mockSignalResponse = {
  signal: {
    id: 'sig_1',
    source: 'posthog',
    sourceId: 'alert_123',
    type: 'metric_drop',
    severity: 'high' as const,
    payload: { metric: 'conversion', drop: 0.12 },
    issueId: 'issue_1',
    createdAt: '2026-02-23T00:00:00Z',
  },
  issue: {
    id: 'issue_1',
    number: 42,
    title: 'PostHog: conversion drop -12%',
    description: null,
    type: 'signal' as const,
    status: 'triage' as const,
    priority: 1,
    parentId: null,
    projectId: null,
    signalSource: 'posthog',
    signalPayload: null,
    hypothesis: null,
    agentSessionId: null,
    agentSummary: null,
    commits: null,
    pullRequests: null,
    completedAt: null,
    createdAt: '2026-02-23T00:00:00Z',
    updatedAt: '2026-02-23T00:00:00Z',
    deletedAt: null,
  },
};

describe('SignalsResource', () => {
  describe('ingest()', () => {
    it('POSTs to api/signals', async () => {
      const postFn = vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: mockSignalResponse }),
      });
      const http = makeHttpClient({ post: postFn });
      const resource = new SignalsResource(http);

      await resource.ingest({
        source: 'posthog',
        type: 'metric_drop',
        severity: 'high',
        payload: { metric: 'conversion' },
      });

      expect(postFn).toHaveBeenCalledWith(
        'api/signals',
        expect.objectContaining({ json: expect.anything() })
      );
    });

    it('sends the correct JSON body', async () => {
      const postFn = vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: mockSignalResponse }),
      });
      const http = makeHttpClient({ post: postFn });
      const resource = new SignalsResource(http);

      const params = {
        source: 'posthog',
        sourceId: 'alert_123',
        type: 'metric_drop',
        severity: 'high' as const,
        payload: { metric: 'conversion', drop: 0.12 },
        projectId: 'proj_1',
      };

      await resource.ingest(params);

      const [, options] = postFn.mock.calls[0] as [string, { json: unknown }];
      expect(options.json).toEqual(params);
    });

    it('returns SignalIngestResponse with both signal and issue', async () => {
      const http = makeHttpClient({
        post: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({ data: mockSignalResponse }),
        }),
      });
      const resource = new SignalsResource(http);

      const result = await resource.ingest({
        source: 'posthog',
        type: 'metric_drop',
        severity: 'high',
        payload: {},
      });

      expect(result).toEqual(mockSignalResponse);
      expect(result.signal).toBeDefined();
      expect(result.issue).toBeDefined();
    });

    it('unwraps the data envelope from the response', async () => {
      const http = makeHttpClient({
        post: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({ data: mockSignalResponse }),
        }),
      });
      const resource = new SignalsResource(http);

      const result = await resource.ingest({
        source: 'github',
        type: 'push',
        severity: 'low',
        payload: {},
      });

      // Verify we get the unwrapped data, not { data: ... }
      expect(result).not.toHaveProperty('data');
      expect(result.signal.id).toBe('sig_1');
    });

    it('passes RequestOptions through to ky', async () => {
      const postFn = vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: mockSignalResponse }),
      });
      const http = makeHttpClient({ post: postFn });
      const resource = new SignalsResource(http);

      const controller = new AbortController();
      await resource.ingest(
        { source: 'sentry', type: 'error_spike', severity: 'critical', payload: {} },
        { signal: controller.signal, timeout: 5000 }
      );

      const [, options] = postFn.mock.calls[0] as [
        string,
        { signal: AbortSignal; timeout: number },
      ];
      expect(options.signal).toBe(controller.signal);
      expect(options.timeout).toBe(5000);
    });

    it('passes idempotencyKey as Idempotency-Key header via RequestOptions', async () => {
      const postFn = vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: mockSignalResponse }),
      });
      const http = makeHttpClient({ post: postFn });
      const resource = new SignalsResource(http);

      await resource.ingest(
        { source: 'posthog', type: 'alert', severity: 'medium', payload: {} },
        { idempotencyKey: 'my-unique-key' }
      );

      const [, options] = postFn.mock.calls[0] as [string, { headers?: Record<string, string> }];
      expect(options.headers?.['Idempotency-Key']).toBe('my-unique-key');
    });

    it('calls .json() on the ky response chain', async () => {
      const jsonFn = vi.fn().mockResolvedValue({ data: mockSignalResponse });
      const http = makeHttpClient({
        post: vi.fn().mockReturnValue({ json: jsonFn }),
      });
      const resource = new SignalsResource(http);

      await resource.ingest({ source: 'sentry', type: 'error', severity: 'high', payload: {} });

      expect(jsonFn).toHaveBeenCalled();
    });
  });
});
