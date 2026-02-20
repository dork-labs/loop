import { Command } from 'commander'
import Table from 'cli-table3'
import pc from 'picocolors'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output, formatDate, truncate } from '../lib/output.js'
import type {
  PaginatedResponse,
  SingleResponse,
  PromptTemplate,
  PromptVersion,
} from '../types.js'

/** Color map for version statuses. */
const VERSION_STATUS_COLOR: Record<string, (s: string) => string> = {
  active: pc.green,
  draft: pc.yellow,
  retired: pc.dim,
}

/** Register the `templates` command group with list, show, and promote subcommands. */
export function registerTemplatesCommand(program: Command): void {
  const templates = program
    .command('templates')
    .description('Manage prompt templates and versions')

  // ── list ──────────────────────────────────────────────────────────────────
  templates
    .command('list')
    .description('List prompt templates')
    .option('--limit <n>', 'Results per page', '50')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const searchParams: Record<string, string> = {
          limit: opts.limit,
          offset: opts.offset,
        }

        const result = await api
          .get('api/templates', { searchParams })
          .json<PaginatedResponse<PromptTemplate>>()

        output(result, globalOpts, () => renderTemplateTable(result.data, result.total))
      })
    })

  // ── show ──────────────────────────────────────────────────────────────────
  templates
    .command('show <id>')
    .description('Show template details with active version and version history')
    .action(async (id: string) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const [templateRes, versionsRes] = await Promise.all([
          api.get(`api/templates/${id}`).json<SingleResponse<PromptTemplate & { activeVersion?: PromptVersion | null }>>(),
          api.get(`api/templates/${id}/versions`, { searchParams: { limit: '10' } }).json<PaginatedResponse<PromptVersion>>(),
        ])

        const combined = {
          ...templateRes.data,
          versions: versionsRes.data,
        }

        output(combined, globalOpts, () => renderTemplateDetail(templateRes.data, versionsRes.data))
      })
    })

  // ── promote ───────────────────────────────────────────────────────────────
  templates
    .command('promote <templateId> <versionId>')
    .description('Promote a version to active')
    .action(async (templateId: string, versionId: string) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const result = await api
          .post(`api/templates/${templateId}/versions/${versionId}/promote`)
          .json<SingleResponse<PromptVersion>>()

        output(result, globalOpts, () => {
          console.log(
            pc.green(`Promoted version ${result.data.version} to active for template ${templateId}`),
          )
        })
      })
    })
}

/** Render a list of templates as a formatted table. */
function renderTemplateTable(templates: PromptTemplate[], total: number): void {
  if (templates.length === 0) {
    console.log(pc.dim('No templates found.'))
    return
  }

  const table = new Table({
    head: ['ID', 'SLUG', 'NAME', 'SPECIFICITY', 'ACTIVE VER', 'CREATED'],
    style: { head: ['cyan'] },
  })

  for (const t of templates) {
    table.push([
      t.id.slice(0, 8),
      t.slug,
      truncate(t.name, 40),
      String(t.specificity),
      t.activeVersionId ?? pc.dim('none'),
      formatDate(t.createdAt),
    ])
  }

  console.log(table.toString())
  console.log(pc.dim(`Showing ${templates.length} of ${total} templates`))
}

/** Render detailed view of a template with its versions. */
function renderTemplateDetail(
  template: PromptTemplate & { activeVersion?: PromptVersion | null },
  versions: PromptVersion[],
): void {
  console.log(pc.bold(template.name))
  console.log(pc.dim(`slug: ${template.slug}  |  id: ${template.id}`))
  if (template.description) {
    console.log(`\n${template.description}`)
  }
  console.log(`\nSpecificity: ${template.specificity}`)
  console.log(`Created: ${formatDate(template.createdAt)}`)
  console.log(`Updated: ${formatDate(template.updatedAt)}`)

  if (template.activeVersion) {
    const v = template.activeVersion
    console.log(pc.bold('\nActive Version'))
    console.log(`  Version: ${v.version}`)
    console.log(`  Author:  ${v.authorName} (${v.authorType})`)
    console.log(`  Usage:   ${v.usageCount}`)
    if (v.completionRate !== null && v.completionRate !== undefined) {
      console.log(`  Completion rate: ${(v.completionRate * 100).toFixed(1)}%`)
    }
    if (v.changelog) {
      console.log(`  Changelog: ${v.changelog}`)
    }
  } else {
    console.log(pc.dim('\nNo active version'))
  }

  if (versions.length > 0) {
    console.log(pc.bold('\nVersions'))
    const table = new Table({
      head: ['VER', 'STATUS', 'AUTHOR', 'USAGE', 'COMPLETION', 'CREATED'],
      style: { head: ['cyan'] },
    })

    for (const v of versions) {
      const statusColor = VERSION_STATUS_COLOR[v.status] ?? pc.white
      table.push([
        String(v.version),
        statusColor(v.status),
        v.authorName,
        String(v.usageCount),
        v.completionRate !== null && v.completionRate !== undefined
          ? `${(v.completionRate * 100).toFixed(1)}%`
          : pc.dim('-'),
        formatDate(v.createdAt),
      ])
    }

    console.log(table.toString())
  }
}
