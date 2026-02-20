import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { goalListOptions } from '@/lib/queries/goals'
import { GoalCard, GoalCardSkeleton } from '@/components/goal-card'

export const Route = createLazyFileRoute('/_dashboard/goals/')({
  component: GoalsPage,
})

/** Skeleton grid matching the 2-column goals layout. */
function GoalsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <GoalCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function GoalsPage() {
  const { data, isLoading, error } = useQuery(goalListOptions())

  if (isLoading) return <GoalsSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Failed to load goals: {error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm underline"
        >
          Retry
        </button>
      </div>
    )
  }

  const goals = data?.data ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Goals</h1>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <p className="text-lg">No goals defined yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  )
}
