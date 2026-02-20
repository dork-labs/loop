import { Badge } from '@/components/ui/badge'
import type { Issue, IssueType, IssueStatus } from '@/types/issues'

/** Type badge color classes keyed by issue type. */
const TYPE_COLORS: Record<IssueType, string> = {
  signal: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hypothesis: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  plan: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  task: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  monitor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
}

/** Status badge color classes keyed by issue status. */
const STATUS_COLORS: Record<IssueStatus, string> = {
  triage: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  backlog: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  todo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  done: 'bg-green-500/20 text-green-400 border-green-500/30',
  canceled: 'bg-red-500/20 text-red-400 border-red-500/30',
}

/** Renders the issue number, title, type badge, and status badge. */
export function IssueHeader({ issue }: { issue: Issue }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">#{issue.number}</span>
        <Badge className={TYPE_COLORS[issue.type]}>{issue.type}</Badge>
        <Badge className={STATUS_COLORS[issue.status]}>{issue.status.replace('_', ' ')}</Badge>
      </div>
      <h1 className="text-2xl font-bold leading-tight">{issue.title}</h1>
    </div>
  )
}
