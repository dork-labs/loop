import { useState } from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScoreSparkline } from '@/components/score-sparkline';
import type { DashboardPromptHealth } from '@/types/dashboard';
import type { PromptVersion } from '@/types/prompts';

interface PromptCardProps {
  data: DashboardPromptHealth;
}

/** Formats a nullable number to a fixed-decimal string, returning a dash for null. */
function formatScore(value: number | null, decimals = 1): string {
  return value !== null ? value.toFixed(decimals) : '—';
}

/** Formats a nullable completion rate as a percentage string or a dash. */
function formatRate(value: number | null): string {
  return value !== null ? `${(value * 100).toFixed(0)}%` : '—';
}

/** Badge variant text for version status values. */
function versionStatusLabel(status: PromptVersion['status']): string {
  if (status === 'active') return 'Active';
  if (status === 'retired') return 'Retired';
  return 'Draft';
}

/** Inline score bar for a 1-5 dimension score. */
function ScoreBar({ score }: { score: number | null }) {
  const pct = score !== null ? ((score - 1) / 4) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="bg-secondary h-1.5 flex-1 rounded-full">
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-muted-foreground w-8 text-right font-mono text-xs">
        {score !== null ? score.toFixed(1) : '—'}
      </span>
    </div>
  );
}

/** Horizontal metrics grid — 4 stat cells. */
function MetricsGrid({ data }: { data: DashboardPromptHealth }) {
  const { activeVersion, reviewSummary } = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCell label="Usage" value={activeVersion ? String(activeVersion.usageCount) : '—'} />
      <MetricCell label="Completion" value={formatRate(activeVersion?.completionRate ?? null)} />
      <MetricCell label="Score /5" value={formatScore(reviewSummary.compositeScore)} />
      <MetricCell label="Reviews" value={String(reviewSummary.totalReviews)} />
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-secondary/50 rounded px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-mono text-sm font-medium">{value}</p>
    </div>
  );
}

/** Score breakdown for the three review dimensions. */
function ScoreBreakdown({
  reviewSummary,
}: {
  reviewSummary: DashboardPromptHealth['reviewSummary'];
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Score Breakdown
      </p>
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground w-24">Clarity</span>
          <ScoreBar score={reviewSummary.avgClarity} />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground w-24">Completeness</span>
          <ScoreBar score={reviewSummary.avgCompleteness} />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground w-24">Relevance</span>
          <ScoreBar score={reviewSummary.avgRelevance} />
        </div>
      </div>
    </div>
  );
}

/** Collapsible version history table. */
function VersionHistory({ versions }: { versions: PromptVersion[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-border border-t pt-3">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between text-xs font-medium transition-colors">
        <span>Version History ({versions.length})</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-2">
        {versions.map((v) => (
          <div
            key={v.id}
            className="border-border bg-secondary/30 rounded border px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium">v{v.version}</span>
                <Badge variant="outline" className="h-4 px-1 py-0 text-[10px]">
                  {versionStatusLabel(v.status)}
                </Badge>
              </div>
              <div className="text-muted-foreground flex items-center gap-3">
                <span>{v.usageCount} uses</span>
                <span>{formatRate(v.completionRate)}</span>
                <span className="font-mono">{formatScore(v.reviewScore)}/5</span>
              </div>
            </div>
            {v.changelog && <p className="text-muted-foreground mt-1">{v.changelog}</p>}
            <p className="text-muted-foreground mt-1">
              By {v.authorName} ({v.authorType})
            </p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Displays health metrics, score sparkline, and collapsible version history
 * for a single prompt template.
 */
export function PromptCard({ data }: PromptCardProps) {
  const { template, activeVersion, recentVersions, reviewSummary, needsAttention } = data;
  const hasScoreData = recentVersions.some((v) => v.reviewScore !== null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="leading-tight font-semibold">{template.name}</p>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">{template.slug}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeVersion && (
              <Badge variant="outline" className="text-xs">
                v{activeVersion.version}
              </Badge>
            )}
            {needsAttention && (
              <Badge className="gap-1 bg-yellow-500/20 text-xs text-yellow-400 hover:bg-yellow-500/30">
                <AlertTriangle className="size-3" />
                Needs attention
              </Badge>
            )}
          </div>
        </div>
        {template.description && (
          <p className="text-muted-foreground mt-1 text-xs">{template.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <MetricsGrid data={data} />

        {reviewSummary.totalReviews > 0 && <ScoreBreakdown reviewSummary={reviewSummary} />}

        {hasScoreData && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Score Trend
            </p>
            <ScoreSparkline versions={recentVersions} />
          </div>
        )}

        {recentVersions.length > 0 && <VersionHistory versions={recentVersions} />}
      </CardContent>
    </Card>
  );
}

/** Skeleton loading state for a single PromptCard. */
export function PromptCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
        <Skeleton className="h-24 w-full" />
      </CardContent>
    </Card>
  );
}
