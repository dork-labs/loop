import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IssuesResource } from '../../resources/issues';
import { PaginatedList } from '../../pagination';
import type { Issue, IssueDetail } from '@dork-labs/loop-types';

// Minimal Issue fixture for use in tests
function makeIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue_1',
    number: 1,
    title: 'Test issue',
    description: null,
    type: 'task',
    status: 'todo',
    priority: 0,
    parentId: null,
    projectId: null,
    signalSource: null,
    signalPayload: null,
    hypothesis: null,
    agentSessionId: null,
    agentSummary: null,
    commits: null,
    pullRequests: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeIssueDetail(overrides: Partial<IssueDetail> = {}): IssueDetail {
  return {
    ...makeIssue(),
    parent: null,
    children: [],
    labels: [],
    relations: [],
    ...overrides,
  };
}

// Helper to build a mock HTTP client
function makeMockHttp() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

describe('IssuesResource', () => {
  let http: ReturnType<typeof makeMockHttp>;
  let resource: IssuesResource;

  beforeEach(() => {
    http = makeMockHttp();
    resource = new IssuesResource(http as never);
  });

  describe('list()', () => {
    it('GETs api/issues and returns a PaginatedList', async () => {
      const issue = makeIssue();
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [issue], total: 1 }),
      });

      const result = await resource.list();

      expect(http.get).toHaveBeenCalledWith(
        'api/issues',
        expect.objectContaining({ searchParams: expect.any(URLSearchParams) })
      );
      expect(result).toBeInstanceOf(PaginatedList);
      expect(result.data).toEqual([issue]);
      expect(result.total).toBe(1);
    });

    it('passes status filter as search param', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      await resource.list({ status: 'todo' });

      const [, options] = http.get.mock.calls[0];
      expect(options.searchParams.get('status')).toBe('todo');
    });

    it('passes type filter as search param', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      await resource.list({ type: 'task' });

      const [, options] = http.get.mock.calls[0];
      expect(options.searchParams.get('type')).toBe('task');
    });

    it('passes projectId filter as search param', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      await resource.list({ projectId: 'proj_abc' });

      const [, options] = http.get.mock.calls[0];
      expect(options.searchParams.get('projectId')).toBe('proj_abc');
    });

    it('passes labelId filter as search param', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      await resource.list({ labelId: 'lbl_xyz' });

      const [, options] = http.get.mock.calls[0];
      expect(options.searchParams.get('labelId')).toBe('lbl_xyz');
    });

    it('passes priority filter as search param', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      await resource.list({ priority: 1 });

      const [, options] = http.get.mock.calls[0];
      expect(options.searchParams.get('priority')).toBe('1');
    });

    it('passes parentId filter as search param', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      await resource.list({ parentId: 'issue_parent' });

      const [, options] = http.get.mock.calls[0];
      expect(options.searchParams.get('parentId')).toBe('issue_parent');
    });

    it('passes limit and offset for pagination', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      await resource.list({ limit: 20, offset: 40 });

      const [, options] = http.get.mock.calls[0];
      expect(options.searchParams.get('limit')).toBe('20');
      expect(options.searchParams.get('offset')).toBe('40');
    });

    it('returns PaginatedList with hasMore true when more pages exist', async () => {
      const issues = [makeIssue({ id: 'issue_1' }), makeIssue({ id: 'issue_2' })];
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: issues, total: 10 }),
      });

      const result = await resource.list({ limit: 2 });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(10);
    });
  });

  describe('iter()', () => {
    it('auto-paginates across multiple pages', async () => {
      // paginate() stops when data.length < pageSize (default 50), so each full
      // page must return exactly 50 items for the generator to continue to the next page.
      const page1 = Array.from({ length: 50 }, (_, i) => makeIssue({ id: `issue_${i + 1}` }));
      const page2 = [makeIssue({ id: 'issue_51' })];

      http.get
        .mockReturnValueOnce({ json: vi.fn().mockResolvedValue({ data: page1, total: 51 }) })
        .mockReturnValueOnce({ json: vi.fn().mockResolvedValue({ data: page2, total: 51 }) });

      const collected: Issue[] = [];
      for await (const issue of resource.iter()) {
        collected.push(issue);
      }

      expect(collected).toHaveLength(51);
      expect(collected[0].id).toBe('issue_1');
      expect(collected[50].id).toBe('issue_51');
      expect(http.get).toHaveBeenCalledTimes(2);
    });

    it('passes filter params to each page request', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of resource.iter({ status: 'todo', type: 'task' })) {
        // drain
      }

      const [, options] = http.get.mock.calls[0];
      expect(options.searchParams.get('status')).toBe('todo');
      expect(options.searchParams.get('type')).toBe('task');
    });

    it('yields zero items when list returns empty', async () => {
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      });

      const collected: Issue[] = [];
      for await (const issue of resource.iter()) {
        collected.push(issue);
      }

      expect(collected).toHaveLength(0);
    });
  });

  describe('get()', () => {
    it('GETs api/issues/:id and returns IssueDetail', async () => {
      const detail = makeIssueDetail({ id: 'issue_abc' });
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: detail }),
      });

      const result = await resource.get('issue_abc');

      expect(http.get).toHaveBeenCalledWith('api/issues/issue_abc');
      expect(result).toEqual(detail);
      expect(result.parent).toBeNull();
      expect(result.children).toEqual([]);
      expect(result.labels).toEqual([]);
      expect(result.relations).toEqual([]);
    });

    it('returns issue with parent populated', async () => {
      const parent = makeIssue({ id: 'issue_parent' });
      const detail = makeIssueDetail({ id: 'issue_child', parentId: 'issue_parent', parent });
      http.get.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: detail }),
      });

      const result = await resource.get('issue_child');

      expect(result.parent).toEqual(parent);
    });
  });

  describe('create()', () => {
    it('POSTs to api/issues with JSON body and returns Issue', async () => {
      const created = makeIssue({ id: 'issue_new', title: 'New issue' });
      http.post.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: created }),
      });

      const params = { title: 'New issue', type: 'task' as const };
      const result = await resource.create(params);

      expect(http.post).toHaveBeenCalledWith(
        'api/issues',
        expect.objectContaining({ json: params })
      );
      expect(result).toEqual(created);
    });

    it('passes idempotency key via options', async () => {
      const created = makeIssue();
      http.post.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: created }),
      });

      await resource.create(
        { title: 'Issue', type: 'task' as const },
        { idempotencyKey: 'my-idem-key' }
      );

      const [, callOptions] = http.post.mock.calls[0];
      expect(callOptions.headers).toEqual({ 'Idempotency-Key': 'my-idem-key' });
    });
  });

  describe('update()', () => {
    it('PATCHes api/issues/:id with JSON body and returns updated Issue', async () => {
      const updated = makeIssue({ id: 'issue_1', title: 'Updated title', status: 'in_progress' });
      http.patch.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: updated }),
      });

      const params = { title: 'Updated title', status: 'in_progress' as const };
      const result = await resource.update('issue_1', params);

      expect(http.patch).toHaveBeenCalledWith(
        'api/issues/issue_1',
        expect.objectContaining({ json: params })
      );
      expect(result).toEqual(updated);
    });

    it('passes per-request timeout via options', async () => {
      const updated = makeIssue();
      http.patch.mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: updated }),
      });

      await resource.update('issue_1', { status: 'done' as const }, { timeout: 5000 });

      const [, callOptions] = http.patch.mock.calls[0];
      expect(callOptions.timeout).toBe(5000);
    });
  });

  describe('delete()', () => {
    it('sends DELETE to api/issues/:id', async () => {
      http.delete.mockResolvedValue(undefined);

      await resource.delete('issue_1');

      expect(http.delete).toHaveBeenCalledWith('api/issues/issue_1', expect.any(Object));
    });

    it('returns void on success', async () => {
      http.delete.mockResolvedValue(undefined);

      const result = await resource.delete('issue_1');

      expect(result).toBeUndefined();
    });

    it('passes per-request options for delete', async () => {
      http.delete.mockResolvedValue(undefined);

      await resource.delete('issue_1', { idempotencyKey: 'del-key' });

      const [, callOptions] = http.delete.mock.calls[0];
      expect(callOptions.headers).toEqual({ 'Idempotency-Key': 'del-key' });
    });
  });
});
