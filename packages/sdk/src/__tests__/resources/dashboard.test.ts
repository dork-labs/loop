import { describe, it, expect, vi } from 'vitest';
import { DashboardResource } from '../../resources/dashboard';
import type {
  DashboardStats,
  DashboardActivityItem,
  DashboardPromptHealth,
} from '@dork-labs/loop-types';

function makeDashboardStats(): DashboardStats {
  return {
    issues: {
      total: 42,
      byStatus: {
        triage: 5,
        backlog: 10,
        todo: 8,
        in_progress: 4,
        done: 12,
        canceled: 3,
      },
      byType: {
        signal: 5,
        hypothesis: 8,
        plan: 4,
        task: 20,
        monitor: 5,
      },
    },
    goals: {
      total: 3,
      active: 2,
      achieved: 1,
    },
    dispatch: {
      queueDepth: 8,
      activeCount: 4,
      completedLast24h: 12,
    },
  };
}

function makeActivityItem(): DashboardActivityItem {
  return {
    root: {
      id: 'issue_1',
      number: 1,
      title: 'Signal: Conversion drop',
      description: null,
      type: 'signal',
      status: 'done',
      priority: 2,
      parentId: null,
      projectId: null,
      signalSource: 'posthog',
      signalPayload: null,
      hypothesis: null,
      agentSessionId: null,
      agentSummary: null,
      commits: null,
      pullRequests: null,
      completedAt: '2026-02-23T00:00:00Z',
      createdAt: '2026-02-22T00:00:00Z',
      updatedAt: '2026-02-23T00:00:00Z',
      deletedAt: null,
    },
    children: [],
    latestActivity: '2026-02-23T00:00:00Z',
  };
}

function makePromptHealth(): DashboardPromptHealth {
  return {
    template: {
      id: 'tpl_1',
      slug: 'triage-signal',
      name: 'Triage Signal',
      description: null,
      conditions: {},
      specificity: 10,
      projectId: null,
      activeVersionId: 'ver_1',
      createdAt: '2026-02-23T00:00:00Z',
      updatedAt: '2026-02-23T00:00:00Z',
      deletedAt: null,
    },
    activeVersion: null,
    recentVersions: [],
    reviewSummary: {
      totalReviews: 10,
      avgClarity: 4.2,
      avgCompleteness: 4.5,
      avgRelevance: 4.0,
      compositeScore: 4.23,
    },
    needsAttention: false,
  };
}

function makeHttp() {
  const jsonFn = vi.fn();
  const chain = { json: jsonFn };
  return {
    http: {
      get: vi.fn().mockReturnValue(chain),
    },
    jsonFn,
  };
}

describe('DashboardResource', () => {
  describe('stats()', () => {
    it('GETs api/dashboard/stats', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeDashboardStats() });
      const resource = new DashboardResource(http as never);

      await resource.stats();

      expect(http.get).toHaveBeenCalledWith('api/dashboard/stats');
    });

    it('returns DashboardStats with issue counts', async () => {
      const { http, jsonFn } = makeHttp();
      const stats = makeDashboardStats();
      jsonFn.mockResolvedValue({ data: stats });
      const resource = new DashboardResource(http as never);

      const result = await resource.stats();

      expect(result.issues.total).toBe(42);
      expect(result.goals.active).toBe(2);
      expect(result.dispatch.queueDepth).toBe(8);
    });

    it('unwraps the data envelope', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeDashboardStats() });
      const resource = new DashboardResource(http as never);

      const result = await resource.stats();

      expect(result).not.toHaveProperty('data');
      expect(result).toHaveProperty('issues');
    });
  });

  describe('activity(params?)', () => {
    it('GETs api/dashboard/activity', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [makeActivityItem()] });
      const resource = new DashboardResource(http as never);

      await resource.activity();

      expect(http.get).toHaveBeenCalledWith('api/dashboard/activity', expect.any(Object));
    });

    it('returns an array of DashboardActivityItem', async () => {
      const { http, jsonFn } = makeHttp();
      const items = [makeActivityItem(), makeActivityItem()];
      jsonFn.mockResolvedValue({ data: items });
      const resource = new DashboardResource(http as never);

      const result = await resource.activity();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('passes pagination params as search params', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [] });
      const resource = new DashboardResource(http as never);

      await resource.activity({ limit: 5, offset: 10 });

      const callArg = http.get.mock.calls[0][1] as { searchParams: URLSearchParams };
      expect(callArg.searchParams.get('limit')).toBe('5');
      expect(callArg.searchParams.get('offset')).toBe('10');
    });

    it('returns empty array when no activity exists', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [] });
      const resource = new DashboardResource(http as never);

      const result = await resource.activity();

      expect(result).toEqual([]);
    });
  });

  describe('prompts()', () => {
    it('GETs api/dashboard/prompts', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [makePromptHealth()] });
      const resource = new DashboardResource(http as never);

      await resource.prompts();

      expect(http.get).toHaveBeenCalledWith('api/dashboard/prompts');
    });

    it('returns an array of DashboardPromptHealth', async () => {
      const { http, jsonFn } = makeHttp();
      const healthItems = [makePromptHealth()];
      jsonFn.mockResolvedValue({ data: healthItems });
      const resource = new DashboardResource(http as never);

      const result = await resource.prompts();

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].template.slug).toBe('triage-signal');
      expect(result[0].reviewSummary.compositeScore).toBe(4.23);
    });

    it('includes needsAttention flag', async () => {
      const { http, jsonFn } = makeHttp();
      const health = makePromptHealth();
      health.needsAttention = true;
      jsonFn.mockResolvedValue({ data: [health] });
      const resource = new DashboardResource(http as never);

      const result = await resource.prompts();

      expect(result[0].needsAttention).toBe(true);
    });

    it('unwraps the data envelope', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [makePromptHealth()] });
      const resource = new DashboardResource(http as never);

      const result = await resource.prompts();

      expect(result).not.toHaveProperty('data');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
