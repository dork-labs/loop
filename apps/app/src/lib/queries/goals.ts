import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { goalsApi } from '@/lib/api-client'

/** Query options for the goals list used in the Goals Dashboard view. */
export const goalListOptions = () =>
  queryOptions({
    queryKey: queryKeys.goals.list(),
    queryFn: () => goalsApi.list(),
    staleTime: 300_000,
  })
