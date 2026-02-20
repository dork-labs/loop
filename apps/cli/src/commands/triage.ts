import { Command } from 'commander'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output, renderIssueTable } from '../lib/output.js'
import type { PaginatedResponse, Issue, SingleResponse } from '../types.js'

/** Register the `triage` command with list, accept, and decline subcommands. */
export function registerTriageCommand(program: Command): void {
  const triage = program
    .command('triage')
    .description('View and manage triage queue')
    .action(async () => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const result = await api
          .get('api/issues', { searchParams: { status: 'triage' } })
          .json<PaginatedResponse<Issue>>()

        output(result, globalOpts, () => renderIssueTable(result.data))
      })
    })

  triage
    .command('accept <id>')
    .description('Accept a triage issue into backlog')
    .action(async (id: string) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const result = await api
          .patch(`api/issues/${id}`, { json: { status: 'backlog' } })
          .json<SingleResponse<Issue>>()

        output(result, globalOpts, () => {
          console.log(`Issue ${id} accepted into backlog`)
        })
      })
    })

  triage
    .command('decline <id> [reason]')
    .description('Decline a triage issue (cancel with optional reason)')
    .action(async (id: string, reason?: string) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const result = await api
          .patch(`api/issues/${id}`, { json: { status: 'canceled' } })
          .json<SingleResponse<Issue>>()

        if (reason) {
          try {
            await api
              .post(`api/issues/${id}/comments`, {
                json: { body: reason, authorName: 'looped-cli', authorType: 'human' },
              })
              .json()
          } catch {
            console.error('Warning: issue declined but reason comment could not be saved.')
          }
        }

        output(result, globalOpts, () => {
          console.log(`Issue ${id} declined`)
        })
      })
    })
}
