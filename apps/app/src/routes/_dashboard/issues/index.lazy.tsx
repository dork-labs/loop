import { createLazyFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Inbox } from 'lucide-react';
import { issueListOptions } from '@/lib/queries/issues';
import { IssueDataTable } from '@/components/issue-table/data-table';
import { IssueFilters } from '@/components/issue-table/filters';
import { ErrorState } from '@/components/error-state';
import { WelcomeModal } from '@/components/welcome-modal';
import { SetupChecklist } from '@/components/setup-checklist';
import { useOnboarding } from '@/hooks/use-onboarding';
import { useAgentDetection } from '@/hooks/use-agent-detection';

export const Route = createLazyFileRoute('/_dashboard/issues/')({
  component: IssueListPage,
});

function IssueListPage() {
  const search = Route.useSearch();

  const filters = useMemo(() => {
    const params: Record<string, string> = {};
    if (search.status) params.status = search.status;
    if (search.type) params.type = search.type;
    if (search.projectId) params.projectId = search.projectId;
    if (search.labelId) params.labelId = search.labelId;
    if (search.priority !== undefined) params.priority = String(search.priority);
    params.page = String(search.page);
    params.limit = String(search.limit);
    return params;
  }, [search]);

  // Read localStorage synchronously to decide polling before the query runs.
  // This breaks the circular dependency: useOnboarding needs issueCount from
  // the query, but the query needs the polling flag from onboarding state.
  const onboardingState = useMemo(() => {
    try {
      const raw = localStorage.getItem('loop:onboarding');
      if (!raw) return { welcomed: false, completedAt: null };
      return JSON.parse(raw) as { welcomed: boolean; completedAt: string | null };
    } catch {
      return { welcomed: false, completedAt: null };
    }
  }, []);

  const shouldPoll = !onboardingState.completedAt;

  const { data, isFetching, error } = useQuery(issueListOptions(filters, { polling: shouldPoll }));

  const issueCount = data?.data?.length ?? 0;
  const { state, isOnboarding, markWelcomed, markComplete } = useOnboarding(issueCount);
  const agentSource = useAgentDetection();

  if (error) {
    return (
      <ErrorState
        message={`Failed to load issues: ${error.message}`}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const firstIssueId = data?.data?.[0]?.id;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Issues</h1>

      <WelcomeModal open={!state.welcomed && issueCount === 0} onClose={markWelcomed} />

      {isOnboarding ? (
        <SetupChecklist
          onComplete={markComplete}
          issueCount={issueCount}
          firstIssueId={firstIssueId}
          agentSource={agentSource}
        />
      ) : issueCount === 0 && !isFetching ? (
        <div className="border-border bg-card flex flex-col items-center justify-center gap-4 rounded-lg border py-20 text-center">
          <div className="bg-muted flex size-16 items-center justify-center rounded-full">
            <Inbox className="text-muted-foreground size-8" />
          </div>
          <h2 className="text-xl font-semibold">No issues yet</h2>
          <p className="text-muted-foreground max-w-sm text-sm">
            Issues will appear here as signals arrive and agents create work items. Send a signal
            via the API to get started.
          </p>
        </div>
      ) : (
        <>
          <IssueFilters />
          <IssueDataTable
            data={data?.data ?? []}
            total={data?.total ?? 0}
            page={search.page}
            limit={search.limit}
            isLoading={isFetching && !data}
          />
        </>
      )}
    </div>
  );
}
