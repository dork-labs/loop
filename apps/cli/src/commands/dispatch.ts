import { Command } from 'commander';
import pc from 'picocolors';
import Table from 'cli-table3';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output, TYPE_ICON, PRIORITY_LABEL, STATUS_COLOR, truncate } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { DispatchNextResponse, DispatchQueueItem } from '@dork-labs/loop-types';

/**
 * Register the `next` and `dispatch` top-level commands.
 *
 * - `loop next` — Claim the highest-priority unblocked issue with dispatch instructions.
 * - `loop dispatch queue` — Preview the dispatch queue without claiming.
 */
export function registerDispatchCommand(program: Command): void {
  // -- next (top-level, signature command)
  program
    .command('next')
    .description('Claim the next highest-priority issue with dispatch instructions')
    .option('--project <id>', 'Filter by project ID')
    .action(async (opts) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        const params = opts.project ? { projectId: opts.project } : undefined;
        const result = await client.dispatch.next(params);

        if (!result) {
          output(
            null,
            globalOpts,
            () => {
              console.log(pc.dim('No issues ready for dispatch.'));
            },
            () => {
              // No output for empty queue in plain mode
            }
          );
          return;
        }

        output(
          result,
          globalOpts,
          () => renderDispatchResult(result),
          () => {
            const { issue, prompt } = result;
            console.log(
              [issue.id, issue.number, issue.type, issue.title, issue.priority, issue.status].join(
                '\t'
              )
            );
            if (prompt) console.log(prompt);
          }
        );
      });
    });

  // -- dispatch queue
  const dispatch = program.command('dispatch').description('Dispatch queue operations');

  dispatch
    .command('queue')
    .description('Preview the dispatch queue (priority-ordered unblocked issues)')
    .option('--project <id>', 'Filter by project ID')
    .option('--limit <n>', 'Max items to show', '10')
    .action(async (opts) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        const params: Record<string, unknown> = {
          limit: Number(opts.limit),
          offset: 0,
        };
        if (opts.project) params.projectId = opts.project;

        const result = await client.dispatch.queue(params);

        output(
          result,
          globalOpts,
          () => renderQueueTable(result.data, result.total),
          () => {
            for (let i = 0; i < result.data.length; i++) {
              const { issue, score } = result.data[i];
              console.log(
                [i + 1, issue.number, issue.type, issue.title, issue.priority, score].join('\t')
              );
            }
          }
        );
      });
    });
}

/**
 * Render a dispatched issue with its prompt instructions.
 * This is the rich output for `loop next`.
 */
function renderDispatchResult(result: DispatchNextResponse): void {
  const { issue, prompt, meta } = result;
  const type = String(issue.type ?? '');
  const icon = TYPE_ICON[type] ?? '';
  const priority = Number(issue.priority ?? 3);
  const status = String(issue.status ?? '');
  const colorStatus = (STATUS_COLOR[status] ?? pc.white)(status);

  // Header
  console.log(pc.bold(`\n#${issue.number} [${icon} ${type}] ${issue.title}`));
  console.log(`  Status:   ${colorStatus}`);
  console.log(`  Priority: ${PRIORITY_LABEL[priority] ?? String(priority)}`);
  console.log(`  ID:       ${pc.dim(issue.id)}`);

  // Template meta
  if (meta) {
    console.log('');
    console.log(pc.bold('Template:'));
    console.log(`  Slug:    ${meta.templateSlug}`);
    console.log(`  Version: ${meta.versionNumber}`);
  }

  // Prompt instructions
  if (prompt) {
    console.log('');
    console.log(pc.bold('Instructions:'));
    console.log(pc.dim('─'.repeat(60)));
    console.log(prompt);
    console.log(pc.dim('─'.repeat(60)));
  } else {
    console.log('');
    console.log(pc.yellow('No prompt template matched this issue.'));
  }
}

/**
 * Render the dispatch queue as a formatted table.
 * Columns: RANK, #, TYPE, TITLE, PRI, SCORE, BREAKDOWN
 */
function renderQueueTable(items: DispatchQueueItem[], total: number): void {
  if (items.length === 0) {
    console.log(pc.dim('No issues in the dispatch queue.'));
    return;
  }

  const table = new Table({
    head: ['RANK', '#', 'TYPE', 'TITLE', 'PRI', 'SCORE', 'BREAKDOWN'],
    style: { head: ['cyan'] },
  });

  for (let i = 0; i < items.length; i++) {
    const { issue, score, breakdown } = items[i];
    const type = String(issue.type ?? '');
    const icon = TYPE_ICON[type] ?? '';
    const priority = Number(issue.priority ?? 3);

    const breakdownParts = [];
    if (breakdown.priorityWeight > 0) breakdownParts.push(`pri:${breakdown.priorityWeight}`);
    if (breakdown.goalBonus > 0) breakdownParts.push(`goal:${breakdown.goalBonus}`);
    if (breakdown.ageBonus > 0) breakdownParts.push(`age:${breakdown.ageBonus}`);
    if (breakdown.typeBonus > 0) breakdownParts.push(`type:${breakdown.typeBonus}`);

    table.push([
      pc.dim(String(i + 1)),
      String(issue.number ?? ''),
      `${icon} ${type}`,
      truncate(String(issue.title ?? ''), 40),
      PRIORITY_LABEL[priority] ?? String(priority),
      pc.bold(String(score)),
      pc.dim(breakdownParts.join(' + ')),
    ]);
  }

  console.log(table.toString());
  console.log(pc.dim(`\nShowing ${items.length} of ${total} queued issues`));
}
