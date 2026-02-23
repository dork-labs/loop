import { Command } from 'commander';
import Table from 'cli-table3';
import pc from 'picocolors';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import {
  output,
  renderIssueTable,
  renderIssueTablePlain,
  STATUS_COLOR,
  PRIORITY_LABEL,
  TYPE_ICON,
} from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { IssueDetail, IssueRelation, IssueType, CreateIssueParams } from '@dork-labs/loop-types';

const ISSUE_TYPES: IssueType[] = ['signal', 'hypothesis', 'plan', 'task', 'monitor'];

const PRIORITY_CHOICES = [
  { name: '0 — none', value: '0' },
  { name: '1 — urgent', value: '1' },
  { name: '2 — high', value: '2' },
  { name: '3 — medium', value: '3' },
  { name: '4 — low', value: '4' },
];

/** Register the `issues` command group with list, view, create, start, done subcommands. */
export function registerIssuesCommand(program: Command): void {
  const issues = program.command('issues').description('Manage issues');

  // -- list
  issues
    .command('list')
    .description('List issues with optional filters')
    .option('--status <status>', 'Filter by status')
    .option('--type <type>', 'Filter by issue type')
    .option('--project <id>', 'Filter by project ID')
    .option('--priority <n>', 'Filter by priority (0-4)')
    .option('--limit <n>', 'Results per page', '50')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        const params: Record<string, unknown> = {
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        };
        if (opts.status) params.status = opts.status;
        if (opts.type) params.type = opts.type;
        if (opts.project) params.projectId = opts.project;
        if (opts.priority) params.priority = Number(opts.priority);

        const result = await client.issues.list(params);

        output(
          result,
          globalOpts,
          () => renderIssueTable(result.data),
          () => renderIssueTablePlain(result.data)
        );
      });
    });

  // -- view
  issues
    .command('view <id>')
    .description('Show full issue detail')
    .action(async (id: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        const issue = await client.issues.get(id);

        output(
          issue,
          globalOpts,
          () => renderIssueDetail(issue),
          () => {
            console.log(
              [issue.id, issue.number, issue.type, issue.title, issue.status, issue.priority].join(
                '\t'
              )
            );
          }
        );
      });
    });

  // -- create
  issues
    .command('create <title>')
    .description('Create a new issue')
    .option('--type <type>', 'Issue type (signal, hypothesis, plan, task, monitor)')
    .option('--priority <n>', 'Priority (0-4)')
    .option('--project <id>', 'Project ID')
    .option('--description <text>', 'Issue description')
    .option('--parent <id>', 'Parent issue ID')
    .action(async (title: string, opts) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        const issueType = await resolveType(opts.type);
        const priority = await resolvePriority(opts.priority);

        const body: CreateIssueParams = {
          title,
          type: issueType as IssueType,
          priority: Number(priority),
          ...(opts.project && { projectId: opts.project }),
          ...(opts.description && { description: opts.description }),
          ...(opts.parent && { parentId: opts.parent }),
        };

        const issue = await client.issues.create(body);

        output(
          issue,
          globalOpts,
          () => {
            const icon = TYPE_ICON[issue.type] ?? '';
            console.log(`Created #${issue.number} [${icon} ${issue.type}] ${issue.title}`);
          },
          () => {
            console.log(
              [issue.id, issue.number, issue.type, issue.title, issue.priority, issue.status].join(
                '\t'
              )
            );
          }
        );
      });
    });

  // -- start
  issues
    .command('start <id>')
    .description('Start working on an issue (sets status to in_progress)')
    .action(async (id: string) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        // Transition to in_progress
        await client.issues.update(id, { status: 'in_progress' });

        // Fetch full detail with context
        const detail = await client.issues.get(id);

        output(
          detail,
          globalOpts,
          () => {
            const icon = TYPE_ICON[detail.type] ?? '';
            console.log(pc.green(`Issue #${detail.number} is now in_progress`));
            console.log(`  ${icon} ${detail.title}`);
            if (detail.description) {
              console.log(`\n${pc.bold('Description:')}`);
              console.log(`  ${detail.description}`);
            }
          },
          () => {
            console.log([detail.id, detail.number, detail.title, 'in_progress'].join('\t'));
          }
        );
      });
    });

  // -- done
  issues
    .command('done <id>')
    .description('Mark an issue as complete with outcome notes')
    .option('--outcome <text>', 'Outcome description')
    .action(async (id: string, opts) => {
      const globalOpts = program.opts<GlobalOptions>();
      await withErrorHandler(async () => {
        const client = createClient(globalOpts);

        // Mark as done
        const issue = await client.issues.update(id, { status: 'done' });

        // Add outcome comment if provided
        if (opts.outcome) {
          await client.comments.create(id, {
            body: opts.outcome,
            authorName: 'loop-cli',
            authorType: 'human',
          });
        }

        output(
          issue,
          globalOpts,
          () => {
            console.log(pc.green(`Issue #${issue.number} marked as done`));
            if (opts.outcome) {
              console.log(`  Outcome: ${opts.outcome}`);
            }
          },
          () => {
            console.log([issue.id, issue.number, issue.title, 'done'].join('\t'));
          }
        );
      });
    });
}

