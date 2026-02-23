import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  Goal,
  CreateGoalParams,
  UpdateGoalParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/** Goals resource — CRUD operations for measurable success indicators. */
export class GoalsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List goals with optional pagination.
   *
   * @param params - Pagination params (limit, offset)
   */
  async list(params?: PaginationParams): Promise<PaginatedList<Goal>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/goals', { searchParams })
      .json<PaginatedResponse<Goal>>();
    return new PaginatedList(response.data, response.total);
  }

  /**
   * Auto-paginating async generator that yields individual goals.
   *
   * @example
   * ```typescript
   * for await (const goal of loop.goals.iter()) {
   *   console.log(goal.title)
   * }
   * ```
   */
  iter(): AsyncGenerator<Goal> {
    return paginate((p) => this.list(p), {});
  }

  /**
   * Get a single goal by ID.
   *
   * @param id - Goal CUID2 ID
   */
  async get(id: string): Promise<Goal> {
    const response = await this.http.get(`api/goals/${id}`).json<DataResponse<Goal>>();
    return response.data;
  }

  /**
   * Create a new goal.
   *
   * @param params - Goal data including title and optional metric/target fields
   * @param options - Per-request overrides
   */
  async create(params: CreateGoalParams, options?: RequestOptions): Promise<Goal> {
    const response = await this.http
      .post('api/goals', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Goal>>();
    return response.data;
  }

  /**
   * Update an existing goal.
   *
   * @param id - Goal CUID2 ID
   * @param params - Fields to update
   * @param options - Per-request overrides
   */
  async update(id: string, params: UpdateGoalParams, options?: RequestOptions): Promise<Goal> {
    const response = await this.http
      .patch(`api/goals/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Goal>>();
    return response.data;
  }

  /**
   * Soft-delete a goal.
   *
   * @param id - Goal CUID2 ID
   * @param options - Per-request overrides
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/goals/${id}`, toKyOptions(options));
  }
}
