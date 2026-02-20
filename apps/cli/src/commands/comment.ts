import { Command } from 'commander'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output } from '../lib/output.js'

/** Register the `comment` command to add a comment to an issue. */
export function registerCommentCommand(program: Command): void {
  program
    .command('comment <issueId> <body>')
    .description('Add a comment to an issue')
    .action(async (issueId: string, body: string) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)
        const result = await api
          .post(`api/issues/${issueId}/comments`, {
            json: { body, authorName: 'looped-cli', authorType: 'human' },
          })
          .json()
        output(result, globalOpts, () => {
          console.log(`Comment added to issue ${issueId}`)
        })
      })
    })
}