/**
 * Render a single issue detail view with all sections.
 *
 * @param issue - The full issue detail object to render
 */
function renderIssueDetail(issue: IssueDetail): void {
  const icon = TYPE_ICON[issue.type] ?? '';
  const statusColor = STATUS_COLOR[issue.status] ?? pc.white;
  const priorityLabel = PRIORITY_LABEL[issue.priority] ?? String(issue.priority);

  // Header
  console.log(`#${issue.number} [${icon} ${issue.type}] ${issue.title}`);

  // Metadata
  const meta = [`Status: ${statusColor(issue.status)}`, `Priority: ${priorityLabel}`];
  if (issue.projectId) meta.push(`Project: ${issue.projectId}`);
  console.log(meta.join('   '));

  // Labels
  if (issue.labels.length > 0) {
    const labelNames = issue.labels.map((l) => l.name).join(', ');
    console.log(`Labels: ${labelNames}`);
  }

  // Description
  if (issue.description) {
    console.log('');
    console.log(pc.bold('Description:'));
    console.log(`  ${issue.description}`);
  }

  // Parent
  if (issue.parent) {
    const parentIcon = TYPE_ICON[issue.parent.type] ?? '';
    console.log('');
    console.log(
      `Parent: #${issue.parent.number} [${parentIcon} ${issue.parent.type}] ${issue.parent.title}`
    );
  }

  // Children
  if (issue.children.length > 0) {
    console.log('');
    console.log(pc.bold('Children:'));
    const table = new Table({
      head: ['#', 'TYPE', 'TITLE', 'STATUS'],
      style: { head: ['cyan'] },
    });
    for (const child of issue.children) {
      const childIcon = TYPE_ICON[child.type] ?? '';
      const childStatusColor = STATUS_COLOR[child.status] ?? pc.white;
      table.push([
        String(child.number),
        `${childIcon} ${child.type}`,
        child.title,
        childStatusColor(child.status),
      ]);
    }
    console.log(table.toString());
  }

  // Relations
  if (issue.relations.length > 0) {
    console.log('');
    console.log(pc.bold('Relations:'));
    for (const rel of issue.relations) {
      const label = formatRelationLabel(rel, issue.id);
      console.log(`  ${label}`);
    }
  }

  // Agent results
  if (issue.agentSummary || issue.commits?.length || issue.pullRequests?.length) {
    console.log('');
    console.log(pc.bold('Agent:'));
    if (issue.agentSummary) {
      console.log(`  Summary: ${issue.agentSummary}`);
    }
    if (issue.commits && issue.commits.length > 0) {
      console.log(`  Commits: ${issue.commits.map((c) => c.sha).join(', ')}`);
    }
    if (issue.pullRequests && issue.pullRequests.length > 0) {
      console.log(`  PRs: ${issue.pullRequests.map((pr) => `#${pr.number}`).join(', ')}`);
    }
  }
}

/**
 * Format a relation label based on the relation type and direction.
 *
 * @param relation - The issue relation to format
 * @param currentIssueId - The ID of the issue being viewed
 */
function formatRelationLabel(relation: IssueRelation, currentIssueId: string): string {
  const isSource = relation.issueId === currentIssueId;
  const targetId = isSource ? relation.relatedIssueId : relation.issueId;
  const type = relation.type;

  if (type === 'blocks') {
    return isSource ? `blocks ${targetId}` : `blocked by ${targetId}`;
  }
  if (type === 'related') {
    return `relates to ${targetId}`;
  }
  if (type === 'duplicate') {
    return isSource ? `duplicates ${targetId}` : `duplicated by ${targetId}`;
  }
  return `${type} ${targetId}`;
}

/**
 * Resolve issue type from flag or interactive prompt.
 * Falls back to 'task' in non-TTY environments.
 */
async function resolveType(flagValue: string | undefined): Promise<string> {
  if (flagValue) return flagValue;

  if (!process.stdout.isTTY) return 'task';

  const { select } = await import('@inquirer/prompts');
  return select({
    message: 'Issue type:',
    choices: ISSUE_TYPES.map((t) => ({
      name: `${TYPE_ICON[t] ?? ''} ${t}`,
      value: t,
    })),
    default: 'task',
  });
}

/**
 * Resolve priority from flag or interactive prompt.
 * Falls back to '3' (medium) in non-TTY environments.
 */
async function resolvePriority(flagValue: string | undefined): Promise<string> {
  if (flagValue !== undefined) return flagValue;

  if (!process.stdout.isTTY) return '3';

  const { select } = await import('@inquirer/prompts');
  return select({
    message: 'Priority:',
    choices: PRIORITY_CHOICES,
    default: '3',
  });
}
