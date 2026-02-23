import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  Issue,
  IssueDetail,
  CreateIssueParams,
  UpdateIssueParams,
  ListIssuesParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/**
 * Issues resource — CRUD operations on Loop's atomic unit of work.
 * Issues represent signals, hypotheses, plans, tasks, and monitors.
 */
export class IssuesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List issues with optional filters and pagination.
   *
   * @param params - Filter by status, type, projectId, labelId, priority, parentId; paginate with limit/offset
   */
  async list(params?: ListIssuesParams): Promise<PaginatedList<Issue>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/issues', { searchParams })
      .json<PaginatedResponse<Issue>>();
    return new PaginatedList(response.data, response.total);
  }

  /**
   * Auto-paginating async generator that yields individual issues.
   *
   * @param params - Filter params (limit/offset are managed automatically)
   *
   * @example
   * ```typescript
   * for await (const issue of loop.issues.iter({ status: 'todo' })) {
   *   console.log(issue.title)
   * }
   * ```
   */
  iter(params?: Omit<ListIssuesParams, 'limit' | 'offset'>): AsyncGenerator<Issue> {
    const baseParams: ListIssuesParams = { ...params };
    return paginate((p) => this.list({ ...baseParams, ...p }), baseParams);
  }

  /**
   * Get a single issue by ID with parent, children, labels, and relations.
   *
   * @param id - Issue CUID2 ID
   */
  async get(id: string): Promise<IssueDetail> {
    const response = await this.http.get(`api/issues/${id}`).json<DataResponse<IssueDetail>>();
    return response.data;
  }

  /**
   * Create a new issue.
   *
   * @param params - Issue data including title, type, and optional fields
   * @param options - Per-request overrides
   */
  async create(params: CreateIssueParams, options?: RequestOptions): Promise<Issue> {
    const response = await this.http
      .post('api/issues', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Issue>>();
    return response.data;
  }

  /**
   * Update an existing issue.
   *
   * @param id - Issue CUID2 ID
   * @param params - Fields to update
   * @param options - Per-request overrides
   */
  async update(id: string, params: UpdateIssueParams, options?: RequestOptions): Promise<Issue> {
    const response = await this.http
      .patch(`api/issues/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Issue>>();
    return response.data;
  }

  /**
   * Soft-delete an issue.
   *
   * @param id - Issue CUID2 ID
   * @param options - Per-request overrides
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/issues/${id}`, toKyOptions(options));
  }
}
