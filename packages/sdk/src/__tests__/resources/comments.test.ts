import { describe, it, expect, vi } from 'vitest';
import { CommentsResource } from '../../resources/comments';
import type { Comment, CreateCommentParams } from '@dork-labs/loop-types';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'cmt_1',
    body: 'Test comment',
    issueId: 'issue_1',
    authorName: 'agent-1',
    authorType: 'agent',
    parentId: null,
    createdAt: '2026-02-23T00:00:00Z',
    ...overrides,
  };
}

function makeHttp(overrides: Record<string, unknown> = {}) {
  const jsonFn = vi.fn();
  const getChain = { json: jsonFn };
  const postChain = { json: jsonFn };
  return {
    http: {
      get: vi.fn().mockReturnValue(getChain),
      post: vi.fn().mockReturnValue(postChain),
      ...overrides,
    },
    jsonFn,
  };
}

describe('CommentsResource', () => {
  describe('list(issueId)', () => {
    it('GETs api/issues/:issueId/comments', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [makeComment()] });
      const resource = new CommentsResource(http as never);

      const result = await resource.list('issue_1');

      expect(http.get).toHaveBeenCalledWith('api/issues/issue_1/comments');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cmt_1');
    });

    it('returns an array of Comment objects', async () => {
      const { http, jsonFn } = makeHttp();
      const comments = [makeComment({ id: 'cmt_1' }), makeComment({ id: 'cmt_2' })];
      jsonFn.mockResolvedValue({ data: comments });
      const resource = new CommentsResource(http as never);

      const result = await resource.list('issue_abc');

      expect(result).toEqual(comments);
    });

    it('returns empty array when no comments exist', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [] });
      const resource = new CommentsResource(http as never);

      const result = await resource.list('issue_1');

      expect(result).toEqual([]);
    });

    it('uses the issueId in the URL', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [] });
      const resource = new CommentsResource(http as never);

      await resource.list('issue_xyz');

      expect(http.get).toHaveBeenCalledWith('api/issues/issue_xyz/comments');
    });
  });

  describe('create(issueId, params)', () => {
    it('POSTs to api/issues/:issueId/comments', async () => {
      const { http, jsonFn } = makeHttp();
      const comment = makeComment();
      jsonFn.mockResolvedValue({ data: comment });
      const resource = new CommentsResource(http as never);

      const params: CreateCommentParams = {
        body: 'Test comment',
        authorName: 'agent-1',
        authorType: 'agent',
      };
      const result = await resource.create('issue_1', params);

      expect(http.post).toHaveBeenCalledWith(
        'api/issues/issue_1/comments',
        expect.objectContaining({ json: params })
      );
      expect(result).toEqual(comment);
    });

    it('supports threaded comments via parentId', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeComment({ parentId: 'cmt_parent' }) });
      const resource = new CommentsResource(http as never);

      const params: CreateCommentParams = {
        body: 'Reply comment',
        authorName: 'human',
        authorType: 'human',
        parentId: 'cmt_parent',
      };
      await resource.create('issue_1', params);

      expect(http.post).toHaveBeenCalledWith(
        'api/issues/issue_1/comments',
        expect.objectContaining({ json: params })
      );
    });

    it('passes idempotencyKey from options to request headers', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeComment() });
      const resource = new CommentsResource(http as never);

      const params: CreateCommentParams = {
        body: 'Test',
        authorName: 'agent',
        authorType: 'agent',
      };
      await resource.create('issue_1', params, { idempotencyKey: 'my-key' });

      expect(http.post).toHaveBeenCalledWith(
        'api/issues/issue_1/comments',
        expect.objectContaining({
          headers: { 'Idempotency-Key': 'my-key' },
        })
      );
    });

    it('unwraps the data envelope', async () => {
      const { http, jsonFn } = makeHttp();
      const comment = makeComment({ body: 'Unwrapped correctly' });
      jsonFn.mockResolvedValue({ data: comment });
      const resource = new CommentsResource(http as never);

      const result = await resource.create('issue_1', {
        body: 'Unwrapped correctly',
        authorName: 'agent',
        authorType: 'agent',
      });

      expect(result.body).toBe('Unwrapped correctly');
      expect(result).not.toHaveProperty('data');
    });
  });
});
