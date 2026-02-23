import type { HttpClient, RequestOptions } from '../http';
import { toKyOptions } from '../http';
import type { IssueRelation, CreateRelationParams, DataResponse } from '@dork-labs/loop-types';

/**
 * Relations resource — manage blocking/related dependencies between issues.
 * Relations can be created on a source issue and deleted by relation ID.
 */
export class RelationsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a relation between two issues.
   *
   * @param issueId - Source issue ID
   * @param params - Relation type and target issue ID
   * @param options - Per-request overrides
   */
  async create(
    issueId: string,
    params: CreateRelationParams,
    options?: RequestOptions
  ): Promise<IssueRelation> {
    const response = await this.http
      .post(`api/issues/${issueId}/relations`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<IssueRelation>>();
    return response.data;
  }

  /**
   * Hard-delete a relation by its ID.
   *
   * @param id - Relation ID
   * @param options - Per-request overrides
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/relations/${id}`, toKyOptions(options));
  }
}
