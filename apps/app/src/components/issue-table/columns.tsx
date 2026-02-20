import { type ColumnDef } from '@tanstack/react-table'
import {
  Radio,
  Lightbulb,
  Map,
  CheckSquare,
  Activity,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Issue, IssueType, IssueStatus } from '@/types/issues'

// ─── Color maps ───────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<IssueType, { className: string; Icon: React.FC<{ className?: string }> }> = {
  signal:     { className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',   Icon: Radio },
  hypothesis: { className: 'bg-violet-500/15 text-violet-400 border-violet-500/20', Icon: Lightbulb },
  plan:       { className: 'bg-blue-500/15 text-blue-400 border-blue-500/20',       Icon: Map },
  task:       { className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', Icon: CheckSquare },
  monitor:    { className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',       Icon: Activity },
}

const STATUS_STYLES: Record<IssueStatus, string> = {
  triage:      'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  backlog:     'bg-slate-500/15 text-slate-400 border-slate-500/20',
  todo:        'bg-blue-500/15 text-blue-400 border-blue-500/20',
  in_progress: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  done:        'bg-green-500/15 text-green-400 border-green-500/20',
  canceled:    'bg-red-500/15 text-red-400 border-red-500/20',
}

const STATUS_LABELS: Record<IssueStatus, string> = {
  triage:      'Triage',
  backlog:     'Backlog',
  todo:        'Todo',
  in_progress: 'In Progress',
  done:        'Done',
  canceled:    'Canceled',
}

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

// ─── Column definitions ───────────────────────────────────────────────────────

/** TanStack Table column definitions for the issue list view. */
export const issueColumns: ColumnDef<Issue>[] = [
  {
    accessorKey: 'number',
    header: '#',
    size: 80,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        #{row.original.number}
      </span>
    ),
  },
  {
    accessorKey: 'title',
    header: 'Title',
    size: undefined, // flex
    cell: ({ row }) => (
      <span className="block max-w-[420px] truncate font-medium" title={row.original.title}>
        {row.original.title}
      </span>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    size: 120,
    cell: ({ row }) => {
      const type = row.original.type
      const { className, Icon } = TYPE_STYLES[type]
      return (
        <Badge className={cn('border', className)}>
          <Icon className="size-3" />
          {type}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    size: 130,
    cell: ({ row }) => {
      const status = row.original.status
      return (
        <Badge className={cn('border', STATUS_STYLES[status])}>
          {STATUS_LABELS[status]}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'priority',
    header: 'Priority',
    size: 80,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        P{row.original.priority}
      </span>
    ),
  },
  {
    id: 'project',
    header: 'Project',
    size: 140,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.projectId ?? '—'}
      </span>
    ),
  },
  {
    id: 'labels',
    header: 'Labels',
    size: 160,
    cell: ({ row }) => {
      const labels = row.original.labels ?? []
      const visible = labels.slice(0, 2)
      const overflow = labels.length - visible.length
      return (
        <div className="flex flex-wrap gap-1">
          {visible.map((label) => (
            <Badge
              key={label.id}
              variant="outline"
              className="border text-xs"
              style={{ borderColor: label.color, color: label.color }}
            >
              {label.name}
            </Badge>
          ))}
          {overflow > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{overflow}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'updatedAt',
    header: 'Updated',
    size: 120,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {relativeTime(row.original.updatedAt)}
      </span>
    ),
  },
]
