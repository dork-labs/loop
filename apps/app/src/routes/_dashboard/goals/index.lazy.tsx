import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Target } from 'lucide-react'
import { goalListOptions } from '@/lib/queries/goals'
import { GoalCard, GoalCardSkeleton } from '@/components/goal-card'
import { ErrorState } from '@/components/error-state'

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
      <ErrorState
        message={`Failed to load goals: ${error.message}`}
        onRetry={() => window.location.reload()}
      />
    )
  }

  const goals = data?.data ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Goals</h1>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-20 text-center text-muted-foreground">
          <Target className="size-12 opacity-30" />
          <p className="text-lg">No goals defined yet</p>
          <p className="max-w-sm text-sm">Goals track measurable outcomes for your projects. Create a project with a goal to see progress here.</p>
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
