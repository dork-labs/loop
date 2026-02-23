import { createLazyFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { dashboardActivityOptions } from '@/lib/queries/dashboard';
import { ActivityTimeline } from '@/components/activity-timeline';
import { ActivitySkeleton } from '@/components/activity-skeleton';
import { ErrorState } from '@/components/error-state';

export const Route = createLazyFileRoute('/_dashboard/activity/')({
  component: ActivityPage,
});

function ActivityPage() {
  const { data, isLoading, error } = useQuery(dashboardActivityOptions());

  if (isLoading) return <ActivitySkeleton />;

  if (error) {
    return (
      <ErrorState
        message={`Failed to load activity: ${error.message}`}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const chains = data?.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Loop Activity</h1>
      {chains.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border py-20 text-center">
          <Activity className="size-12 opacity-30" />
          <p className="text-lg">No activity yet</p>
          <p className="max-w-sm text-sm">
            Activity shows the flow of signals through the loop. Once your agent starts creating
            issues, you'll see the timeline here.
          </p>
        </div>
      ) : (
        <ActivityTimeline chains={chains} />
      )}
    </div>
  );
}
