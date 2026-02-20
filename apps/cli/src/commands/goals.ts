import { Command } from 'commander'
import Table from 'cli-table3'
import pc from 'picocolors'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output, formatDate } from '../lib/output.js'
import type { GlobalOptions } from '../lib/config.js'
import type { Goal, GoalStatus, PaginatedResponse } from '../types.js'

/** Color map for goal statuses. */
const GOAL_STATUS_COLOR: Record<GoalStatus, (s: string) => string> = {
  active: pc.blue,
  achieved: pc.green,
  abandoned: pc.dim,
}

/**
 * Format a goal's progress as "currentValue/targetValue unit".
 * Returns "-" when values are not set.
 */
function formatProgress(goal: Goal): string {
  if (goal.currentValue == null || goal.targetValue == null) return '-'
  const unit = goal.unit ?? ''
  return `${goal.currentValue}/${goal.targetValue}${unit ? ` ${unit}` : ''}`
}

/**
 * Calculate progress percentage (0-100).
 * Returns null when values are not set or target is zero.
 */
function calcPercent(goal: Goal): number | null {
  if (goal.currentValue == null || goal.targetValue == null) return null
  if (goal.targetValue === 0) return null
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100))
}

/** Render a compact progress bar with percentage. */
function renderProgressBar(goal: Goal): string {
  const pct = calcPercent(goal)
  if (pct == null) return pc.dim('n/a')

  const WIDTH = 15
  const filled = Math.round((pct / 100) * WIDTH)
  const empty = WIDTH - filled

  const colorFn = pct >= 75 ? pc.green : pct >= 25 ? pc.yellow : pc.red
  const bar = colorFn('\u2588'.repeat(filled)) + pc.dim('\u2591'.repeat(empty))
  return `${bar} ${pct}%`
}

/** Render goals as a formatted table. */
function renderGoalTable(goals: Goal[]): void {
  const table = new Table({
    head: ['TITLE', 'STATUS', 'METRIC', 'PROGRESS', 'BAR', 'PROJECT', 'CREATED'],
    style: { head: ['cyan'] },
  })

  for (const goal of goals) {
    const status = goal.status
    const colorStatus = (GOAL_STATUS_COLOR[status] ?? pc.white)(status)

    table.push([
      goal.title,
      colorStatus,
      goal.metric ?? '-',
      formatProgress(goal),
      renderProgressBar(goal),
      goal.projectId ?? '-',
      formatDate(goal.createdAt),
    ])
  }

  console.log(table.toString())
}

/** Register the `goals` command group on the given program. */
export function registerGoalsCommand(program: Command): void {
  const goals = program
    .command('goals')
    .description('Manage goals')

  goals
    .command('list')
    .description('List all goals')
    .option('--status <status>', 'Filter by status (active, achieved, abandoned)')
    .option('--limit <n>', 'Maximum number of results', '50')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts) => {
      const globalOpts = program.opts<GlobalOptions>()
      await withErrorHandler(async () => {
        const api = createApiClient(globalOpts)

        const params: Record<string, string> = {
          limit: opts.limit,
          offset: opts.offset,
        }
        if (opts.status) params.status = opts.status

        const result = await api
          .get('api/goals', { searchParams: params })
          .json<PaginatedResponse<Goal>>()

        output(result, globalOpts, () => {
          if (result.data.length === 0) {
            console.log(pc.dim('No goals found.'))
            return
          }
          renderGoalTable(result.data)
          console.log(pc.dim(`\nShowing ${result.data.length} of ${result.total} goals`))
        })
      })
    })
}
