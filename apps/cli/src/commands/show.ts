import { Command } from 'commander'
import Table from 'cli-table3'
import pc from 'picocolors'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import {
  output,
  STATUS_COLOR,
  PRIORITY_LABEL,
  TYPE_ICON,
} from '../lib/output.js'
import type { SingleResponse, IssueDetail, IssueRelation } from '../types.js'

/**
 * Render a single issue detail view with all sections.
 *
 * @param issue - The full issue detail object to render
 */
function renderIssueDetail(issue: IssueDetail): void {
  const icon = TYPE_ICON[issue.type] ?? ''
  const statusColor = STATUS_COLOR[issue.status] ?? pc.white
  const priorityLabel = PRIORITY_LABEL[issue.priority] ?? String(issue.priority)

  // Header
  console.log(`#${issue.number} [${icon} ${issue.type}] ${issue.title}`)

  // Metadata
  const meta = [
    `Status: ${statusColor(issue.status)}`,
    `Priority: ${priorityLabel}`,
  ]
  if (issue.projectId) meta.push(`Project: ${issue.projectId}`)
  console.log(meta.join('   '))

  // Labels
  if (issue.labels.length > 0) {
    const labelNames = issue.labels.map((l) => l.name).join(', ')
    console.log(`Labels: ${labelNames}`)
  }

  // Description
  if (issue.description) {
    console.log('')
    console.log(pc.bold('Description:'))
    console.log(`  ${issue.description}`)
  }

  // Parent
  if (issue.parent) {
    const parentIcon = TYPE_ICON[issue.parent.type] ?? ''
    console.log('')
    console.log(
      `Parent: #${issue.parent.number} [${parentIcon} ${issue.parent.type}] ${issue.parent.title}`,
    )
  }

  // Children
  if (issue.children.length > 0) {
    console.log('')
    console.log(pc.bold('Children:'))
    const table = new Table({
      head: ['#', 'TYPE', 'TITLE', 'STATUS'],
      style: { head: ['cyan'] },
    })
    for (const child of issue.children) {
      const childIcon = TYPE_ICON[child.type] ?? ''
      const childStatusColor = STATUS_COLOR[child.status] ?? pc.white
      table.push([
        String(child.number),
        `${childIcon} ${child.type}`,
        child.title,
        childStatusColor(child.status),
      ])
    }
    console.log(table.toString())
  }

  // Relations
  if (issue.relations.length > 0) {
    console.log('')
    console.log(pc.bold('Relations:'))
    for (const rel of issue.relations) {
      const label = formatRelationLabel(rel, issue.id)
      console.log(`  ${label}`)
    }
  }

  // Agent results
  if (issue.agentSummary || issue.commits?.length || issue.pullRequests?.length) {
    console.log('')
    console.log(pc.bold('Agent:'))
    if (issue.agentSummary) {
      console.log(`  Summary: ${issue.agentSummary}`)
    }
    if (issue.commits && issue.commits.length > 0) {
      console.log(`  Commits: ${issue.commits.join(', ')}`)
    }
    if (issue.pullRequests && issue.pullRequests.length > 0) {
      console.log(`  PRs: ${issue.pullRequests.join(', ')}`)
    }
  }
}

/**
 * Format a relation label based on the relation type and direction.
 *
 * @param relation - The issue relation to format
 * @param currentIssueId - The ID of the issue being viewed
 */
function formatRelationLabel(relation: IssueRelation, currentIssueId: string): string {
  const isSource = relation.issueId === currentIssueId
  const targetId = isSource ? relation.relatedIssueId : relation.issueId
  const type = relation.type

  if (type === 'blocks') {
    return isSource ? `blocks ${targetId}` : `blocked by ${targetId}`
  }
  if (type === 'relates_to') {
    return `relates to ${targetId}`
  }
  if (type === 'duplicates') {
    return isSource ? `duplicates ${targetId}` : `duplicated by ${targetId}`
  }
  return `${type} ${targetId}`
}

/** Register the `show <id>` command for displaying full issue detail. */
export function registerShowCommand(program: Command): void {
  program
    .command('show <id>')
    .description('Show full issue detail')
    .action(async (id: string) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const result = await api
          .get(`api/issues/${id}`)
          .json<SingleResponse<IssueDetail>>()

        output(result, globalOpts, () => renderIssueDetail(result.data))
      })
    })
}
