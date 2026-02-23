import type { HttpClient, RequestOptions } from '../http';
import { toKyOptions } from '../http';
import type { Comment, CreateCommentParams, DataResponse } from '@dork-labs/loop-types';

/**
 * Comments resource — issue sub-resource for threaded discussion.
 * Comments belong to issues and can be nested via parentId.
 */
export class CommentsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List comments for an issue (threaded).
   *
   * @param issueId - Parent issue ID
   */
  async list(issueId: string): Promise<Comment[]> {
    const response = await this.http
      .get(`api/issues/${issueId}/comments`)
      .json<{ data: Comment[] }>();
    return response.data;
  }

  /**
   * Add a comment to an issue.
   *
   * @param issueId - Parent issue ID
   * @param params - Comment body, author, and optional parent for threading
   * @param options - Per-request overrides
   */
  async create(
    issueId: string,
    params: CreateCommentParams,
    options?: RequestOptions
  ): Promise<Comment> {
    const response = await this.http
      .post(`api/issues/${issueId}/comments`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Comment>>();
    return response.data;
  }
}
