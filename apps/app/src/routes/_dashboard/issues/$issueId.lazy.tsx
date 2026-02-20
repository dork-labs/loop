import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { issueDetailOptions } from '@/lib/queries/issues'
import { IssueHeader } from '@/components/issue-detail/issue-header'
import { IssueMetadata } from '@/components/issue-detail/issue-metadata'
import { IssueRelations } from '@/components/issue-detail/issue-relations'
import { IssueChildren } from '@/components/issue-detail/issue-children'
import { IssueAgentResults } from '@/components/issue-detail/issue-agent-results'
import { IssueComments } from '@/components/issue-detail/issue-comments'
import { SignalData } from '@/components/issue-detail/signal-data'
import { HypothesisData } from '@/components/issue-detail/hypothesis-data'
import { IssueDetailSkeleton } from '@/components/issue-detail/issue-detail-skeleton'
import { MarkdownContent } from '@/components/markdown-content'

export const Route = createLazyFileRoute('/_dashboard/issues/$issueId')({
  component: IssueDetailPage,
})

function IssueDetailPage() {
  const { issueId } = Route.useParams()
  const { data: issue, isLoading, error } = useQuery(issueDetailOptions(issueId))

  if (isLoading) return <IssueDetailSkeleton />

  if (error || !issue) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-destructive">Issue not found</p>
        <Link to="/issues" className="text-sm underline">
          Back to Issues
        </Link>
      </div>
    )
  }

  const hasAgentResults =
    Boolean(issue.agentSummary) ||
    (issue.commits?.length ?? 0) > 0 ||
    (issue.pullRequests?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <Link
        to="/issues"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Issues
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* Main content column */}
        <div className="space-y-6">
          <IssueHeader issue={issue} />

          {issue.description && <MarkdownContent content={issue.description} />}

          {issue.type === 'signal' && issue.signalPayload && (
            <SignalData source={issue.signalSource} payload={issue.signalPayload} />
          )}

          {issue.type === 'hypothesis' && issue.hypothesis && (
            <HypothesisData data={issue.hypothesis} />
          )}

          {hasAgentResults && <IssueAgentResults issue={issue} />}

          {issue.children && issue.children.length > 0 && (
            <IssueChildren childIssues={issue.children} />
          )}

          {issue.comments && issue.comments.length > 0 && (
            <IssueComments comments={issue.comments} />
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <IssueMetadata issue={issue} />

          {issue.relations && issue.relations.length > 0 && (
            <IssueRelations relations={issue.relations} />
          )}
        </aside>
      </div>
    </div>
  )
}
