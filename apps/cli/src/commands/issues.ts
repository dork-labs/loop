import { Command } from 'commander'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output, renderIssueTable } from '../lib/output.js'
import type { PaginatedResponse, Issue } from '../types.js'

/** Register the `list` command for listing issues with optional filters. */
export function registerIssuesCommand(program: Command): void {
  program
    .command('list')
    .description('List issues with optional filters')
    .option('--status <status>', 'Filter by status')
    .option('--type <type>', 'Filter by issue type')
    .option('--project <id>', 'Filter by project ID')
    .option('--priority <n>', 'Filter by priority (0-4)')
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
        if (opts.status) searchParams.status = opts.status
        if (opts.type) searchParams.type = opts.type
        if (opts.project) searchParams.projectId = opts.project
        if (opts.priority) searchParams.priority = opts.priority

        const result = await api
          .get('api/issues', { searchParams })
          .json<PaginatedResponse<Issue>>()

        output(result, globalOpts, () => renderIssueTable(result.data))
      })
    })
}
