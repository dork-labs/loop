import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  Project,
  ProjectDetail,
  CreateProjectParams,
  UpdateProjectParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/** Projects resource — CRUD operations for project containers. */
export class ProjectsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List projects with optional pagination.
   *
   * @param params - Pagination params (limit, offset)
   */
  async list(params?: PaginationParams): Promise<PaginatedList<Project>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/projects', { searchParams })
      .json<PaginatedResponse<Project>>();
    return new PaginatedList(response.data, response.total);
  }

  /**
   * Auto-paginating async generator that yields individual projects.
   *
   * @example
   * ```typescript
   * for await (const project of loop.projects.iter()) {
   *   console.log(project.name)
   * }
   * ```
   */
  iter(): AsyncGenerator<Project> {
    return paginate((p) => this.list(p), {});
  }

  /**
   * Get a single project by ID with goal and issue counts.
   *
   * @param id - Project CUID2 ID
   */
  async get(id: string): Promise<ProjectDetail> {
    const response = await this.http.get(`api/projects/${id}`).json<DataResponse<ProjectDetail>>();
    return response.data;
  }

  /**
   * Create a new project.
   *
   * @param params - Project data including name and optional fields
   * @param options - Per-request overrides
   */
  async create(params: CreateProjectParams, options?: RequestOptions): Promise<Project> {
    const response = await this.http
      .post('api/projects', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Project>>();
    return response.data;
  }

  /**
   * Update an existing project.
   *
   * @param id - Project CUID2 ID
   * @param params - Fields to update
   * @param options - Per-request overrides
   */
  async update(
    id: string,
    params: UpdateProjectParams,
    options?: RequestOptions
  ): Promise<Project> {
    const response = await this.http
      .patch(`api/projects/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Project>>();
    return response.data;
  }

  /**
   * Soft-delete a project.
   *
   * @param id - Project CUID2 ID
   * @param options - Per-request overrides
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/projects/${id}`, toKyOptions(options));
  }
}
