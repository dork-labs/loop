import { Skeleton } from '@/components/ui/skeleton'

/** Skeleton loading state for the Loop Activity timeline. */
export function ActivitySkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded" />
        ))}
      </div>
    </div>
  )
}
