import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { dashboardActivityOptions } from '@/lib/queries/dashboard'
import { ActivityTimeline } from '@/components/activity-timeline'
import { ActivitySkeleton } from '@/components/activity-skeleton'

export const Route = createLazyFileRoute('/_dashboard/activity/')({
  component: ActivityPage,
})

function ActivityPage() {
  const { data, isLoading, error } = useQuery(dashboardActivityOptions())

  if (isLoading) return <ActivitySkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Failed to load activity: {error.message}</p>
      </div>
    )
  }

  const chains = data?.data ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Loop Activity</h1>
      {chains.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <p className="text-lg">No activity yet</p>
          <p className="text-sm">The loop is waiting for signals</p>
        </div>
      ) : (
        <ActivityTimeline chains={chains} />
      )}
    </div>
  )
}
