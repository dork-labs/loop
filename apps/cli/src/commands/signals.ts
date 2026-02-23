import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { SignalSeverity } from '@dork-labs/loop-types';

/** Register the `signals` command group on the given program. */
export function registerSignalsCommand(program: Command): void {
  const signals = program.command('signals').description('Manage signals');

  signals
    .command('ingest <message>')
    .description('Submit a manual signal')
    .option('--source <s>', 'Signal source identifier', 'manual')
    .option('--severity <sev>', 'Signal severity (critical, high, medium, low)', 'medium')
    .option('--project <id>', 'Project ID')
    .action(async (message: string, opts) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);
        const result = await client.signals.ingest({
          source: opts.source,
          type: 'manual-signal',
          severity: opts.severity as SignalSeverity,
          payload: { message },
          ...(opts.project ? { projectId: opts.project } : {}),
        });

        output(
          result,
          globalOpts,
          () => {
            console.log(`Signal created: ${result.signal.id}`);
            console.log(`Linked issue: #${result.issue.number} ${result.issue.title}`);
          },
          () => {
            console.log(
              [result.signal.id, result.issue.number, result.issue.title].join('\t')
            );
          }
        );
      });
    });
}
