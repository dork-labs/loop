import { queryOptions } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { templatesApi } from '@/lib/api-client'

/** Query options for the prompt templates list. */
export const templateListOptions = () =>
  queryOptions({
    queryKey: queryKeys.templates.list(),
    queryFn: () => templatesApi.list(),
    staleTime: 300_000,
  })

/** Query options for a single prompt template by ID, unwraps the data envelope. */
export const templateDetailOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.templates.detail(id),
    queryFn: () => templatesApi.get(id).then((r) => r.data),
    staleTime: 300_000,
  })
