import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DispatchResource } from '../../resources/dispatch';
import { PaginatedList } from '../../pagination';
import type { HttpClient } from '../../http';

function makeJsonResponse<T>(data: T, status = 200) {
  return {
    status,
    json: vi.fn().mockResolvedValue(data),
  };
}

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

describe('DispatchResource', () => {
  describe('next()', () => {
    it('returns DispatchNextResponse when status is 200', async () => {
      const payload = {
        issue: {
          id: 'issue_1',
          number: 1,
          title: 'Fix bug',
          type: 'task',
          priority: 1,
          status: 'todo',
        },
        prompt: 'Go fix the bug',
        meta: {
          templateSlug: 'task-fix',
          templateId: 'tmpl_1',
          versionId: 'ver_1',
          versionNumber: 1,
          reviewUrl: 'https://app.looped.me/reviews/ver_1',
        },
      };
      const http = makeHttpClient({
        get: vi.fn().mockReturnValue(makeJsonResponse({ data: payload }, 200)),
      });
      const resource = new DispatchResource(http);

      const result = await resource.next();

      expect(result).toEqual(payload);
    });

    it('returns null when status is 204 (queue empty)', async () => {
      const http = makeHttpClient({
        get: vi.fn().mockReturnValue({ status: 204, json: vi.fn() }),
      });
      const resource = new DispatchResource(http);

      const result = await resource.next();

      expect(result).toBeNull();
    });

    it('does not call .json() when status is 204', async () => {
      const jsonFn = vi.fn();
      const http = makeHttpClient({
        get: vi.fn().mockReturnValue({ status: 204, json: jsonFn }),
      });
      const resource = new DispatchResource(http);

      await resource.next();

      expect(jsonFn).not.toHaveBeenCalled();
    });

    it('passes projectId as a search param', async () => {
      const payload = {
        issue: {
          id: 'issue_1',
          number: 1,
          title: 'Fix bug',
          type: 'task',
          priority: 1,
          status: 'todo',
        },
        prompt: null,
        meta: null,
      };
      const getFn = vi.fn().mockReturnValue(makeJsonResponse({ data: payload }, 200));
      const http = makeHttpClient({ get: getFn });
      const resource = new DispatchResource(http);

      await resource.next({ projectId: 'proj_1' });

      const [, options] = getFn.mock.calls[0] as [string, { searchParams: URLSearchParams }];
      expect(options.searchParams.get('projectId')).toBe('proj_1');
    });

    it('calls api/dispatch/next endpoint', async () => {
      const getFn = vi.fn().mockReturnValue(
        makeJsonResponse(
          {
            data: {
              issue: { id: 'i1', number: 1, title: 'T', type: 'task', priority: 1, status: 'todo' },
              prompt: null,
              meta: null,
            },
          },
          200
        )
      );
      const http = makeHttpClient({ get: getFn });
      const resource = new DispatchResource(http);

      await resource.next();

      expect(getFn).toHaveBeenCalledWith('api/dispatch/next', expect.anything());
    });

    it('passes no search params when called without arguments', async () => {
      const payload = {
        issue: { id: 'i1', number: 1, title: 'T', type: 'task', priority: 1, status: 'todo' },
        prompt: null,
        meta: null,
      };
      const getFn = vi.fn().mockReturnValue(makeJsonResponse({ data: payload }, 200));
      const http = makeHttpClient({ get: getFn });
      const resource = new DispatchResource(http);

      await resource.next();

      const [, options] = getFn.mock.calls[0] as [string, { searchParams: URLSearchParams }];
      expect([...options.searchParams.entries()]).toHaveLength(0);
    });
  });

  describe('queue()', () => {
    const queueItems = [
      {
        issue: { id: 'i1', number: 1, title: 'A', type: 'task', priority: 1, status: 'todo' },
        score: 95,
        breakdown: { priorityWeight: 50, goalBonus: 20, ageBonus: 15, typeBonus: 10 },
      },
      {
        issue: { id: 'i2', number: 2, title: 'B', type: 'signal', priority: 2, status: 'triage' },
        score: 60,
        breakdown: { priorityWeight: 30, goalBonus: 10, ageBonus: 10, typeBonus: 10 },
      },
    ];

    beforeEach(() => {});

    it('returns a PaginatedList of DispatchQueueItems', async () => {
      const http = makeHttpClient({
        get: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({ data: queueItems, total: 2 }),
        }),
      });
      const resource = new DispatchResource(http);

      const result = await resource.queue();

      expect(result).toBeInstanceOf(PaginatedList);
      expect(result.data).toEqual(queueItems);
      expect(result.total).toBe(2);
    });

    it('calls api/dispatch/queue endpoint', async () => {
      const getFn = vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });
      const http = makeHttpClient({ get: getFn });
      const resource = new DispatchResource(http);

      await resource.queue();

      expect(getFn).toHaveBeenCalledWith('api/dispatch/queue', expect.anything());
    });

    it('passes limit and offset as search params', async () => {
      const getFn = vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });
      const http = makeHttpClient({ get: getFn });
      const resource = new DispatchResource(http);

      await resource.queue({ limit: 10, offset: 20 });

      const [, options] = getFn.mock.calls[0] as [string, { searchParams: URLSearchParams }];
      expect(options.searchParams.get('limit')).toBe('10');
      expect(options.searchParams.get('offset')).toBe('20');
    });

    it('passes projectId as search param', async () => {
      const getFn = vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });
      const http = makeHttpClient({ get: getFn });
      const resource = new DispatchResource(http);

      await resource.queue({ projectId: 'proj_abc' });

      const [, options] = getFn.mock.calls[0] as [string, { searchParams: URLSearchParams }];
      expect(options.searchParams.get('projectId')).toBe('proj_abc');
    });

    it('hasMore is true when more items exist', async () => {
      const http = makeHttpClient({
        get: vi.fn().mockReturnValue({
          json: vi.fn().mockResolvedValue({ data: queueItems, total: 10 }),
        }),
      });
      const resource = new DispatchResource(http);

      const result = await resource.queue();

      expect(result.hasMore).toBe(true);
    });
  });
});
