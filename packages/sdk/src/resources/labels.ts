import type { HttpClient, RequestOptions } from '../http';
import { toSearchParams, toKyOptions } from '../http';
import { PaginatedList, paginate } from '../pagination';
import type {
  Label,
  CreateLabelParams,
  PaginationParams,
  DataResponse,
  PaginatedResponse,
} from '@dork-labs/loop-types';

/** Labels resource — manage issue labels (no update, only create/delete). */
export class LabelsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List labels with optional pagination.
   *
   * @param params - Pagination params (limit, offset)
   */
  async list(params?: PaginationParams): Promise<PaginatedList<Label>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/labels', { searchParams })
      .json<PaginatedResponse<Label>>();
    return new PaginatedList(response.data, response.total);
  }

  /**
   * Auto-paginating async generator that yields individual labels.
   *
   * @example
   * ```typescript
   * for await (const label of loop.labels.iter()) {
   *   console.log(label.name)
   * }
   * ```
   */
  iter(): AsyncGenerator<Label> {
    return paginate((p) => this.list(p), {});
  }

  /**
   * Create a new label.
   *
   * @param params - Label name and color
   * @param options - Per-request overrides
   */
  async create(params: CreateLabelParams, options?: RequestOptions): Promise<Label> {
    const response = await this.http
      .post('api/labels', {
        json: params,
        ...toKyOptions(options),
      })
      .json<DataResponse<Label>>();
    return response.data;
  }

  /**
   * Soft-delete a label.
   *
   * @param id - Label CUID2 ID
   * @param options - Per-request overrides
   */
  async delete(id: string, options?: RequestOptions): Promise<void> {
    await this.http.delete(`api/labels/${id}`, toKyOptions(options));
  }
}
