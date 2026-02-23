import { describe, it, expect, vi } from 'vitest';
import { ReviewsResource } from '../../resources/reviews';
import { PaginatedList } from '../../pagination';
import type { PromptReview, CreateReviewParams } from '@dork-labs/loop-types';

function makeReview(overrides: Partial<PromptReview> = {}): PromptReview {
  return {
    id: 'rev_1',
    versionId: 'ver_1',
    issueId: 'issue_1',
    clarity: 4,
    completeness: 5,
    relevance: 4,
    feedback: null,
    authorType: 'agent',
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
    },
    jsonFn,
  };
}

describe('ReviewsResource', () => {
  describe('create(params)', () => {
    it('POSTs to api/prompt-reviews', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeReview() });
      const resource = new ReviewsResource(http as never);

      const params: CreateReviewParams = {
        versionId: 'ver_1',
        issueId: 'issue_1',
        clarity: 4,
        completeness: 5,
        relevance: 4,
        authorType: 'agent',
      };
      await resource.create(params);

      expect(http.post).toHaveBeenCalledWith(
        'api/prompt-reviews',
        expect.objectContaining({ json: params })
      );
    });

    it('returns the created PromptReview', async () => {
      const { http, jsonFn } = makeHttp();
      const review = makeReview({ clarity: 5, completeness: 5, relevance: 5 });
      jsonFn.mockResolvedValue({ data: review });
      const resource = new ReviewsResource(http as never);

      const result = await resource.create({
        versionId: 'ver_1',
        issueId: 'issue_1',
        clarity: 5,
        completeness: 5,
        relevance: 5,
        authorType: 'agent',
      });

      expect(result.clarity).toBe(5);
      expect(result.completeness).toBe(5);
      expect(result.relevance).toBe(5);
    });

    it('supports optional feedback text', async () => {
      const { http, jsonFn } = makeHttp();
      const review = makeReview({ feedback: 'Great instructions!' });
      jsonFn.mockResolvedValue({ data: review });
      const resource = new ReviewsResource(http as never);

      const params: CreateReviewParams = {
        versionId: 'ver_1',
        issueId: 'issue_1',
        clarity: 4,
        completeness: 4,
        relevance: 4,
        feedback: 'Great instructions!',
        authorType: 'agent',
      };
      const result = await resource.create(params);

      expect(result.feedback).toBe('Great instructions!');
    });

    it('passes idempotencyKey from options', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: makeReview() });
      const resource = new ReviewsResource(http as never);

      await resource.create(
        {
          versionId: 'ver_1',
          issueId: 'issue_1',
          clarity: 4,
          completeness: 4,
          relevance: 4,
          authorType: 'agent',
        },
        { idempotencyKey: 'review-key-1' }
      );

      expect(http.post).toHaveBeenCalledWith(
        'api/prompt-reviews',
        expect.objectContaining({ headers: { 'Idempotency-Key': 'review-key-1' } })
      );
    });

    it('unwraps the data envelope', async () => {
      const { http, jsonFn } = makeHttp();
      const review = makeReview({ id: 'rev_unwrapped' });
      jsonFn.mockResolvedValue({ data: review });
      const resource = new ReviewsResource(http as never);

      const result = await resource.create({
        versionId: 'ver_1',
        issueId: 'issue_1',
        clarity: 3,
        completeness: 3,
        relevance: 3,
        authorType: 'human',
      });

      expect(result.id).toBe('rev_unwrapped');
      expect(result).not.toHaveProperty('data');
    });
  });

  describe('list(templateId, params?)', () => {
    it('GETs api/templates/:templateId/reviews', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [makeReview()], total: 1 });
      const resource = new ReviewsResource(http as never);

      const result = await resource.list('tpl_1');

      expect(http.get).toHaveBeenCalledWith('api/templates/tpl_1/reviews', expect.any(Object));
      expect(result).toBeInstanceOf(PaginatedList);
      expect(result.total).toBe(1);
    });

    it('returns PaginatedList<PromptReview>', async () => {
      const { http, jsonFn } = makeHttp();
      const reviews = [makeReview({ id: 'rev_1' }), makeReview({ id: 'rev_2' })];
      jsonFn.mockResolvedValue({ data: reviews, total: 2 });
      const resource = new ReviewsResource(http as never);

      const result = await resource.list('tpl_1');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe('rev_1');
      expect(result.data[1].id).toBe('rev_2');
    });

    it('passes pagination params as search params', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [], total: 0 });
      const resource = new ReviewsResource(http as never);

      await resource.list('tpl_1', { limit: 10, offset: 5 });

      const callArg = http.get.mock.calls[0][1] as { searchParams: URLSearchParams };
      expect(callArg.searchParams.get('limit')).toBe('10');
      expect(callArg.searchParams.get('offset')).toBe('5');
    });

    it('uses the correct templateId in URL', async () => {
      const { http, jsonFn } = makeHttp();
      jsonFn.mockResolvedValue({ data: [], total: 0 });
      const resource = new ReviewsResource(http as never);

      await resource.list('tpl_xyz');

      expect(http.get).toHaveBeenCalledWith('api/templates/tpl_xyz/reviews', expect.any(Object));
    });
  });
});
