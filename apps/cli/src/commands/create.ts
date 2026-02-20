import { Command } from 'commander'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output, TYPE_ICON } from '../lib/output.js'
import type { IssueType, Issue, SingleResponse, PaginatedResponse, Project } from '../types.js'

const ISSUE_TYPES: IssueType[] = ['signal', 'hypothesis', 'plan', 'task', 'monitor']

const PRIORITY_CHOICES = [
  { name: '0 — none', value: '0' },
  { name: '1 — urgent', value: '1' },
  { name: '2 — high', value: '2' },
  { name: '3 — medium', value: '3' },
  { name: '4 — low', value: '4' },
]

/** Register the `create` command for creating new issues. */
export function registerCreateCommand(program: Command): void {
  program
    .command('create <title>')
    .description('Create a new issue')
    .option('--type <type>', 'Issue type (signal, hypothesis, plan, task, monitor)')
    .option('--priority <n>', 'Priority (0-4)')
    .option('--project <id>', 'Project ID')
    .option('--description <text>', 'Issue description')
    .option('--parent <id>', 'Parent issue ID')
    .action(async (title: string, opts) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const issueType = await resolveType(opts.type)
        const priority = await resolvePriority(opts.priority)
        const projectId = await resolveProject(opts.project, api)

        const body: Record<string, unknown> = {
          title,
          type: issueType,
          priority: Number(priority),
        }
        if (projectId) body.projectId = projectId
        if (opts.description) body.description = opts.description
        if (opts.parent) body.parentId = opts.parent

        const result = await api
          .post('api/issues', { json: body })
          .json<SingleResponse<Issue>>()

        output(result, globalOpts, () => {
          const icon = TYPE_ICON[result.data.type] ?? ''
          console.log(
            `Created #${result.data.number} [${icon} ${result.data.type}] ${result.data.title}`,
          )
        })
      })
    })
}

/**
 * Resolve issue type from flag or interactive prompt.
 * Falls back to 'task' in non-TTY environments.
 */
async function resolveType(flagValue: string | undefined): Promise<string> {
  if (flagValue) return flagValue

  if (!process.stdout.isTTY) return 'task'

  const { select } = await import('@inquirer/prompts')
  return select({
    message: 'Issue type:',
    choices: ISSUE_TYPES.map((t) => ({
      name: `${TYPE_ICON[t] ?? ''} ${t}`,
      value: t,
    })),
    default: 'task',
  })
}

/**
 * Resolve priority from flag or interactive prompt.
 * Falls back to '3' (medium) in non-TTY environments.
 */
async function resolvePriority(flagValue: string | undefined): Promise<string> {
  if (flagValue !== undefined) return flagValue

  if (!process.stdout.isTTY) return '3'

  const { select } = await import('@inquirer/prompts')
  return select({
    message: 'Priority:',
    choices: PRIORITY_CHOICES,
    default: '3',
  })
}

/**
 * Resolve project ID from flag or interactive prompt.
 * Falls back to undefined in non-TTY environments.
 */
async function resolveProject(
  flagValue: string | undefined,
  api: ReturnType<typeof createApiClient>,
): Promise<string | undefined> {
  if (flagValue) return flagValue

  if (!process.stdout.isTTY) return undefined

  const { select } = await import('@inquirer/prompts')
  const result = await api.get('api/projects').json<PaginatedResponse<Project>>()

  if (result.data.length === 0) return undefined

  const choices = [
    { name: '(none)', value: '' },
    ...result.data.map((p) => ({ name: p.name, value: p.id })),
  ]

  const selected = await select({
    message: 'Project:',
    choices,
    default: '',
  })

  return selected || undefined
}
