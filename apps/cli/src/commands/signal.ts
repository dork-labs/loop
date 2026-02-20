import { Command } from 'commander'
import { createApiClient } from '../lib/api-client.js'
import { withErrorHandler } from '../lib/errors.js'
import { output } from '../lib/output.js'
import type { Signal, Issue, SingleResponse } from '../types.js'

/** Register the `signal` command for submitting manual signals. */
export function registerSignalCommand(program: Command): void {
  program
    .command('signal <message>')
    .description('Submit a manual signal')
    .option('--source <s>', 'Signal source identifier', 'manual')
    .option('--severity <sev>', 'Signal severity (critical, high, medium, low)', 'medium')
    .option('--project <id>', 'Project ID')
    .action(async (message: string, opts) => {
      await withErrorHandler(async () => {
        const globalOpts = program.opts()
        const api = createApiClient(globalOpts)

        const body: Record<string, unknown> = {
          source: opts.source,
          type: 'manual-signal',
          severity: opts.severity,
          payload: { message },
        }
        if (opts.project) {
          body.projectId = opts.project
        }

        const result = await api
          .post('api/signals', { json: body })
          .json<SingleResponse<{ signal: Signal; issue: Issue }>>()

        output(result, globalOpts, () => {
          console.log(`Signal created: ${result.data.signal.id}`)
          console.log(`Linked issue: #${result.data.issue.number} ${result.data.issue.title}`)
        })
      })
    })
}
