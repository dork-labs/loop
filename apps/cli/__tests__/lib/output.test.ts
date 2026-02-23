import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Import directly — no fs mocks needed for this module
import {
  output,
  renderIssueTable,
  renderIssueTablePlain,
  renderPlainTable,
  truncate,
  formatDate,
  STATUS_COLOR,
  PRIORITY_LABEL,
  TYPE_ICON,
} from '../../src/lib/output.js';

describe('output', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs valid JSON to stdout in json mode', () => {
    const data = { data: [{ id: '1', title: 'Test' }], total: 1 };
    const renderFn = vi.fn();

    output(data, { json: true }, renderFn);

    expect(stdoutWriteSpy).toHaveBeenCalledOnce();
    const written = stdoutWriteSpy.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual(data);
    expect(renderFn).not.toHaveBeenCalled();
  });

  it('calls renderHuman when not in json mode', () => {
    const data = { items: [1, 2, 3] };
    const renderHuman = vi.fn();

    output(data, { json: false }, renderHuman);

    expect(stdoutWriteSpy).not.toHaveBeenCalled();
    expect(renderHuman).toHaveBeenCalledOnce();
  });

  it('calls renderHuman when json option is undefined', () => {
    const data = { test: true };
    const renderHuman = vi.fn();

    output(data, {}, renderHuman);

    expect(renderHuman).toHaveBeenCalledOnce();
  });

  it('calls renderPlain when plain option is set and renderPlain provided', () => {
    const data = { test: true };
    const renderHuman = vi.fn();
    const renderPlain = vi.fn();

    output(data, { plain: true }, renderHuman, renderPlain);

    expect(renderHuman).not.toHaveBeenCalled();
    expect(renderPlain).toHaveBeenCalledOnce();
  });

  it('falls back to compact JSON when plain is set but no renderPlain', () => {
    const data = { id: '1' };
    const renderHuman = vi.fn();

    output(data, { plain: true }, renderHuman);

    expect(renderHuman).not.toHaveBeenCalled();
    expect(stdoutWriteSpy).toHaveBeenCalledWith('{"id":"1"}\n');
  });

  it('json takes precedence over plain', () => {
    const data = { id: '1' };
    const renderHuman = vi.fn();
    const renderPlain = vi.fn();

    output(data, { json: true, plain: true }, renderHuman, renderPlain);

    expect(renderHuman).not.toHaveBeenCalled();
    expect(renderPlain).not.toHaveBeenCalled();
    const written = stdoutWriteSpy.mock.calls[0][0] as string;
    expect(JSON.parse(written)).toEqual(data);
  });
});

