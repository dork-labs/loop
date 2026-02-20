import { Command } from 'commander'
import pc from 'picocolors'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output, STATUS_COLOR } from '../lib/output.js'
import type { DashboardStats } from '../types.js'

interface StatsResponse {
  data: DashboardStats
}

/** Register the `status` command for displaying system health overview. */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show system health overview')
    .action(async () => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const result = await api.get('api/dashboard/stats').json<StatsResponse>()

        output(result.data, globalOpts, () => renderStatus(result.data))
      })
    })
}

/** Render dashboard stats as a formatted terminal overview. */
function renderStatus(stats: DashboardStats): void {
  const { issues, goals, dispatch } = stats

  // Header
  console.log(pc.bold(pc.cyan('\n  Loop System Status\n')))

  // Issues section
  console.log(pc.bold('  Issues'))
  console.log(`    Total: ${pc.white(String(issues.total))}`)
  console.log()

  // Status breakdown
  console.log(pc.dim('    By Status:'))
  for (const [status, count] of Object.entries(issues.byStatus)) {
    const colorFn = STATUS_COLOR[status] ?? pc.white
    console.log(`      ${colorFn(status.padEnd(12))} ${pc.white(String(count))}`)
  }
  console.log()

  // Type breakdown
  console.log(pc.dim('    By Type:'))
  for (const [type, count] of Object.entries(issues.byType)) {
    console.log(`      ${type.padEnd(12)} ${pc.white(String(count))}`)
  }
  console.log()

  // Dispatch section
  console.log(pc.bold('  Dispatch'))
  console.log(`    Queue depth:     ${formatCount(dispatch.queueDepth)}`)
  console.log(`    Active:          ${formatCount(dispatch.activeCount)}`)
  console.log(`    Done (24h):      ${formatCount(dispatch.completedLast24h)}`)
  console.log()

  // Goals section
  console.log(pc.bold('  Goals'))
  console.log(`    Total:           ${pc.white(String(goals.total))}`)
  console.log(`    Active:          ${pc.blue(String(goals.active))}`)
  console.log(`    Achieved:        ${pc.green(String(goals.achieved))}`)
  console.log()
}

/** Format a count with color emphasis for non-zero values. */
function formatCount(count: number): string {
  return count > 0 ? pc.white(String(count)) : pc.dim('0')
}
