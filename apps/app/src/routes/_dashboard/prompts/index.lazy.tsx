import { createLazyFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { dashboardPromptsOptions } from '@/lib/queries/dashboard';
import { PromptCard, PromptCardSkeleton } from '@/components/prompt-card';
import { ErrorState } from '@/components/error-state';

export const Route = createLazyFileRoute('/_dashboard/prompts/')({
  component: PromptsPage,
});

/** Skeleton grid rendered while prompt health data is loading. */
function PromptsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-secondary h-8 w-48 animate-pulse rounded" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <PromptCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function PromptsPage() {
  const { data, isLoading, error } = useQuery(dashboardPromptsOptions());

  if (isLoading) return <PromptsSkeleton />;

  if (error) {
    return (
      <ErrorState
        message={`Failed to load prompts: ${error.message}`}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prompt Health</h1>
      {!data || data.length === 0 ? (
        <div className="border-border bg-card text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border py-20 text-center">
          <Sparkles className="size-12 opacity-30" />
          <p className="text-lg">No prompt templates yet</p>
          <p className="max-w-sm text-sm">
            Prompt templates tell your AI agent what to do. They&apos;re created when the dispatch
            engine runs for the first time.
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
  );
}
