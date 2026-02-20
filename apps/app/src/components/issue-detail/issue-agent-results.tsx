import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarkdownContent } from '@/components/markdown-content'
import type { Issue, PullRequestRef } from '@/types/issues'

const PR_STATE_COLORS: Record<string, string> = {
  open: 'bg-green-500/20 text-green-400',
  closed: 'bg-red-500/20 text-red-400',
  merged: 'bg-violet-500/20 text-violet-400',
}

function formatSha(sha: string): string {
  return sha.slice(0, 7)
}

function PrBadge({ pr }: { pr: PullRequestRef }) {
  const state = pr.mergedAt ? 'merged' : (pr.state ?? 'open')
  const colorClass = PR_STATE_COLORS[state] ?? 'bg-slate-500/20 text-slate-400'
  return <Badge className={colorClass}>{state}</Badge>
}

/** Agent summary, commits with SHA links, and PRs with status badges. */
export function IssueAgentResults({ issue }: { issue: Issue }) {
  const hasCommits = issue.commits && issue.commits.length > 0
  const hasPrs = issue.pullRequests && issue.pullRequests.length > 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Agent Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {issue.agentSummary && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Summary</p>
            <MarkdownContent content={issue.agentSummary} />
          </div>
        )}

        {hasCommits && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Commits ({issue.commits!.length})
            </p>
            <ul className="space-y-2">
              {issue.commits!.map((commit) => (
                <li key={commit.sha} className="flex items-start gap-3 text-sm">
                  {commit.url ? (
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-xs text-primary hover:underline"
                    >
                      {formatSha(commit.sha)}
                    </a>
                  ) : (
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {formatSha(commit.sha)}
                    </span>
                  )}
                  <span className="flex-1 text-muted-foreground">{commit.message}</span>
                  {commit.author && (
                    <span className="shrink-0 text-xs text-muted-foreground">{commit.author}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasPrs && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pull Requests ({issue.pullRequests!.length})
            </p>
            <ul className="space-y-2">
              {issue.pullRequests!.map((pr) => (
                <li key={pr.number} className="flex items-center gap-3 text-sm">
                  <PrBadge pr={pr} />
                  {pr.url ? (
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-primary hover:underline"
                    >
                      #{pr.number} {pr.title}
                    </a>
                  ) : (
                    <span className="flex-1 truncate text-muted-foreground">
                      #{pr.number} {pr.title}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
