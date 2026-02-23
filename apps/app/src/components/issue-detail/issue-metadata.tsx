import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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

/** Priority label mapping P0-P4. */
const PRIORITY_LABELS: Record<number, string> = {
  0: 'P0 — Critical',
  1: 'P1 — High',
  2: 'P2 — Medium',
  3: 'P3 — Low',
  4: 'P4 — Minimal',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** Sidebar metadata card: priority, status, type, labels, parent, timestamps. */
export function IssueMetadata({ issue }: { issue: Issue }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <MetaRow label="Priority">
          <span className="font-mono">
            {PRIORITY_LABELS[issue.priority] ?? `P${issue.priority}`}
          </span>
        </MetaRow>

        <MetaRow label="Status">
          <Badge className={STATUS_COLORS[issue.status]}>{issue.status.replace('_', ' ')}</Badge>
        </MetaRow>

        <MetaRow label="Type">
          <Badge className={TYPE_COLORS[issue.type]}>{issue.type}</Badge>
        </MetaRow>

        {issue.labels && issue.labels.length > 0 && (
          <MetaRow label="Labels">
            <div className="flex flex-wrap gap-1">
              {issue.labels.map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  style={{ borderColor: label.color, color: label.color }}
                >
                  {label.name}
                </Badge>
              ))}
            </div>
          </MetaRow>
        )}

        {issue.parent && (
          <MetaRow label="Parent">
            <Link
              to="/issues/$issueId"
              params={{ issueId: issue.parent.id }}
              className="text-primary text-sm hover:underline"
            >
              #{issue.parent.number} {issue.parent.title}
            </Link>
          </MetaRow>
        )}

        <Separator />

        <MetaRow label="Created">
          <span className="text-muted-foreground">{formatDate(issue.createdAt)}</span>
        </MetaRow>

        <MetaRow label="Updated">
          <span className="text-muted-foreground">{formatDate(issue.updatedAt)}</span>
        </MetaRow>

        {issue.completedAt && (
          <MetaRow label="Completed">
            <span className="text-muted-foreground">{formatDate(issue.completedAt)}</span>
          </MetaRow>
        )}
      </CardContent>
    </Card>
  );
}
