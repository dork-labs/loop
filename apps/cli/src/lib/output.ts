import Table from 'cli-table3';
import pc from 'picocolors';
import type { Issue } from '@dork-labs/loop-types';

/** Color map for issue statuses. */
export const STATUS_COLOR: Record<string, (s: string) => string> = {
  triage: pc.yellow,
  todo: pc.cyan,
  backlog: pc.dim,
  in_progress: pc.blue,
  done: pc.green,
  canceled: pc.red,
};

/** Human-readable priority labels with color. */
export const PRIORITY_LABEL: Record<number, string> = {
  0: pc.dim('none'),
  1: pc.red('urgent'),
  2: pc.yellow('high'),
  3: pc.white('medium'),
  4: pc.dim('low'),
};

/** Icon map for issue types. */
export const TYPE_ICON: Record<string, string> = {
  signal: '\u26A1',
  hypothesis: '\uD83D\uDD2C',
  plan: '\uD83D\uDCCB',
  task: '\uD83D\uDD27',
  monitor: '\uD83D\uDC41',
};

interface OutputOptions {
  json?: boolean;
  plain?: boolean;
}

/**
 * Three-tier output dispatcher.
 *
 * @param data - Raw data for JSON/plain output
 * @param opts - Global output options
 * @param renderHuman - Callback for colored table output
 * @param renderPlain - Callback for tab-separated output
 */
export function output(
  data: unknown,
  opts: OutputOptions,
  renderHuman: () => void,
  renderPlain?: () => void
): void {
  if (opts.json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else if (opts.plain) {
    if (renderPlain) {
      renderPlain();
    } else {
      process.stdout.write(JSON.stringify(data) + '\n');
    }
  } else {
    renderHuman();
  }
}

/**
 * Render tab-separated rows for --plain output.
 *
 * @param headers - Column names
 * @param rows - 2D array of cell values
 */
export function renderPlainTable(headers: string[], rows: string[][]): void {
  process.stdout.write(headers.join('\t') + '\n');
  for (const row of rows) {
    process.stdout.write(row.join('\t') + '\n');
  }
}

/**
 * Render a list of issues as a formatted table.
 * Columns: #, TYPE, TITLE, STATUS, PRI, PROJECT, CREATED
 */
export function renderIssueTable(issues: Issue[]): void {
  const table = new Table({
    head: ['#', 'TYPE', 'TITLE', 'STATUS', 'PRI', 'PROJECT', 'CREATED'],
    style: { head: ['cyan'] },
  });

  for (const issue of issues) {
    const type = issue.type ?? '';
    const status = issue.status ?? '';
    const priority = issue.priority ?? 3;
    const title = truncate(issue.title ?? '', 50);
    const colorStatus = (STATUS_COLOR[status] ?? pc.white)(status);
    const icon = TYPE_ICON[type] ?? '';

    table.push([
      String(issue.number ?? ''),
      `${icon} ${type}`,
      title,
      colorStatus,
      PRIORITY_LABEL[priority] ?? String(priority),
      issue.projectId ?? '-',
      formatDate(issue.createdAt ?? ''),
    ]);
  }

  console.log(table.toString());
}

/**
 * Render a list of issues as tab-separated plain text.
 * Columns: #, TYPE, TITLE, STATUS, PRIORITY, PROJECT, CREATED
 */
export function renderIssueTablePlain(issues: Issue[]): void {
  renderPlainTable(
    ['#', 'TYPE', 'TITLE', 'STATUS', 'PRI', 'PROJECT', 'CREATED'],
    issues.map((issue) => [
      String(issue.number ?? ''),
      issue.type ?? '',
      issue.title ?? '',
      issue.status ?? '',
      String(issue.priority ?? 3),
      issue.projectId ?? '-',
      formatDate(issue.createdAt ?? ''),
    ])
  );
}

/** Truncate a string to maxLen, appending ellipsis if needed. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/** Format an ISO date string to YYYY-MM-DD. */
export function formatDate(iso: string): string {
  if (!iso) return '-';
  return iso.slice(0, 10);
}
