import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { projectsApi } from '@/lib/api-client'

/** Query options for the full projects list (used in issue filters). */
export const projectListOptions = () =>
  queryOptions({
    queryKey: queryKeys.projects.list(),
    queryFn: () => projectsApi.list(),
    staleTime: 300_000,
  })
