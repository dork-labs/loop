import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { issueListOptions } from '@/lib/queries/issues'
import { IssueDataTable } from '@/components/issue-table/data-table'
import { IssueFilters } from '@/components/issue-table/filters'

export const Route = createLazyFileRoute('/_dashboard/issues/')({
  component: IssueListPage,
})

function IssueListPage() {
  const search = Route.useSearch()

  const filters = useMemo(() => {
    const params: Record<string, string> = {}
    if (search.status) params.status = search.status
    if (search.type) params.type = search.type
    if (search.projectId) params.projectId = search.projectId
    if (search.labelId) params.labelId = search.labelId
    if (search.priority !== undefined) params.priority = String(search.priority)
    params.page = String(search.page)
    params.limit = String(search.limit)
    return params
  }, [search])

  const { data, isFetching, error } = useQuery(issueListOptions(filters))

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Failed to load issues: {error.message}</p>
        <button onClick={() => window.location.reload()} className="text-sm underline">
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Issues</h1>
      <IssueFilters />
      <IssueDataTable
        data={data?.data ?? []}
        total={data?.total ?? 0}
        page={search.page}
        limit={search.limit}
        isLoading={isFetching && !data}
      />
    </div>
  )
}
