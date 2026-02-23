import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  PromptTemplate,
  PromptVersion,
  TemplateDetail,
  TemplatePreview,
  CreateTemplateParams,
  UpdateTemplateParams,
  CreateVersionParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/**
 * Templates resource — manage versioned prompt templates with conditions-based matching.
 * Templates are selected by the dispatch engine based on specificity and matching conditions.
 */
export class TemplatesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List prompt templates with optional pagination.
   *
   * @param params - Pagination params
   */
  async list(params?: PaginationParams): Promise<PaginatedList<PromptTemplate>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/templates', { searchParams })
      .json<PaginatedResponse<PromptTemplate>>();
    return new PaginatedList(response.data, response.total);
  }

  /**
   * Auto-paginating async generator that yields individual prompt templates.
   *
   * @example
   * ```typescript
   * for await (const template of loop.templates.iter()) {
   *   console.log(template.slug)
   * }
   * ```
   */
  iter(params?: Record<string, never>): AsyncGenerator<PromptTemplate> {
    return paginate((p) => this.list(p), params ?? {});
  }

  /**
   * Get a single template by ID with its active version.
   *
   * @param id - Template ID
   */
  async get(id: string): Promise<TemplateDetail> {
    const response = await this.http
      .get(`api/templates/${id}`)
      .json<DataResponse<TemplateDetail>>();
    return response.data;
  }

  /**
   * Create a new prompt template.
   *
   * @param params - Template slug, name, conditions, and optional metadata
   * @param options - Per-request overrides
   */
  async create(params: CreateTemplateParams, options?: RequestOptions): Promise<PromptTemplate> {
    const response = await this.http
      .post('api/templates', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptTemplate>>();
    return response.data;
  }

  /**
   * Update an existing template.
   *
   * @param id - Template ID
   * @param params - Fields to update
   * @param options - Per-request overrides
   */
  async update(
    id: string,
    params: UpdateTemplateParams,
    options?: RequestOptions
  ): Promise<PromptTemplate> {
    const response = await this.http
      .patch(`api/templates/${id}`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptTemplate>>();
    return response.data;
  }

  /**
   * Soft-delete a template.
   *
   * @param id - Template ID
   * @param options - Per-request overrides
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/templates/${id}`, toKyOptions(options));
  }

  /**
   * Preview which template and prompt would be selected for an issue.
   * Useful for debugging conditions-based matching without dispatching.
   *
   * @param issueId - Issue ID to preview dispatch for
   */
  async preview(issueId: string): Promise<TemplatePreview> {
    const response = await this.http
      .get(`api/templates/preview/${issueId}`)
      .json<DataResponse<TemplatePreview>>();
    return response.data;
  }

  /**
   * List versions for a template.
   *
   * @param id - Template ID
   * @param params - Pagination params
   */
  async versions(id: string, params?: PaginationParams): Promise<PaginatedList<PromptVersion>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get(`api/templates/${id}/versions`, { searchParams })
      .json<PaginatedResponse<PromptVersion>>();
    return new PaginatedList(response.data, response.total);
  }

  /**
   * Create a new version for a template.
   *
   * @param id - Template ID
   * @param params - Version content, changelog, and author info
   * @param options - Per-request overrides
   */
  async createVersion(
    id: string,
    params: CreateVersionParams,
    options?: RequestOptions
  ): Promise<PromptVersion> {
    const response = await this.http
      .post(`api/templates/${id}/versions`, {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptVersion>>();
    return response.data;
  }

  /**
   * Promote a version to active status on its template.
   *
   * @param id - Template ID
   * @param versionId - Version ID to promote
   * @param options - Per-request overrides
   */
  async promote(id: string, versionId: string, options?: RequestOptions): Promise<PromptVersion> {
    const response = await this.http
      .post(`api/templates/${id}/versions/${versionId}/promote`, {
        ...toKyOptions(options),
      })
      .json<DataResponse<PromptVersion>>();
    return response.data;
  }
}
