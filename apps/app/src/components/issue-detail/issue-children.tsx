import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Issue, IssueType, IssueStatus } from '@/types/issues';

const TYPE_COLORS: Record<IssueType, string> = {
  signal: 'bg-amber-500/20 text-amber-400',
  hypothesis: 'bg-violet-500/20 text-violet-400',
  plan: 'bg-blue-500/20 text-blue-400',
  task: 'bg-emerald-500/20 text-emerald-400',
  monitor: 'bg-cyan-500/20 text-cyan-400',
};

const STATUS_COLORS: Record<IssueStatus, string> = {
  triage: 'bg-yellow-500/20 text-yellow-400',
  backlog: 'bg-slate-500/20 text-slate-400',
  todo: 'bg-blue-500/20 text-blue-400',
  in_progress: 'bg-indigo-500/20 text-indigo-400',
  done: 'bg-green-500/20 text-green-400',
  canceled: 'bg-red-500/20 text-red-400',
};

/** Compact list of child issues with type/status badges and clickable links. */
export function IssueChildren({ childIssues }: { childIssues: Issue[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Child Issues ({childIssues.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-border divide-y">
          {childIssues.map((child) => (
            <li key={child.id} className="py-2">
              <Link
                to="/issues/$issueId"
                params={{ issueId: child.id }}
                className="flex items-center gap-3 hover:opacity-80"
              >
                <span className="text-muted-foreground font-mono text-xs">#{child.number}</span>
                <span className="flex-1 truncate text-sm">{child.title}</span>
                <div className="flex shrink-0 gap-1">
                  <Badge className={TYPE_COLORS[child.type]}>{child.type}</Badge>
                  <Badge className={STATUS_COLORS[child.status]}>
                    {child.status.replace('_', ' ')}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
