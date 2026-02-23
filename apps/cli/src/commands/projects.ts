import { Command } from 'commander';
import Table from 'cli-table3';
import pc from 'picocolors';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output, formatDate, truncate } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { Project } from '@dork-labs/loop-types';

/** Color map for project health indicators. */
const HEALTH_COLOR: Record<string, (s: string) => string> = {
  on_track: pc.green,
  at_risk: pc.yellow,
  off_track: pc.red,
};

/** Color map for project statuses. */
const PROJECT_STATUS_COLOR: Record<string, (s: string) => string> = {
  backlog: pc.dim,
  planned: pc.cyan,
  active: pc.blue,
  on_hold: pc.yellow,
  completed: pc.green,
};

/** Render a list of projects as a formatted table. */
function renderProjectTable(projects: Project[]): void {
  const table = new Table({
    head: ['ID', 'NAME', 'STATUS', 'HEALTH', 'CREATED'],
    style: { head: ['cyan'] },
  });

  for (const project of projects) {
    const statusColor = PROJECT_STATUS_COLOR[project.status] ?? pc.white;
    const healthColor = HEALTH_COLOR[project.health] ?? pc.white;

    table.push([
      pc.dim(project.id.slice(0, 8)),
      truncate(project.name, 40),
      statusColor(project.status),
      healthColor(project.health),
      formatDate(project.createdAt),
    ]);
  }

  console.log(table.toString());
}

/** Register the `projects` command group. */
export function registerProjectsCommand(program: Command): void {
  const projects = program.command('projects').description('Manage projects');

  projects
    .command('list')
    .description('List all projects')
    .option('--limit <n>', 'Maximum number of projects to return', '50')
    .option('--offset <n>', 'Number of projects to skip', '0')
    .action(async (opts: { limit: string; offset: string }, cmd) => {
      const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);
        const result = await client.projects.list({
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });

        output(
          result,
          globalOpts,
          () => {
            if (result.data.length === 0) {
              console.log(pc.dim('No projects found.'));
              return;
            }
            console.log(pc.dim(`Showing ${result.data.length} of ${result.total} projects\n`));
            renderProjectTable(result.data);
          },
          () => {
            for (const p of result.data) {
              console.log([p.id, p.name, p.status, p.health].join('\t'));
            }
          }
        );
      });
    });
}
