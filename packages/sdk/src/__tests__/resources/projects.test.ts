import { describe, it, expect, vi } from 'vitest';
import { ProjectsResource } from '../../resources/projects';
import { PaginatedList } from '../../pagination';
import type { HttpClient } from '../../http';

/** Build a minimal HttpClient mock for the given HTTP methods. */
function makeHttp(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as HttpClient;
}

/** Build a chainable ky response mock: http.get(...).json<T>() */
function kyChain<T>(data: T) {
  return { json: vi.fn().mockResolvedValue(data) };
}

const baseProject = {
  id: 'proj_1',
  name: 'My Project',
  description: null,
  status: 'active' as const,
  health: 'on_track' as const,
  goalId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

describe('ProjectsResource', () => {
  describe('list()', () => {
    it('GETs api/projects and returns a PaginatedList', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: [baseProject], total: 1 })),
      });
      const resource = new ProjectsResource(http);

      const result = await resource.list();

      expect(http.get).toHaveBeenCalledWith(
        'api/projects',
        expect.objectContaining({ searchParams: expect.any(URLSearchParams) })
      );
      expect(result).toBeInstanceOf(PaginatedList);
      expect(result.data).toEqual([baseProject]);
      expect(result.total).toBe(1);
    });

    it('passes limit and offset as search params', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: [], total: 0 })),
      });
      const resource = new ProjectsResource(http);

      await resource.list({ limit: 10, offset: 20 });

      const [, options] = (http.get as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        { searchParams: URLSearchParams },
      ];
      expect(options.searchParams.get('limit')).toBe('10');
      expect(options.searchParams.get('offset')).toBe('20');
    });

    it('returns hasMore=true when more data exists', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: [baseProject], total: 5 })),
      });
      const resource = new ProjectsResource(http);

      const result = await resource.list();
      expect(result.hasMore).toBe(true);
    });
  });

  describe('iter()', () => {
    it('yields items from a single page', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(
          kyChain({
            data: [
              { ...baseProject, id: 'p1' },
              { ...baseProject, id: 'p2' },
            ],
            total: 2,
          })
        ),
      });
      const resource = new ProjectsResource(http);

      const ids: string[] = [];
      for await (const project of resource.iter()) {
        ids.push(project.id);
      }

      expect(ids).toEqual(['p1', 'p2']);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('auto-paginates across multiple pages', async () => {
      // Build 50 items for page 1 (fills the default pageSize) and 1 item for page 2
      const page1 = Array.from({ length: 50 }, (_, i) => ({ ...baseProject, id: `p${i + 1}` }));
      const page2 = [{ ...baseProject, id: 'p51' }];
      const http = makeHttp({
        get: vi
          .fn()
          .mockReturnValueOnce(kyChain({ data: page1, total: 51 }))
          .mockReturnValueOnce(kyChain({ data: page2, total: 51 })),
      });
      const resource = new ProjectsResource(http);

      const ids: string[] = [];
      for await (const project of resource.iter()) {
        ids.push(project.id);
      }

      expect(ids).toHaveLength(51);
      expect(ids[0]).toBe('p1');
      expect(ids[50]).toBe('p51');
      expect(http.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('get()', () => {
    it('GETs api/projects/:id and returns ProjectDetail', async () => {
      const detail = {
        ...baseProject,
        goal: null,
        issueCounts: { triage: 0, backlog: 0, todo: 1, in_progress: 0, done: 2, canceled: 0 },
      };
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: detail })),
      });
      const resource = new ProjectsResource(http);

      const result = await resource.get('proj_1');

      expect(http.get).toHaveBeenCalledWith('api/projects/proj_1');
      expect(result).toEqual(detail);
    });
  });

  describe('create()', () => {
    it('POSTs to api/projects with JSON body and returns Project', async () => {
      const http = makeHttp({
        post: vi.fn().mockReturnValue(kyChain({ data: baseProject })),
      });
      const resource = new ProjectsResource(http);

      const result = await resource.create({ name: 'My Project' });

      expect(http.post).toHaveBeenCalledWith(
        'api/projects',
        expect.objectContaining({ json: { name: 'My Project' } })
      );
      expect(result).toEqual(baseProject);
    });

    it('forwards RequestOptions to ky', async () => {
      const http = makeHttp({
        post: vi.fn().mockReturnValue(kyChain({ data: baseProject })),
      });
      const resource = new ProjectsResource(http);

      await resource.create({ name: 'My Project' }, { idempotencyKey: 'my-key' });

      const [, opts] = (http.post as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const headers = opts.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('my-key');
    });
  });

  describe('update()', () => {
    it('PATCHes api/projects/:id with JSON body and returns Project', async () => {
      const http = makeHttp({
        patch: vi.fn().mockReturnValue(kyChain({ data: { ...baseProject, name: 'Updated' } })),
      });
      const resource = new ProjectsResource(http);

      const result = await resource.update('proj_1', { name: 'Updated' });

      expect(http.patch).toHaveBeenCalledWith(
        'api/projects/proj_1',
        expect.objectContaining({ json: { name: 'Updated' } })
      );
      expect(result.name).toBe('Updated');
    });
  });

  describe('delete()', () => {
    it('sends DELETE to api/projects/:id', async () => {
      const http = makeHttp({
        delete: vi.fn().mockResolvedValue(undefined),
      });
      const resource = new ProjectsResource(http);

      await resource.delete('proj_1');

      expect(http.delete).toHaveBeenCalledWith('api/projects/proj_1', expect.any(Object));
    });

    it('forwards RequestOptions to delete', async () => {
      const http = makeHttp({
        delete: vi.fn().mockResolvedValue(undefined),
      });
      const resource = new ProjectsResource(http);

      await resource.delete('proj_1', { idempotencyKey: 'del-key' });

      const [, opts] = (http.delete as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const headers = opts.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('del-key');
    });
  });
});
