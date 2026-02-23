/**
 * Wrapper around paginated API responses.
 * Provides `hasMore` to check if additional pages exist.
 */
export class PaginatedList<T> {
  readonly data: T[];
  readonly total: number;

  constructor(data: T[], total: number) {
    this.data = data;
    this.total = total;
  }

  /** Whether more results exist beyond the current page. */
  get hasMore(): boolean {
    return this.data.length > 0 && this.data.length < this.total;
  }
}

/**
 * Creates an async generator that auto-paginates through all results.
 * Yields individual items, not pages.
 *
 * @param fetchPage - Function that fetches a single page of results
 * @param params - Base query parameters (limit/offset will be overridden)
 * @param pageSize - Number of items per page (default 50)
 *
 * @example
 * ```typescript
 * for await (const issue of loop.issues.iter({ status: 'todo' })) {
 *   console.log(issue.title)
 * }
 * ```
 */
export async function* paginate<T, P extends { limit?: number; offset?: number }>(
  fetchPage: (params: P) => Promise<PaginatedList<T>>,
  params: P,
  pageSize: number = 50
): AsyncGenerator<T, void, undefined> {
  let offset = params.offset ?? 0;

  while (true) {
    const page = await fetchPage({ ...params, limit: pageSize, offset });

    for (const item of page.data) {
      yield item;
    }

    offset += page.data.length;

    if (offset >= page.total || page.data.length === 0) {
      break;
    }
  }
}
