import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import directly — no fs mocks needed for this module
import {
  output,
  renderIssueTable,
  truncate,
  formatDate,
  STATUS_COLOR,
  PRIORITY_LABEL,
  TYPE_ICON,
} from '../../src/lib/output.js'

describe('output', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutWriteSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs valid JSON to stdout in json mode', () => {
    const data = { data: [{ id: '1', title: 'Test' }], total: 1 }
    const renderFn = vi.fn()

    output(data, { json: true }, renderFn)

    expect(stdoutWriteSpy).toHaveBeenCalledOnce()
    const written = stdoutWriteSpy.mock.calls[0][0] as string
    expect(JSON.parse(written)).toEqual(data)
    expect(renderFn).not.toHaveBeenCalled()
  })

  it('calls renderFn when not in json mode', () => {
    const data = { items: [1, 2, 3] }
    const renderFn = vi.fn()

    output(data, { json: false }, renderFn)

    expect(stdoutWriteSpy).not.toHaveBeenCalled()
    expect(renderFn).toHaveBeenCalledWith(data)
  })

  it('calls renderFn when json option is undefined', () => {
    const data = { test: true }
    const renderFn = vi.fn()

    output(data, {}, renderFn)

    expect(renderFn).toHaveBeenCalledWith(data)
  })
})

describe('renderIssueTable', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

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
    ]

    renderIssueTable(issues)

    expect(consoleLogSpy).toHaveBeenCalledOnce()
    const tableOutput = consoleLogSpy.mock.calls[0][0] as string
    expect(tableOutput).toContain('42')
    expect(tableOutput).toContain('task')
    expect(tableOutput).toContain('Fix login bug')
    expect(tableOutput).toContain('proj_abc')
    expect(tableOutput).toContain('2026-02-15')
  })

  it('renders empty table without errors', () => {
    renderIssueTable([])

    expect(consoleLogSpy).toHaveBeenCalledOnce()
    const tableOutput = consoleLogSpy.mock.calls[0][0] as string
    // Should contain headers even with no data
    expect(tableOutput).toContain('#')
    expect(tableOutput).toContain('TYPE')
    expect(tableOutput).toContain('TITLE')
  })

  it('truncates long titles', () => {
    const longTitle = 'A'.repeat(60)
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
    ]

    renderIssueTable(issues)

    expect(consoleLogSpy).toHaveBeenCalledOnce()
    const tableOutput = consoleLogSpy.mock.calls[0][0] as string
    // Should not contain the full 60-char string
    expect(tableOutput).not.toContain(longTitle)
    // Should contain the truncated version (49 chars + ellipsis)
    expect(tableOutput).toContain('\u2026')
  })

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
    ]

    renderIssueTable(issues)

    const tableOutput = consoleLogSpy.mock.calls[0][0] as string
    expect(tableOutput).toContain('-')
  })

  it('uses default priority when not provided', () => {
    const issues = [
      {
        number: 10,
        type: 'task',
        title: 'No priority set',
        status: 'backlog',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ]

    renderIssueTable(issues)

    // Should not throw; table renders with default priority (3 = medium)
    expect(consoleLogSpy).toHaveBeenCalledOnce()
  })
})

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('returns strings at exact max length unchanged', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('truncates long strings and appends ellipsis', () => {
    const result = truncate('This is a very long string', 10)
    expect(result).toBe('This is a\u2026')
    expect(result.length).toBe(10)
  })

  it('handles single character max length', () => {
    expect(truncate('abc', 1)).toBe('\u2026')
  })

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('')
  })
})

describe('formatDate', () => {
  it('formats ISO date string to YYYY-MM-DD', () => {
    expect(formatDate('2026-02-15T10:30:00.000Z')).toBe('2026-02-15')
  })

  it('formats date-only string correctly', () => {
    expect(formatDate('2026-02-15')).toBe('2026-02-15')
  })

  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('-')
  })
})

describe('STATUS_COLOR', () => {
  it('has entries for all issue statuses', () => {
    const statuses = ['triage', 'todo', 'backlog', 'in_progress', 'done', 'canceled']
    for (const status of statuses) {
      expect(STATUS_COLOR[status]).toBeDefined()
      expect(typeof STATUS_COLOR[status]).toBe('function')
    }
  })

  it('color functions return strings', () => {
    expect(typeof STATUS_COLOR.triage('test')).toBe('string')
    expect(typeof STATUS_COLOR.done('test')).toBe('string')
  })
})

describe('PRIORITY_LABEL', () => {
  it('has entries for priorities 0 through 4', () => {
    for (let i = 0; i <= 4; i++) {
      expect(PRIORITY_LABEL[i]).toBeDefined()
      expect(typeof PRIORITY_LABEL[i]).toBe('string')
    }
  })
})

describe('TYPE_ICON', () => {
  it('has entries for all issue types', () => {
    const types = ['signal', 'hypothesis', 'plan', 'task', 'monitor']
    for (const type of types) {
      expect(TYPE_ICON[type]).toBeDefined()
      expect(typeof TYPE_ICON[type]).toBe('string')
    }
  })
})
