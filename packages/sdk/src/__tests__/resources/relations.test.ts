import { describe, it, expect, vi } from 'vitest';
import { RelationsResource } from '../../resources/relations';
import type { IssueRelation, CreateRelationParams } from '@dork-labs/loop-types';

function makeRelation(overrides: Partial<IssueRelation> = {}): IssueRelation {
  return {
    id: 'rel_1',
    type: 'blocks',
    issueId: 'issue_1',
    relatedIssueId: 'issue_2',
    createdAt: '2026-02-23T00:00:00Z',
    ...overrides,
  };
}

function makeHttp(overrides: Record<string, unknown> = {}) {
  const jsonFn = vi.fn();
  const postChain = { json: jsonFn };
  return {
    http: {
      post: vi.fn().mockReturnValue(postChain),
      delete: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
    jsonFn,
  };
}

describe('RelationsResource', () => {
  describe('create(issueId, params)', () => {
    it('POSTs to api/issues/:issueId/relations', async () => {
      const { http, jsonFn } = makeHttp();
      const relation = makeRelation();
      jsonFn.mockResolvedValue({ data: relation });
      const resource = new RelationsResource(http as never);

      const params: CreateRelationParams = {
        type: 'blocks',
        relatedIssueId: 'issue_2',
      };
      const result = await resource.create('issue_1', params);

      expect(http.post).toHaveBeenCalledWith(
        'api/issues/issue_1/relations',
        expect.objectContaining({ json: params })
      );
      expect(result).toEqual(relation);
    });

    it('supports all relation types', async () => {
      const { http, jsonFn } = makeHttp();
      const relationTypes: Array<IssueRelation['type']> = [
        'blocks',
        'blocked_by',
        'related',
        'duplicate',
      ];

      for (const type of relationTypes) {
        jsonFn.mockResolvedValue({ data: makeRelation({ type }) });
        const resource = new RelationsResource(http as never);

        const result = await resource.create('issue_1', { type, relatedIssueId: 'issue_2' });

        expect(result.type).toBe(type);
      }
    });

    it('unwraps the data envelope', async () => {
      const { http, jsonFn } = makeHttp();
      const relation = makeRelation({ id: 'rel_unwrapped' });
      jsonFn.mockResolvedValue({ data: relation });
      const resource = new RelationsResource(http as never);

      const result = await resource.create('issue_1', {
        type: 'related',
        relatedIssueId: 'issue_2',
      });

      expect(result.id).toBe('rel_unwrapped');
      expect(result).not.toHaveProperty('data');
    });

    it('passes idempotencyKey from options', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeRelation() });
      const resource = new RelationsResource(http as never);

      await resource.create(
        'issue_1',
        { type: 'blocks', relatedIssueId: 'issue_2' },
        { idempotencyKey: 'key-123' }
      );

      expect(http.post).toHaveBeenCalledWith(
        'api/issues/issue_1/relations',
        expect.objectContaining({
          headers: { 'Idempotency-Key': 'key-123' },
        })
      );
    });
  });

  describe('delete(id)', () => {
    it('sends DELETE to api/relations/:id', async () => {
      const { http } = makeHttp();
      const resource = new RelationsResource(http as never);

      await resource.delete('rel_1');

      expect(http.delete).toHaveBeenCalledWith('api/relations/rel_1', expect.any(Object));
    });

    it('returns void on success', async () => {
      const { http } = makeHttp();
      const resource = new RelationsResource(http as never);

      const result = await resource.delete('rel_1');

      expect(result).toBeUndefined();
    });

    it('uses the correct relation ID in the URL', async () => {
      const { http } = makeHttp();
      const resource = new RelationsResource(http as never);

      await resource.delete('rel_xyz');

      expect(http.delete).toHaveBeenCalledWith('api/relations/rel_xyz', expect.any(Object));
    });
  });
});
