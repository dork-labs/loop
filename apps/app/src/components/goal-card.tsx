import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import type { Goal } from '@/types/projects';

/** Percentage bar color based on progress thresholds. */
function resolveProgressColor(progress: number): string {
  if (progress > 75) return 'bg-green-500';
  if (progress > 25) return 'bg-yellow-500';
  return 'bg-red-500';
}

/** Badge class string for a given goal status. */
function resolveStatusClass(status: Goal['status']): string {
  if (status === 'achieved') return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (status === 'active') return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
}

/** Compute progress percentage, guarding against null or zero target. */
function computeProgress(current: number | null, target: number | null): number {
  if (target === null || target === 0 || current === null) return 0;
  return Math.min(100, (current / target) * 100);
}

interface GoalCardProps {
  goal: Goal;
}

/** A card displaying a single goal with a progress bar and metadata. */
export function GoalCard({ goal }: GoalCardProps) {
  const progress = computeProgress(goal.currentValue, goal.targetValue);
  const progressColor = resolveProgressColor(progress);
  const statusClass = resolveStatusClass(goal.status);

  const metricLabel = [goal.metric, goal.unit ? `(${goal.unit})` : null].filter(Boolean).join(' ');

  const valueLabel =
    goal.currentValue !== null && goal.targetValue !== null
      ? `${goal.currentValue} / ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ''}`
      : 'No values set';

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1 pr-4">
          <CardTitle className="text-base leading-snug">{goal.title}</CardTitle>
          {metricLabel && <p className="text-muted-foreground text-sm">{metricLabel}</p>}
        </div>
        <Badge className={statusClass} variant="outline">
          {goal.status}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        <Progress value={progress} className="bg-secondary" indicatorClassName={progressColor} />

        {/* Value and percentage row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{valueLabel}</span>
          <span className="font-mono text-sm">{progress.toFixed(0)}%</span>
        </div>

        {/* Linked project */}
        {goal.project && (
          <p className="text-muted-foreground text-xs">
            Project: <span className="text-foreground font-medium">{goal.project.name}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Skeleton placeholder matching the GoalCard layout. */
export function GoalCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}
