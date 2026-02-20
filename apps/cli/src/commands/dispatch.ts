import { Command } from 'commander'
import pc from 'picocolors'
import Table from 'cli-table3'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output, TYPE_ICON, PRIORITY_LABEL, STATUS_COLOR, truncate } from '../lib/output.js'
import type { PaginatedResponse, DispatchQueueItem, Issue } from '../types.js'

/**
 * Register the `next` and `dispatch` top-level commands.
 *
 * - `looped next` — Preview the dispatch queue (priority-ordered unblocked issues).
 * - `looped dispatch <id>` — Force-claim a specific issue and render its prompt.
 */
export function registerDispatchCommand(program: Command): void {
  program
    .command('next')
    .description('Preview the dispatch queue (priority-ordered unblocked issues)')
    .option('--project <id>', 'Filter by project ID')
    .option('--limit <n>', 'Max items to show', '10')
    .action(async (opts) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const searchParams: Record<string, string> = {
          limit: opts.limit,
          offset: '0',
        }
        if (opts.project) searchParams.projectId = opts.project

        const result = await api
          .get('api/dispatch/queue', { searchParams })
          .json<PaginatedResponse<DispatchQueueItem>>()

        output(result, globalOpts, () => renderQueueTable(result.data, result.total))
      })
    })

  program
    .command('dispatch <id>')
    .description('Force-claim a specific issue and render its prompt')
    .action(async (id: string) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        // Set the issue to in_progress
        await api.patch(`api/issues/${id}`, {
          json: { status: 'in_progress' },
        })

        // Fetch the updated issue details
        const result = await api
          .get(`api/issues/${id}`)
          .json<{ data: Issue }>()

        output(result, globalOpts, () => renderClaimedIssue(result.data))
      })
    })
}

/**
 * Render the dispatch queue as a formatted table.
 * Columns: RANK, #, TYPE, TITLE, PRI, SCORE, BREAKDOWN
 */
function renderQueueTable(items: DispatchQueueItem[], total: number): void {
  if (items.length === 0) {
    console.log(pc.dim('No issues in the dispatch queue.'))
    return
  }

  const table = new Table({
    head: ['RANK', '#', 'TYPE', 'TITLE', 'PRI', 'SCORE', 'BREAKDOWN'],
    style: { head: ['cyan'] },
  })

  for (let i = 0; i < items.length; i++) {
    const { issue, score, breakdown } = items[i]
    const type = String(issue.type ?? '')
    const icon = TYPE_ICON[type] ?? ''
    const priority = Number(issue.priority ?? 3)

    const breakdownParts = []
    if (breakdown.priorityWeight > 0) breakdownParts.push(`pri:${breakdown.priorityWeight}`)
    if (breakdown.goalBonus > 0) breakdownParts.push(`goal:${breakdown.goalBonus}`)
    if (breakdown.ageBonus > 0) breakdownParts.push(`age:${breakdown.ageBonus}`)
    if (breakdown.typeBonus > 0) breakdownParts.push(`type:${breakdown.typeBonus}`)

    table.push([
      pc.dim(String(i + 1)),
      String(issue.number ?? ''),
      `${icon} ${type}`,
      truncate(String(issue.title ?? ''), 40),
      PRIORITY_LABEL[priority] ?? String(priority),
      pc.bold(String(score)),
      pc.dim(breakdownParts.join(' + ')),
    ])
  }

  console.log(table.toString())
  console.log(pc.dim(`\nShowing ${items.length} of ${total} queued issues`))
}

/** Render a claimed issue summary for the dispatch command. */
function renderClaimedIssue(issue: Issue): void {
  const type = String(issue.type ?? '')
  const status = String(issue.status ?? '')
  const priority = Number(issue.priority ?? 3)
  const icon = TYPE_ICON[type] ?? ''
  const colorStatus = (STATUS_COLOR[status] ?? pc.white)(status)

  console.log(pc.bold(`\nDispatched: #${issue.number} ${issue.title}`))
  console.log(`  Type:     ${icon} ${type}`)
  console.log(`  Status:   ${colorStatus}`)
  console.log(`  Priority: ${PRIORITY_LABEL[priority] ?? String(priority)}`)
  console.log(`  ID:       ${pc.dim(issue.id)}`)

  if (issue.description) {
    console.log(`\n${pc.dim('Description:')}`)
    console.log(`  ${truncate(issue.description, 200)}`)
  }
}