describe('renderIssueTable', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a table with correct columns for issue data', () => {
    const issues = [
      {
        number: 42,
        type: 'task',
        title: 'Fix login bug',
        status: 'in_progress',
        priority: 2,
        projectId: 'proj_abc',
        createdAt: '2026-02-15T10:00:00Z',
      },
    ];

    renderIssueTable(issues);

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const tableOutput = consoleLogSpy.mock.calls[0][0] as string;
    expect(tableOutput).toContain('42');
    expect(tableOutput).toContain('task');
    expect(tableOutput).toContain('Fix login bug');
    expect(tableOutput).toContain('proj_abc');
    expect(tableOutput).toContain('2026-02-15');
  });

  it('renders empty table without errors', () => {
    renderIssueTable([]);

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const tableOutput = consoleLogSpy.mock.calls[0][0] as string;
    // Should contain headers even with no data
    expect(tableOutput).toContain('#');
    expect(tableOutput).toContain('TYPE');
    expect(tableOutput).toContain('TITLE');
  });

  it('truncates long titles', () => {
    const longTitle = 'A'.repeat(60);
    const issues = [
      {
        number: 1,
        type: 'signal',
        title: longTitle,
        status: 'triage',
        priority: 1,
        projectId: null,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ];

    renderIssueTable(issues);

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const tableOutput = consoleLogSpy.mock.calls[0][0] as string;
    // Should not contain the full 60-char string
    expect(tableOutput).not.toContain(longTitle);
    // Should contain the truncated version (49 chars + ellipsis)
    expect(tableOutput).toContain('\u2026');
  });

  it('shows dash for missing projectId', () => {
    const issues = [
      {
        number: 5,
        type: 'plan',
        title: 'Plan something',
        status: 'todo',
        priority: 3,
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    renderIssueTable(issues);

    const tableOutput = consoleLogSpy.mock.calls[0][0] as string;
    expect(tableOutput).toContain('-');
  });

  it('uses default priority when not provided', () => {
    const issues = [
      {
        number: 10,
        type: 'task',
        title: 'No priority set',
        status: 'backlog',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    renderIssueTable(issues);

    // Should not throw; table renders with default priority (3 = medium)
    expect(consoleLogSpy).toHaveBeenCalledOnce();
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns strings at exact max length unchanged', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates long strings and appends ellipsis', () => {
    const result = truncate('This is a very long string', 10);
    expect(result).toBe('This is a\u2026');
    expect(result.length).toBe(10);
  });

  it('handles single character max length', () => {
    expect(truncate('abc', 1)).toBe('\u2026');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });
});

describe('formatDate', () => {
  it('formats ISO date string to YYYY-MM-DD', () => {
    expect(formatDate('2026-02-15T10:30:00.000Z')).toBe('2026-02-15');
  });

  it('formats date-only string correctly', () => {
    expect(formatDate('2026-02-15')).toBe('2026-02-15');
  });

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('-');
  });
});

describe('STATUS_COLOR', () => {
  it('has entries for all issue statuses', () => {
    const statuses = ['triage', 'todo', 'backlog', 'in_progress', 'done', 'canceled'];
    for (const status of statuses) {
      expect(STATUS_COLOR[status]).toBeDefined();
      expect(typeof STATUS_COLOR[status]).toBe('function');
    }
  });

  it('color functions return strings', () => {
    expect(typeof STATUS_COLOR.triage('test')).toBe('string');
    expect(typeof STATUS_COLOR.done('test')).toBe('string');
  });
});

describe('PRIORITY_LABEL', () => {
  it('has entries for priorities 0 through 4', () => {
    for (let i = 0; i <= 4; i++) {
      expect(PRIORITY_LABEL[i]).toBeDefined();
      expect(typeof PRIORITY_LABEL[i]).toBe('string');
    }
  });
});

describe('TYPE_ICON', () => {
  it('has entries for all issue types', () => {
    const types = ['signal', 'hypothesis', 'plan', 'task', 'monitor'];
    for (const type of types) {
      expect(TYPE_ICON[type]).toBeDefined();
      expect(typeof TYPE_ICON[type]).toBe('string');
    }
  });
});

describe('renderPlainTable', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs tab-separated headers and rows', () => {
    renderPlainTable(
      ['A', 'B', 'C'],
      [
        ['1', '2', '3'],
        ['4', '5', '6'],
      ]
    );

    expect(stdoutWriteSpy).toHaveBeenCalledWith('A\tB\tC\n');
    expect(stdoutWriteSpy).toHaveBeenCalledWith('1\t2\t3\n');
    expect(stdoutWriteSpy).toHaveBeenCalledWith('4\t5\t6\n');
  });

  it('outputs only headers when rows are empty', () => {
    renderPlainTable(['X', 'Y'], []);

    expect(stdoutWriteSpy).toHaveBeenCalledTimes(1);
    expect(stdoutWriteSpy).toHaveBeenCalledWith('X\tY\n');
  });
});

describe('renderIssueTablePlain', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outputs tab-separated issue data with headers', () => {
    const issues = [
      {
        number: 42,
        type: 'task',
        title: 'Fix login bug',
        status: 'in_progress',
        priority: 2,
        projectId: 'proj_abc',
        createdAt: '2026-02-15T10:00:00Z',
      },
    ];

    renderIssueTablePlain(issues);

    // Header row
    expect(stdoutWriteSpy).toHaveBeenCalledWith('#\tTYPE\tTITLE\tSTATUS\tPRI\tPROJECT\tCREATED\n');
    // Data row with no colors or icons
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      '42\ttask\tFix login bug\tin_progress\t2\tproj_abc\t2026-02-15\n'
    );
  });

  it('shows dash for missing projectId', () => {
    const issues = [
      {
        number: 5,
        type: 'plan',
        title: 'Plan something',
        status: 'todo',
        priority: 3,
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    renderIssueTablePlain(issues);

    const calls = stdoutWriteSpy.mock.calls.map((c) => c[0]);
    const dataRow = calls[1] as string;
    expect(dataRow).toContain('-');
  });
});
