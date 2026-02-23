import { describe, it, expect, vi } from 'vitest';
import { LabelsResource } from '../../resources/labels';
import { PaginatedList } from '../../pagination';
import type { HttpClient } from '../../http';

function makeHttp(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}): HttpClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as HttpClient;
}

function kyChain<T>(data: T) {
  return { json: vi.fn().mockResolvedValue(data) };
}

const baseLabel = {
  id: 'lbl_1',
  name: 'bug',
  color: '#ff0000',
  createdAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

describe('LabelsResource', () => {
  describe('list()', () => {
    it('GETs api/labels and returns a PaginatedList', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: [baseLabel], total: 1 })),
      });
      const resource = new LabelsResource(http);

      const result = await resource.list();

      expect(http.get).toHaveBeenCalledWith(
        'api/labels',
        expect.objectContaining({ searchParams: expect.any(URLSearchParams) })
      );
      expect(result).toBeInstanceOf(PaginatedList);
      expect(result.data).toEqual([baseLabel]);
      expect(result.total).toBe(1);
    });

    it('passes limit and offset as search params', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(kyChain({ data: [], total: 0 })),
      });
      const resource = new LabelsResource(http);

      await resource.list({ limit: 25, offset: 50 });

      const [, options] = (http.get as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        { searchParams: URLSearchParams },
      ];
      expect(options.searchParams.get('limit')).toBe('25');
      expect(options.searchParams.get('offset')).toBe('50');
    });
  });

  describe('iter()', () => {
    it('yields items from a single page', async () => {
      const http = makeHttp({
        get: vi.fn().mockReturnValue(
          kyChain({
            data: [
              { ...baseLabel, id: 'l1' },
              { ...baseLabel, id: 'l2' },
            ],
            total: 2,
          })
        ),
      });
      const resource = new LabelsResource(http);

      const ids: string[] = [];
      for await (const label of resource.iter()) {
        ids.push(label.id);
      }

      expect(ids).toEqual(['l1', 'l2']);
      expect(http.get).toHaveBeenCalledTimes(1);
    });

    it('auto-paginates across multiple pages', async () => {
      // Build 50 items for page 1 (fills the default pageSize) and 1 item for page 2
      const page1 = Array.from({ length: 50 }, (_, i) => ({ ...baseLabel, id: `l${i + 1}` }));
      const page2 = [{ ...baseLabel, id: 'l51' }];
      const http = makeHttp({
        get: vi
          .fn()
          .mockReturnValueOnce(kyChain({ data: page1, total: 51 }))
          .mockReturnValueOnce(kyChain({ data: page2, total: 51 })),
      });
      const resource = new LabelsResource(http);

      const ids: string[] = [];
      for await (const label of resource.iter()) {
        ids.push(label.id);
      }

      expect(ids).toHaveLength(51);
      expect(ids[0]).toBe('l1');
      expect(ids[50]).toBe('l51');
      expect(http.get).toHaveBeenCalledTimes(2);
    });
  });

  it('does NOT have an update() method', () => {
    const resource = new LabelsResource(makeHttp());
    expect('update' in resource).toBe(false);
  });

  it('does NOT have a get() method', () => {
    const resource = new LabelsResource(makeHttp());
    expect('get' in resource).toBe(false);
  });

  describe('create()', () => {
    it('POSTs to api/labels with JSON body and returns Label', async () => {
      const http = makeHttp({
        post: vi.fn().mockReturnValue(kyChain({ data: baseLabel })),
      });
      const resource = new LabelsResource(http);

      const result = await resource.create({ name: 'bug', color: '#ff0000' });

      expect(http.post).toHaveBeenCalledWith(
        'api/labels',
        expect.objectContaining({
          json: { name: 'bug', color: '#ff0000' },
        })
      );
      expect(result).toEqual(baseLabel);
    });

    it('forwards RequestOptions to ky', async () => {
      const http = makeHttp({
        post: vi.fn().mockReturnValue(kyChain({ data: baseLabel })),
      });
      const resource = new LabelsResource(http);

      await resource.create({ name: 'bug', color: '#ff0000' }, { idempotencyKey: 'label-key' });

      const [, opts] = (http.post as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const headers = opts.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('label-key');
    });
  });

  describe('delete()', () => {
    it('sends DELETE to api/labels/:id', async () => {
      const http = makeHttp({
        delete: vi.fn().mockResolvedValue(undefined),
      });
      const resource = new LabelsResource(http);

      await resource.delete('lbl_1');

      expect(http.delete).toHaveBeenCalledWith('api/labels/lbl_1', expect.any(Object));
    });

    it('forwards RequestOptions to delete', async () => {
      const http = makeHttp({
        delete: vi.fn().mockResolvedValue(undefined),
      });
      const resource = new LabelsResource(http);

      await resource.delete('lbl_1', { idempotencyKey: 'del-label' });

      const [, opts] = (http.delete as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        Record<string, unknown>,
      ];
      const headers = opts.headers as Record<string, string>;
      expect(headers['Idempotency-Key']).toBe('del-label');
    });
  });
});
