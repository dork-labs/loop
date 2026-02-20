import { createLazyFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { dashboardPromptsOptions } from '@/lib/queries/dashboard'
import { PromptCard, PromptCardSkeleton } from '@/components/prompt-card'

export const Route = createLazyFileRoute('/_dashboard/prompts/')({
  component: PromptsPage,
})

/** Skeleton grid rendered while prompt health data is loading. */
function PromptsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PromptCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function PromptsPage() {
  const { data, isLoading, error } = useQuery(dashboardPromptsOptions())

  if (isLoading) return <PromptsSkeleton />

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">
          Failed to load prompts: {error.message}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prompt Health</h1>
      {!data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
          <p className="text-lg">No prompt templates yet</p>
          <p className="text-sm">
            Templates are created when the dispatch engine first runs
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((item) => (
            <PromptCard key={item.template.id} data={item} />
          ))}
        </div>
      )}
    </div>
  )
}
