import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList } from '../pagination';
import type {
  PromptReview,
  CreateReviewParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/**
 * Reviews resource — agent and human quality feedback on prompt versions.
 * Review scores drive prompt health metrics and trigger improvement issues.
 */
export class ReviewsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a prompt review with clarity, completeness, and relevance scores.
   *
   * @param params - Review scores (1-5 each) and optional feedback text
   * @param options - Per-request overrides
   */
  async create(params: CreateReviewParams, options?: RequestOptions): Promise<PromptReview> {
    const response = await this.http
      .post('api/prompt-reviews', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptReview>>();
    return response.data;
  }

  /**
   * List reviews for a template across all versions.
   *
   * @param templateId - Template ID
   * @param params - Pagination params
   */
  async list(templateId: string, params?: PaginationParams): Promise<PaginatedList<PromptReview>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get(`api/templates/${templateId}/reviews`, { searchParams })
      .json<PaginatedResponse<PromptReview>>();
    return new PaginatedList(response.data, response.total);
  }
}
