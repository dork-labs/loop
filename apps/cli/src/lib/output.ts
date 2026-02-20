import Table from 'cli-table3'
import pc from 'picocolors'
import type { Issue } from '../types.js'

/** Color map for issue statuses. */
export const STATUS_COLOR: Record<string, (s: string) => string> = {
  triage: pc.yellow,
  todo: pc.cyan,
  backlog: pc.dim,
  in_progress: pc.blue,
  done: pc.green,
  canceled: pc.red,
}

/** Human-readable priority labels with color. */
export const PRIORITY_LABEL: Record<number, string> = {
  0: pc.dim('none'),
  1: pc.red('urgent'),
  2: pc.yellow('high'),
  3: pc.white('medium'),
  4: pc.dim('low'),
}

/** Icon map for issue types. */
export const TYPE_ICON: Record<string, string> = {
  signal: '\u26A1',
  hypothesis: '\uD83D\uDD2C',
  plan: '\uD83D\uDCCB',
  task: '\uD83D\uDD27',
  monitor: '\uD83D\uDC41',
}

/**
 * Output data as JSON (for --json mode) or render using the provided table function.
 *
 * @param data - The data to output
 * @param opts - Global options containing json flag
 * @param renderFn - Function to render data in table format
 */
export function output(
  data: unknown,
  opts: { json?: boolean },
  renderFn: (d: unknown) => void,
): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
  } else {
    renderFn(data)
  }
}

/**
 * Render a list of issues as a formatted table.
 * Columns: #, TYPE, TITLE, STATUS, PRI, PROJECT, CREATED
 */
export function renderIssueTable(issues: Issue[]): void {
  const table = new Table({
    head: ['#', 'TYPE', 'TITLE', 'STATUS', 'PRI', 'PROJECT', 'CREATED'],
    style: { head: ['cyan'] },
  })

  for (const issue of issues) {
    const type = issue.type ?? ''
    const status = issue.status ?? ''
    const priority = issue.priority ?? 3
    const title = truncate(issue.title ?? '', 50)
    const colorStatus = (STATUS_COLOR[status] ?? pc.white)(status)
    const icon = TYPE_ICON[type] ?? ''

    table.push([
      String(issue.number ?? ''),
      `${icon} ${type}`,
      title,
      colorStatus,
      PRIORITY_LABEL[priority] ?? String(priority),
      issue.projectId ?? '-',
      formatDate(issue.createdAt ?? ''),
    ])
  }

  console.log(table.toString())
}

/** Truncate a string to maxLen, appending ellipsis if needed. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '\u2026'
}

/** Format an ISO date string to YYYY-MM-DD. */
export function formatDate(iso: string): string {
  if (!iso) return '-'
  return iso.slice(0, 10)
}
