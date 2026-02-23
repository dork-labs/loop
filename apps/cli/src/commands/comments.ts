import { Command } from 'commander';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';

/** Register the `comments` command group on the given program. */
export function registerCommentsCommand(program: Command): void {
  const comments = program.command('comments').description('Manage issue comments');

  comments
    .command('add <issueId> <body>')
    .description('Add a comment to an issue')
    .action(async (issueId: string, body: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);
        const result = await client.comments.create(issueId, {
          body,
          authorName: 'loop-cli',
          authorType: 'human',
        });
        output(
          result,
          globalOpts,
          () => {
            console.log(`Comment added to issue ${issueId}`);
          },
          () => {
            console.log([result.id, issueId].join('\t'));
          }
        );
      });
    });
}
