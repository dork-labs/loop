import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { DashboardActivity } from '@/types/dashboard';
import type { Issue, IssueStatus, IssueType } from '@/types/issues';

// ---------------------------------------------------------------------------
// Type colour maps — signal=amber, hypothesis=violet, plan=blue,
// task=emerald, monitor=cyan. Matches Issue List badge colours.
// ---------------------------------------------------------------------------

const TYPE_DOT_CLASS: Record<IssueType, string> = {
  signal: 'bg-amber-500',
  hypothesis: 'bg-violet-500',
  plan: 'bg-blue-500',
  task: 'bg-emerald-500',
  monitor: 'bg-cyan-500',
};

const TYPE_BADGE_CLASS: Record<IssueType, string> = {
  signal: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hypothesis: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  plan: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  task: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  monitor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

const STATUS_BADGE_CLASS: Record<IssueStatus, string> = {
  triage: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  backlog: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
  todo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  done: 'bg-green-500/20 text-green-400 border-green-500/30',
  canceled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive a chain's overall status from its children's statuses. */
function deriveChainStatus(chain: DashboardActivity): 'Complete' | 'In Progress' | 'Pending' {
  const { root, children } = chain;

  // A chain with no children is just the root issue
  const allIssues: Issue[] = [root, ...children.map((c) => c.issue)];

  if (allIssues.every((i) => i.status === 'done' || i.status === 'canceled')) {
    return 'Complete';
  }
  if (allIssues.some((i) => i.status === 'in_progress')) {
    return 'In Progress';
  }
  return 'Pending';
}

const CHAIN_STATUS_CLASS = {
  Complete: 'bg-green-500/20 text-green-400 border-green-500/30',
  'In Progress': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  Pending: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
};

/** Format an ISO timestamp as a relative string ("2h ago", "3d ago"). */
function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1_000);

  if (diffSec < 60) return 'just now';
  if (diffSec < 3_600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3_600)}h ago`;
  return `${Math.floor(diffSec / 86_400)}d ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TimelineNodeProps {
  issue: Issue;
  isRoot?: boolean;
}

/** A single node on the vertical timeline. */
function TimelineNode({ issue, isRoot = false }: TimelineNodeProps) {
  const dotClass = TYPE_DOT_CLASS[issue.type];

  return (
    <div className={cn('relative', isRoot ? 'mb-3' : 'mb-4 last:mb-0')}>
      {/* Type-coloured dot positioned on the border-left line */}
      <div
        className={cn(
          'absolute top-[0.6rem] -left-[1.625rem] size-3 rounded-full ring-2 ring-neutral-900',
          dotClass
        )}
      />
      <Link
        to="/issues/$issueId"
        params={{ issueId: issue.id }}
        className="block rounded-lg border border-neutral-800 bg-neutral-900 p-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
      >
        {/* Badges row */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn('text-xs', TYPE_BADGE_CLASS[issue.type])}>
            {issue.type}
          </Badge>
          <Badge variant="outline" className={cn('text-xs', STATUS_BADGE_CLASS[issue.status])}>
            {issue.status.replace('_', ' ')}
          </Badge>
          {/* Key metadata: source for signals, confidence for hypotheses */}
          {issue.type === 'signal' && issue.signalSource && (
            <span className="text-xs text-neutral-500">via {issue.signalSource}</span>
          )}
          {issue.type === 'hypothesis' && issue.hypothesis && (
            <span className="text-xs text-neutral-500">
              {Math.round(issue.hypothesis.confidence * 100)}% confidence
            </span>
          )}
          {/* PR links for tasks */}
          {issue.type === 'task' && issue.pullRequests && issue.pullRequests.length > 0 && (
            <span className="text-xs text-neutral-500">
              {issue.pullRequests.length} PR{issue.pullRequests.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Title and number */}
        <p className="text-sm font-medium text-neutral-100">
          <span className="mr-1.5 font-mono text-neutral-500">#{issue.number}</span>
          {issue.title}
        </p>

        {/* Timestamp */}
        <p className="mt-1 text-xs text-neutral-500">{relativeTime(issue.updatedAt)}</p>
      </Link>
    </div>
  );
}

interface ChainCardProps {
  chain: DashboardActivity;
}

/** A single signal chain rendered as a vertical timeline group. */
function ChainCard({ chain }: ChainCardProps) {
  const chainStatus = deriveChainStatus(chain);

  return (
    <div className="relative border-l border-neutral-700 pl-6">
      {/* Chain header: latest activity time + overall status badge */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-neutral-500">
          Last active {relativeTime(chain.latestActivity)}
        </span>
        <Badge variant="outline" className={cn('text-xs', CHAIN_STATUS_CLASS[chainStatus])}>
          {chainStatus}
        </Badge>
      </div>

      {/* Root issue node */}
      <TimelineNode issue={chain.root} isRoot />

      {/* Child issue nodes */}
      {chain.children.map(({ issue }) => (
        <TimelineNode key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface ActivityTimelineProps {
  chains: DashboardActivity[];
}

/**
 * Renders a vertical CSS timeline of signal chains.
 * Each chain shows root + children as type-coloured nodes on a border-left
 * spine. Polling is managed by the parent via `refetchInterval` on the query.
 */
export function ActivityTimeline({ chains }: ActivityTimelineProps) {
  return (
    <div className="space-y-8">
      {chains.map((chain) => (
        <ChainCard key={chain.root.id} chain={chain} />
      ))}
    </div>
  );
}
