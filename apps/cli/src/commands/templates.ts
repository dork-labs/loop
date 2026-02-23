import { Command } from 'commander';
import Table from 'cli-table3';
import pc from 'picocolors';
import { createClient } from '../lib/client.js';
import { withErrorHandler } from '../lib/errors.js';
import { output, formatDate, truncate } from '../lib/output.js';
import type { GlobalOptions } from '../lib/config.js';
import type { PromptTemplate, PromptVersion, TemplateDetail } from '@dork-labs/loop-types';

/** Color map for version statuses. */
const VERSION_STATUS_COLOR: Record<string, (s: string) => string> = {
  active: pc.green,
  draft: pc.yellow,
  retired: pc.dim,
};

/** Register the `templates` command group with list, show, and promote subcommands. */
export function registerTemplatesCommand(program: Command): void {
  const templates = program
    .command('templates')
    .description('Manage prompt templates and versions');

  // -- list
  templates
    .command('list')
    .description('List prompt templates')
    .option('--limit <n>', 'Results per page', '50')
    .option('--offset <n>', 'Pagination offset', '0')
    .action(async (opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
        const client = createClient(globalOpts);

        const result = await client.templates.list({
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        });

        output(
          result,
          globalOpts,
          () => renderTemplateTable(result.data, result.total),
          () => {
            for (const t of result.data) {
              console.log(
                [t.id, t.slug, t.name, t.specificity, t.activeVersionId ?? ''].join('\t')
              );
            }
          }
        );
      });
    });

  // -- show
  templates
    .command('show <id>')
    .description('Show template details with active version and version history')
    .action(async (id: string, _opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
        const client = createClient(globalOpts);

        const [templateData, versionsResult] = await Promise.all([
          client.templates.get(id),
          client.templates.versions(id, { limit: 10 }),
        ]);

        const combined = {
          ...templateData,
          versions: versionsResult.data,
        };

        output(
          combined,
          globalOpts,
          () => renderTemplateDetail(templateData, versionsResult.data),
          () => {
            const t = templateData;
            console.log(
              [
                t.id,
                t.slug,
                t.name,
                t.specificity,
                t.activeVersionId ?? '',
                t.activeVersion ? `v${t.activeVersion.version}` : '',
              ].join('\t')
            );
          }
        );
      });
    });

  // -- promote
  templates
    .command('promote <templateId> <versionId>')
    .description('Promote a version to active')
    .action(async (templateId: string, versionId: string, _opts, cmd) => {
      await withErrorHandler(async () => {
        const globalOpts = cmd.optsWithGlobals() as GlobalOptions;
        const client = createClient(globalOpts);

        const version = await client.templates.promote(templateId, versionId);

        output(
          { data: version },
          globalOpts,
          () => {
            console.log(
              pc.green(
                `Promoted version ${version.version} to active for template ${templateId}`
              )
            );
          },
          () => {
            console.log(
              [templateId, versionId, version.version, version.status].join('\t')
            );
          }
        );
      });
    });
}

/** Render a list of templates as a formatted table. */
function renderTemplateTable(templates: PromptTemplate[], total: number): void {
  if (templates.length === 0) {
    console.log(pc.dim('No templates found.'));
    return;
  }

  const table = new Table({
    head: ['ID', 'SLUG', 'NAME', 'SPECIFICITY', 'ACTIVE VER', 'CREATED'],
    style: { head: ['cyan'] },
  });

  for (const t of templates) {
    table.push([
      t.id.slice(0, 8),
      t.slug,
      truncate(t.name, 40),
      String(t.specificity),
      t.activeVersionId ?? pc.dim('none'),
      formatDate(t.createdAt),
    ]);
  }

  console.log(table.toString());
  console.log(pc.dim(`Showing ${templates.length} of ${total} templates`));
}

/** Render detailed view of a template with its versions. */
function renderTemplateDetail(
  template: TemplateDetail,
  versions: PromptVersion[]
): void {
  console.log(pc.bold(template.name));
  console.log(pc.dim(`slug: ${template.slug}  |  id: ${template.id}`));
  if (template.description) {
    console.log(`\n${template.description}`);
  }
  console.log(`\nSpecificity: ${template.specificity}`);
  console.log(`Created: ${formatDate(template.createdAt)}`);
  console.log(`Updated: ${formatDate(template.updatedAt)}`);

  if (template.activeVersion) {
    const v = template.activeVersion;
    console.log(pc.bold('\nActive Version'));
    console.log(`  Version: ${v.version}`);
    console.log(`  Author:  ${v.authorName} (${v.authorType})`);
    console.log(`  Usage:   ${v.usageCount}`);
    if (v.completionRate !== null && v.completionRate !== undefined) {
      console.log(`  Completion rate: ${(v.completionRate * 100).toFixed(1)}%`);
    }
    if (v.changelog) {
      console.log(`  Changelog: ${v.changelog}`);
    }
  } else {
    console.log(pc.dim('\nNo active version'));
  }

  if (versions.length > 0) {
    console.log(pc.bold('\nVersions'));
    const table = new Table({
      head: ['VER', 'STATUS', 'AUTHOR', 'USAGE', 'COMPLETION', 'CREATED'],
      style: { head: ['cyan'] },
    });

    for (const v of versions) {
      const statusColor = VERSION_STATUS_COLOR[v.status] ?? pc.white;
      table.push([
        String(v.version),
        statusColor(v.status),
        v.authorName,
        String(v.usageCount),
        v.completionRate !== null && v.completionRate !== undefined
          ? `${(v.completionRate * 100).toFixed(1)}%`
          : pc.dim('-'),
        formatDate(v.createdAt),
      ]);
    }

    console.log(table.toString());
  }
}
