import type { HttpClient } from '../http';
import { toSearchParams } from '../http';
import { PaginatedList } from '../pagination';
import type {
  DispatchNextParams,
  DispatchQueueParams,
  DataResponse,
  PaginatedResponse,
  DispatchNextResponse,
  DispatchQueueItem,
} from '@dork-labs/loop-types';

/**
 * Dispatch resource — Loop's core agent feedback loop.
 * Claim work from the priority queue with hydrated prompt instructions.
 */
export class DispatchResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Atomically claim the highest-priority unblocked issue.
   * Returns the issue with hydrated prompt instructions, or null if queue is empty.
   *
   * @param params - Optional filter by projectId
   *
   * @example
   * ```typescript
   * const task = await loop.dispatch.next()
   * if (task) {
   *   console.log(task.issue.title)
   *   console.log(task.prompt)
   * }
   * ```
   */
  async next(params?: DispatchNextParams): Promise<DispatchNextResponse | null> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http.get('api/dispatch/next', { searchParams });

    if (response.status === 204) {
      return null;
    }

    const body = await response.json<DataResponse<DispatchNextResponse>>();
    return body.data;
  }

  /**
   * Preview the priority queue without claiming any issues.
   *
   * @param params - Optional filter and pagination
   */
  async queue(params?: DispatchQueueParams): Promise<PaginatedList<DispatchQueueItem>> {
    const searchParams = toSearchParams(params as Record<string, unknown>);
    const response = await this.http
      .get('api/dispatch/queue', { searchParams })
      .json<PaginatedResponse<DispatchQueueItem>>();
    return new PaginatedList(response.data, response.total);
  }
}
