import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { dashboardApi } from '@/lib/api-client'

/** Query options for dashboard system health stats. Refreshes every 30 seconds. */
export const dashboardStatsOptions = () =>
  queryOptions({
    queryKey: queryKeys.dashboard.stats,
    queryFn: () => dashboardApi.stats().then((r) => r.data),
    staleTime: 30_000,
  })

/**
 * Query options for the Loop Activity timeline.
 * Polls every 15 seconds to surface newly completed chains.
 */
export const dashboardActivityOptions = () =>
  queryOptions({
    queryKey: queryKeys.dashboard.activity,
    queryFn: () => dashboardApi.activity(),
    staleTime: 30_000,
    refetchInterval: 15_000,
  })

/** Query options for prompt template health data. */
export const dashboardPromptsOptions = () =>
  queryOptions({
    queryKey: queryKeys.dashboard.prompts,
    queryFn: () => dashboardApi.prompts().then((r) => r.data),
    staleTime: 300_000,
  })
