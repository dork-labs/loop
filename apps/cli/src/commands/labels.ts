import { Command } from 'commander';
import Table from 'cli-table3';
import pc from 'picocolors';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output, formatDate } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { Label } from '@dork-labs/loop-types';

/** Render labels as a formatted table. */
function renderLabelTable(labels: Label[]): void {
  const table = new Table({
    head: ['ID', 'NAME', 'COLOR', 'CREATED'],
    style: { head: ['cyan'] },
  });

  for (const label of labels) {
    table.push([
      label.id,
      label.name,
      pc.bold(label.color),
      formatDate(label.createdAt),
    ]);
  }

  console.log(table.toString());
}

/** Register the `labels` command group on the given program. */
export function registerLabelsCommand(program: Command): void {
  const labels = program.command('labels').description('Manage labels');

  labels
    .command('list')
    .description('List all labels')
    .option('--limit <n>', 'Maximum number of results', '50')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        const result = await client.labels.list({
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });

        output(
          result,
          globalOpts,
          () => {
            if (result.data.length === 0) {
              console.log(pc.dim('No labels found.'));
              return;
            }
            renderLabelTable(result.data);
            console.log(pc.dim(`\nShowing ${result.data.length} of ${result.total} labels`));
          },
          () => {
            for (const l of result.data) {
              console.log([l.id, l.name, l.color, formatDate(l.createdAt)].join('\t'));
            }
          }
        );
      });
    });

  labels
    .command('create')
    .description('Create a new label')
    .requiredOption('--name <name>', 'Label name')
    .requiredOption('--color <color>', 'Label color (hex code)')
    .action(async (opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        const label = await client.labels.create({
          name: opts.name,
          color: opts.color,
        });

        output(
          label,
          globalOpts,
          () => {
            console.log(`Label created: ${pc.bold(label.name)} (${label.id})`);
          },
          () => {
            console.log([label.id, label.name, label.color].join('\t'));
          }
        );
      });
    });

  labels
    .command('delete')
    .description('Delete a label')
    .argument('<id>', 'Label ID to delete')
    .action(async (id, _opts, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        await client.labels.delete(id);

        output(
          { deleted: true, id },
          globalOpts,
          () => {
            console.log(`Label ${id} deleted.`);
          },
          () => {
            console.log(id);
          }
        );
      });
    });
}
