import { Command } from 'commander';
import pc from 'picocolors';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output, STATUS_COLOR } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { DashboardStats } from '@dork-labs/loop-types';

/** Register the `dashboard` command for displaying system health overview. */
export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .description('Show system health overview')
    .action(async (_opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
        const client = createClient(globalOpts);

        const stats = await client.dashboard.stats();

        output(
          stats,
          globalOpts,
          () => renderStatus(stats),
          () => renderStatusPlain(stats)
        );
      });
    });
}

/** Render dashboard stats as a formatted terminal overview. */
function renderStatus(stats: DashboardStats): void {
  const { issues, goals, dispatch } = stats;

  // Header
  console.log(pc.bold(pc.cyan('\n  Loop System Status\n')));

  // Issues section
  console.log(pc.bold('  Issues'));
  console.log(`    Total: ${pc.white(String(issues.total))}`);
  console.log();

  // Status breakdown
  console.log(pc.dim('    By Status:'));
  for (const [status, count] of Object.entries(issues.byStatus)) {
    const colorFn = STATUS_COLOR[status] ?? pc.white;
    console.log(`      ${colorFn(status.padEnd(12))} ${pc.white(String(count))}`);
  }
  console.log();

  // Type breakdown
  console.log(pc.dim('    By Type:'));
  for (const [type, count] of Object.entries(issues.byType)) {
    console.log(`      ${type.padEnd(12)} ${pc.white(String(count))}`);
  }
  console.log();

  // Dispatch section
  console.log(pc.bold('  Dispatch'));
  console.log(`    Queue depth:     ${formatCount(dispatch.queueDepth)}`);
  console.log(`    Active:          ${formatCount(dispatch.activeCount)}`);
  console.log(`    Done (24h):      ${formatCount(dispatch.completedLast24h)}`);
  console.log();

  // Goals section
  console.log(pc.bold('  Goals'));
  console.log(`    Total:           ${pc.white(String(goals.total))}`);
  console.log(`    Active:          ${pc.blue(String(goals.active))}`);
  console.log(`    Achieved:        ${pc.green(String(goals.achieved))}`);
  console.log();
}

/** Render dashboard stats as tab-separated plain text. */
function renderStatusPlain(stats: DashboardStats): void {
  console.log(['issues_total', stats.issues.total].join('\t'));
  console.log(['queue_depth', stats.dispatch.queueDepth].join('\t'));
  console.log(['active', stats.dispatch.activeCount].join('\t'));
  console.log(['done_24h', stats.dispatch.completedLast24h].join('\t'));
  console.log(['goals_total', stats.goals.total].join('\t'));
  console.log(['goals_achieved', stats.goals.achieved].join('\t'));
}

/** Format a count with color emphasis for non-zero values. */
function formatCount(count: number): string {
  return count > 0 ? pc.white(String(count)) : pc.dim('0');
}
