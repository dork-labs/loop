import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { labelsApi } from '@/lib/api-client'

/** Query options for the labels list (long-lived cache, used in issue filters). */
export const labelListOptions = () =>
  queryOptions({
    queryKey: queryKeys.labels.list(),
    queryFn: () => labelsApi.list(),
    staleTime: 600_000,
  })
