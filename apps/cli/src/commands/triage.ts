import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output, renderIssueTable, renderIssueTablePlain } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';

/** Register the `triage` command with list, accept, and decline subcommands. */
export function registerTriageCommand(program: Command): void {
  const triage = program
    .command('triage')
    .description('View and manage triage queue')
    .action(async (_opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
        const client = createClient(globalOpts);

        const result = await client.issues.list({ status: 'triage' });

        output(
          result,
          globalOpts,
          () => renderIssueTable(result.data),
          () => renderIssueTablePlain(result.data)
        );
      });
    });

  triage
    .command('accept <id>')
    .description('Accept a triage issue into backlog')
    .action(async (id: string, _opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
        const client = createClient(globalOpts);

        const issue = await client.issues.update(id, { status: 'backlog' });

        output(
          { data: issue },
          globalOpts,
          () => {
            console.log(`Issue ${id} accepted into backlog`);
          },
          () => {
            console.log([issue.id, issue.number, issue.title, 'backlog'].join('\t'));
          }
        );
      });
    });

  triage
    .command('decline <id> [reason]')
    .description('Decline a triage issue (cancel with optional reason)')
    .action(async (id: string, reason: string | undefined, _opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
        const client = createClient(globalOpts);

        const issue = await client.issues.update(id, { status: 'canceled' });

        if (reason) {
          try {
            await client.comments.create(id, {
              body: reason,
              authorName: 'loop-cli',
              authorType: 'human',
            });
          } catch {
            console.error('Warning: issue declined but reason comment could not be saved.');
          }
        }

        output(
          { data: issue },
          globalOpts,
          () => {
            console.log(`Issue ${id} declined`);
          },
          () => {
            console.log([issue.id, issue.number, issue.title, 'canceled'].join('\t'));
          }
        );
      });
    });
}
