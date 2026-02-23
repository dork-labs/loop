import { describe, it, expect, vi } from 'vitest';
import { TemplatesResource } from '../../resources/templates';
import { PaginatedList } from '../../pagination';
import type {
  PromptTemplate,
  PromptVersion,
  TemplateDetail,
  TemplatePreview,
} from '@dork-labs/loop-types';

function makeTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    id: 'tpl_1',
    slug: 'triage-signal',
    name: 'Triage Signal',
    description: null,
    conditions: {},
    specificity: 10,
    projectId: null,
    activeVersionId: null,
    createdAt: '2026-02-23T00:00:00Z',
    updatedAt: '2026-02-23T00:00:00Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeVersion(overrides: Partial<PromptVersion> = {}): PromptVersion {
  return {
    id: 'ver_1',
    templateId: 'tpl_1',
    version: 1,
    content: 'You are a triage agent...',
    changelog: null,
    authorType: 'human',
    authorName: 'admin',
    status: 'active',
    usageCount: 0,
    completionRate: null,
    avgDurationMs: null,
    reviewScore: null,
    createdAt: '2026-02-23T00:00:00Z',
    ...overrides,
  };
}

function makeHttp() {
  const jsonFn = vi.fn();
  const chain = { json: jsonFn };
  return {
    http: {
      get: vi.fn().mockReturnValue(chain),
      post: vi.fn().mockReturnValue(chain),
      patch: vi.fn().mockReturnValue(chain),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    jsonFn,
  };
}

describe('TemplatesResource', () => {
  describe('list(params?)', () => {
    it('GETs api/templates and returns PaginatedList', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [makeTemplate()], total: 1 });
      const resource = new TemplatesResource(http as never);

      const result = await resource.list();

      expect(http.get).toHaveBeenCalledWith('api/templates', expect.any(Object));
      expect(result).toBeInstanceOf(PaginatedList);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('passes pagination params as search params', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [], total: 0 });
      const resource = new TemplatesResource(http as never);

      await resource.list({ limit: 10, offset: 20 });

      const callArg = http.get.mock.calls[0][1] as { searchParams: URLSearchParams };
      expect(callArg.searchParams.get('limit')).toBe('10');
      expect(callArg.searchParams.get('offset')).toBe('20');
    });
  });

  describe('iter()', () => {
    it('returns an AsyncGenerator that yields templates', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValueOnce({
        data: [makeTemplate({ id: 'tpl_1' }), makeTemplate({ id: 'tpl_2' })],
        total: 2,
      });
      const resource = new TemplatesResource(http as never);

      const results: PromptTemplate[] = [];
      for await (const template of resource.iter()) {
        results.push(template);
      }

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('tpl_1');
      expect(results[1].id).toBe('tpl_2');
    });
  });

  describe('get(id)', () => {
    it('GETs api/templates/:id', async () => {
      const { http, jsonFn } = makeHttp();
      const detail: TemplateDetail = { ...makeTemplate(), activeVersion: makeVersion() };
      jsonFn.mockResolvedValue({ data: detail });
      const resource = new TemplatesResource(http as never);

      const result = await resource.get('tpl_1');

      expect(http.get).toHaveBeenCalledWith('api/templates/tpl_1');
      expect(result.activeVersion).toBeDefined();
    });

    it('returns TemplateDetail with activeVersion', async () => {
      const { http, jsonFn } = makeHttp();
      const detail: TemplateDetail = { ...makeTemplate(), activeVersion: makeVersion() };
      jsonFn.mockResolvedValue({ data: detail });
      const resource = new TemplatesResource(http as never);

      const result = await resource.get('tpl_1');

      expect(result.activeVersion?.id).toBe('ver_1');
    });
  });

  describe('create(params)', () => {
    it('POSTs to api/templates with JSON body', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeTemplate() });
      const resource = new TemplatesResource(http as never);

      const params = { slug: 'triage-signal', name: 'Triage Signal' };
      await resource.create(params);

      expect(http.post).toHaveBeenCalledWith(
        'api/templates',
        expect.objectContaining({ json: params })
      );
    });

    it('returns the created PromptTemplate', async () => {
      const { http, jsonFn } = makeHttp();
      const template = makeTemplate({ slug: 'my-template' });
      jsonFn.mockResolvedValue({ data: template });
      const resource = new TemplatesResource(http as never);

      const result = await resource.create({ slug: 'my-template', name: 'My Template' });

      expect(result.slug).toBe('my-template');
    });
  });

  describe('update(id, params)', () => {
    it('PATCHes api/templates/:id with JSON body', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeTemplate({ name: 'Updated Name' }) });
      const resource = new TemplatesResource(http as never);

      const params = { name: 'Updated Name' };
      await resource.update('tpl_1', params);

      expect(http.patch).toHaveBeenCalledWith(
        'api/templates/tpl_1',
        expect.objectContaining({ json: params })
      );
    });
  });

  describe('delete(id)', () => {
    it('sends DELETE to api/templates/:id', async () => {
      const { http } = makeHttp();
      const resource = new TemplatesResource(http as never);

      await resource.delete('tpl_1');

      expect(http.delete).toHaveBeenCalledWith('api/templates/tpl_1', expect.any(Object));
    });

    it('returns void', async () => {
      const { http } = makeHttp();
      const resource = new TemplatesResource(http as never);

      const result = await resource.delete('tpl_1');

      expect(result).toBeUndefined();
    });
  });

  describe('preview(issueId)', () => {
    it('GETs api/templates/preview/:issueId', async () => {
      const { http, jsonFn } = makeHttp();
      const preview: TemplatePreview = {
        issue: { id: 'issue_1', number: 1, title: 'Test Issue', type: 'task' },
        template: makeTemplate(),
        version: { id: 'ver_1', version: 1 },
        prompt: 'You are a triage agent...',
      };
      jsonFn.mockResolvedValue({ data: preview });
      const resource = new TemplatesResource(http as never);

      const result = await resource.preview('issue_1');

      expect(http.get).toHaveBeenCalledWith('api/templates/preview/issue_1');
      expect(result.prompt).toBe('You are a triage agent...');
    });

    it('returns null prompt when no template matches', async () => {
      const { http, jsonFn } = makeHttp();
      const preview: TemplatePreview = {
        issue: { id: 'issue_1', number: 1, title: 'Test Issue', type: 'task' },
        template: null,
        version: null,
        prompt: null,
        message: 'No matching template found',
      };
      jsonFn.mockResolvedValue({ data: preview });
      const resource = new TemplatesResource(http as never);

      const result = await resource.preview('issue_1');

      expect(result.prompt).toBeNull();
      expect(result.template).toBeNull();
    });
  });

  describe('versions(id, params?)', () => {
    it('GETs api/templates/:id/versions', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [makeVersion()], total: 1 });
      const resource = new TemplatesResource(http as never);

      const result = await resource.versions('tpl_1');

      expect(http.get).toHaveBeenCalledWith('api/templates/tpl_1/versions', expect.any(Object));
      expect(result).toBeInstanceOf(PaginatedList);
      expect(result.total).toBe(1);
    });

    it('passes pagination params', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [], total: 0 });
      const resource = new TemplatesResource(http as never);

      await resource.versions('tpl_1', { limit: 5, offset: 10 });

      const callArg = http.get.mock.calls[0][1] as { searchParams: URLSearchParams };
      expect(callArg.searchParams.get('limit')).toBe('5');
      expect(callArg.searchParams.get('offset')).toBe('10');
    });
  });

  describe('createVersion(id, params)', () => {
    it('POSTs to api/templates/:id/versions', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeVersion() });
      const resource = new TemplatesResource(http as never);

      const params = { content: 'New content', authorType: 'human' as const, authorName: 'admin' };
      await resource.createVersion('tpl_1', params);

      expect(http.post).toHaveBeenCalledWith(
        'api/templates/tpl_1/versions',
        expect.objectContaining({ json: params })
      );
    });

    it('returns the created PromptVersion', async () => {
      const { http, jsonFn } = makeHttp();
      const version = makeVersion({ version: 2 });
      jsonFn.mockResolvedValue({ data: version });
      const resource = new TemplatesResource(http as never);

      const result = await resource.createVersion('tpl_1', {
        content: 'v2 content',
        authorType: 'human',
        authorName: 'admin',
      });

      expect(result.version).toBe(2);
    });
  });

  describe('promote(id, versionId)', () => {
    it('POSTs to api/templates/:id/versions/:versionId/promote', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeVersion({ status: 'active' }) });
      const resource = new TemplatesResource(http as never);

      await resource.promote('tpl_1', 'ver_1');

      expect(http.post).toHaveBeenCalledWith(
        'api/templates/tpl_1/versions/ver_1/promote',
        expect.any(Object)
      );
    });

    it('returns the promoted PromptVersion', async () => {
      const { http, jsonFn } = makeHttp();
      const version = makeVersion({ status: 'active' });
      jsonFn.mockResolvedValue({ data: version });
      const resource = new TemplatesResource(http as never);

      const result = await resource.promote('tpl_1', 'ver_1');

      expect(result.status).toBe('active');
    });
  });
});
