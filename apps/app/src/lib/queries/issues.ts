import { queryOptions } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { issuesApi } from '@/lib/api-client';

/** Query options for the paginated/filtered issues list. */
export const issueListOptions = (
  filters: Record<string, string>,
  options?: { polling?: boolean }
) =>
  queryOptions({
    queryKey: queryKeys.issues.list(filters),
    queryFn: () => issuesApi.list(filters),
    staleTime: 30_000,
    refetchInterval: options?.polling
      ? (query) => {
          const hasData = (query.state.data?.data?.length ?? 0) > 0;
          return hasData ? false : 3000;
        }
      : undefined,
  });

/** Query options for a single issue by ID, unwraps the data envelope. */
export const issueDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.issues.detail(id),
    queryFn: () => issuesApi.get(id).then((r) => r.data),
    staleTime: 30_000,
  });
