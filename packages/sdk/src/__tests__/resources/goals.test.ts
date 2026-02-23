import { describe, it, expect, vi } from 'vitest';
import { GoalsResource } from '../../resources/goals';
import { PaginatedList } from '../../pagination';
import type { HttpClient } from '../../http';

function makeHttp(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as HttpClient;
}

function kyChain<T>(data: T) {
  return { json: vi.fn().mockResolvedValue(data) };
}

const baseGoal = {
  id: 'goal_1',
  title: 'Improve sign-up conversion',
  description: null,
  metric: 'conversion_rate',
  targetValue: 4.0,
  currentValue: 3.2,
  unit: 'percent',
  status: 'active' as const,
  projectId: 'proj_1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

describe('GoalsResource', () => {
  describe('list()', () => {
    it('GETs api/goals and returns a PaginatedList', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: [baseGoal], total: 1 })),
      });
      const resource = new GoalsResource(http);

      const result = await resource.list();

      expect(http.get).toHaveBeenCalledWith(
        'api/goals',
        expect.objectContaining({ searchParams: expect.any(URLSearchParams) })
      );
      expect(result).toBeInstanceOf(PaginatedList);
      expect(result.data).toEqual([baseGoal]);
      expect(result.total).toBe(1);
    });

    it('passes limit and offset as search params', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: [], total: 0 })),
      });
      const resource = new GoalsResource(http);

      await resource.list({ limit: 5, offset: 10 });

      const [, options] = (http.get as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        { searchParams: URLSearchParams },
      ];
      expect(options.searchParams.get('limit')).toBe('5');
      expect(options.searchParams.get('offset')).toBe('10');
    });
  });

  describe('iter()', () => {
    it('yields items from a single page', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(
          kyChain({
            data: [
              { ...baseGoal, id: 'g1' },
              { ...baseGoal, id: 'g2' },
            ],
            total: 2,
          })
        ),
      });
      const resource = new GoalsResource(http);

      const ids: string[] = [];
      for await (const goal of resource.iter()) {
        ids.push(goal.id);
      }

      expect(ids).toEqual(['g1', 'g2']);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('auto-paginates across multiple pages', async () => {
      // Build 50 items for page 1 (fills the default pageSize) and 1 item for page 2
      const page1 = Array.from({ length: 50 }, (_, i) => ({ ...baseGoal, id: `g${i + 1}` }));
      const page2 = [{ ...baseGoal, id: 'g51' }];
      const http = makeHttp({
        get: vi
          .fn()
          .mockReturnValueOnce(kyChain({ data: page1, total: 51 }))
          .mockReturnValueOnce(kyChain({ data: page2, total: 51 })),
      });
      const resource = new GoalsResource(http);

      const ids: string[] = [];
      for await (const goal of resource.iter()) {
        ids.push(goal.id);
      }

      expect(ids).toHaveLength(51);
      expect(ids[0]).toBe('g1');
      expect(ids[50]).toBe('g51');
      expect(http.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('get()', () => {
    it('GETs api/goals/:id and returns Goal', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: baseGoal })),
      });
      const resource = new GoalsResource(http);

      const result = await resource.get('goal_1');

      expect(http.get).toHaveBeenCalledWith('api/goals/goal_1');
      expect(result).toEqual(baseGoal);
    });
  });

  describe('create()', () => {
    it('POSTs to api/goals with JSON body and returns Goal', async () => {
      const http = makeHttp({
        post: vi.fn().mockReturnValue(kyChain({ data: baseGoal })),
      });
      const resource = new GoalsResource(http);

      const result = await resource.create({ title: 'Improve sign-up conversion' });

      expect(http.post).toHaveBeenCalledWith(
        'api/goals',
        expect.objectContaining({
          json: { title: 'Improve sign-up conversion' },
        })
      );
      expect(result).toEqual(baseGoal);
    });

    it('forwards RequestOptions to ky', async () => {
      const http = makeHttp({
        post: vi.fn().mockReturnValue(kyChain({ data: baseGoal })),
      });
      const resource = new GoalsResource(http);

      await resource.create(
        { title: 'Improve sign-up conversion' },
        { idempotencyKey: 'goal-key' }
      );

      const [, opts] = (http.post as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const headers = opts.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('goal-key');
    });
  });

  describe('update()', () => {
    it('PATCHes api/goals/:id with JSON body and returns Goal', async () => {
      const updated = { ...baseGoal, currentValue: 3.8 };
      const http = makeHttp({
        patch: vi.fn().mockReturnValue(kyChain({ data: updated })),
      });
      const resource = new GoalsResource(http);

      const result = await resource.update('goal_1', { currentValue: 3.8 });

      expect(http.patch).toHaveBeenCalledWith(
        'api/goals/goal_1',
        expect.objectContaining({
          json: { currentValue: 3.8 },
        })
      );
      expect(result.currentValue).toBe(3.8);
    });
  });

  describe('delete()', () => {
    it('sends DELETE to api/goals/:id', async () => {
      const http = makeHttp({
        delete: vi.fn().mockResolvedValue(undefined),
      });
      const resource = new GoalsResource(http);

      await resource.delete('goal_1');

      expect(http.delete).toHaveBeenCalledWith('api/goals/goal_1', expect.any(Object));
    });

    it('forwards RequestOptions to delete', async () => {
      const http = makeHttp({
        delete: vi.fn().mockResolvedValue(undefined),
      });
      const resource = new GoalsResource(http);

      await resource.delete('goal_1', { idempotencyKey: 'del-goal' });

      const [, opts] = (http.delete as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const headers = opts.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('del-goal');
    });
  });
});
