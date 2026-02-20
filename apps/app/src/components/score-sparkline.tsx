import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { PromptVersion } from '@/types/prompts'

interface ScoreSparklineProps {
  versions: PromptVersion[]
}

/** Returns a CSS color string based on the latest score value (green/amber/red). */
function resolveScoreColor(score: number): string {
  if (score >= 3.5) return 'hsl(var(--chart-2))' // green
  if (score >= 2.5) return 'hsl(var(--chart-3))' // amber
  return 'hsl(340 75% 55%)' // red
}

/**
 * Area chart sparkline showing composite review score trend across the last N
 * prompt versions. Versions are displayed oldest-first (left to right).
 * Color adapts based on the most recent score.
 */
export function ScoreSparkline({ versions }: ScoreSparklineProps) {
  // Reverse so oldest version is leftmost on the chart
  const data = versions
    .slice()
    .reverse()
    .map((v) => ({
      version: `v${v.version}`,
      score: v.reviewScore ?? 0,
    }))

  const latestScore = data[data.length - 1]?.score ?? 0
  const fillColor = resolveScoreColor(latestScore)

  return (
    <ChartContainer
      config={{ score: { label: 'Score', color: fillColor } }}
      className="h-24 w-full"
    >
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="version" tick={{ fontSize: 10 }} />
        <YAxis domain={[1, 5]} tick={{ fontSize: 10 }} width={20} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="score"
          stroke={fillColor}
          fill={fillColor}
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartContainer>
  )
}
