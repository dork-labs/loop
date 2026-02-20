import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies before importing
vi.mock('../../src/lib/api-client.js', () => ({
  createApiClient: vi.fn(),
}))

vi.mock('../../src/lib/errors.js', () => ({
  withErrorHandler: vi.fn(async (fn: () => Promise<void>) => fn()),
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { registerShowCommand } from '../../src/commands/show.js'
import type { IssueDetail } from '../../src/types.js'

function makeIssueDetail(overrides: Partial<IssueDetail> = {}): IssueDetail {
  return {
    id: 'iss_abc123',
    number: 42,
    title: 'Fix login timeout',
    type: 'task',
    status: 'in_progress',
    priority: 2,
    description: 'The login endpoint times out after 30s under load',
    projectId: 'proj_abc',
    parentId: null,
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-02-15T10:00:00Z',
    labels: [
      { id: 'lbl_1', name: 'bug', color: '#ff0000' },
      { id: 'lbl_2', name: 'backend', color: '#0000ff' },
    ],
    children: [],
    relations: [],
    parent: null,
    ...overrides,
  }
}

describe('show command', () => {
  let program: Command
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let mockJson: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    program = new Command()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'API URL')
      .option('--token <token>', 'Auth token')
    program.exitOverride()
    registerShowCommand(program)

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    mockJson = vi.fn()
    mockGet = vi.fn(() => ({ json: mockJson }))
    vi.mocked(createApiClient).mockReturnValue({ get: mockGet } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls GET /api/issues/:id with correct ID', async () => {
    const issue = makeIssueDetail()
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    expect(mockGet).toHaveBeenCalledWith('api/issues/iss_abc123')
  })

  it('renders header with issue number, type icon, and title', async () => {
    const issue = makeIssueDetail()
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('#42'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('task'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fix login timeout'),
    )
  })

  it('shows labels when present', async () => {
    const issue = makeIssueDetail()
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    expect(consoleSpy).toHaveBeenCalledWith('Labels: bug, backend')
  })

  it('shows description when present', async () => {
    const issue = makeIssueDetail()
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    expect(consoleSpy).toHaveBeenCalledWith(
      '  The login endpoint times out after 30s under load',
    )
  })

  it('shows parent when present', async () => {
    const parent = {
      id: 'iss_parent',
      number: 38,
      title: 'Improve auth performance',
      type: 'plan' as const,
      status: 'in_progress' as const,
      priority: 2,
      createdAt: '2026-02-10T10:00:00Z',
      updatedAt: '2026-02-10T10:00:00Z',
    }
    const issue = makeIssueDetail({ parent, parentId: 'iss_parent' })
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('#38'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Improve auth performance'),
    )
  })

  it('shows children as table when present', async () => {
    const children = [
      {
        id: 'iss_c1',
        number: 43,
        title: 'Fix connection pool',
        type: 'task' as const,
        status: 'todo' as const,
        priority: 3,
        createdAt: '2026-02-16T10:00:00Z',
        updatedAt: '2026-02-16T10:00:00Z',
      },
      {
        id: 'iss_c2',
        number: 44,
        title: 'Add retry logic',
        type: 'task' as const,
        status: 'todo' as const,
        priority: 3,
        createdAt: '2026-02-16T10:00:00Z',
        updatedAt: '2026-02-16T10:00:00Z',
      },
    ]
    const issue = makeIssueDetail({ children })
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    // Children header is rendered
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Children'))
    // Table content includes child issues (cli-table3 renders them)
    const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(allOutput).toContain('43')
    expect(allOutput).toContain('44')
    expect(allOutput).toContain('Fix connection pool')
    expect(allOutput).toContain('Add retry logic')
  })

  it('shows relations when present', async () => {
    const relations = [
      {
        id: 'rel_1',
        issueId: 'iss_abc123',
        relatedIssueId: 'iss_45',
        type: 'blocks',
        createdAt: '2026-02-15T10:00:00Z',
      },
      {
        id: 'rel_2',
        issueId: 'iss_37',
        relatedIssueId: 'iss_abc123',
        type: 'blocks',
        createdAt: '2026-02-15T10:00:00Z',
      },
    ]
    const issue = makeIssueDetail({ relations })
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    expect(consoleSpy).toHaveBeenCalledWith('  blocks iss_45')
    expect(consoleSpy).toHaveBeenCalledWith('  blocked by iss_37')
  })

  it('handles missing optional fields gracefully', async () => {
    const issue = makeIssueDetail({
      description: null,
      projectId: null,
      parent: null,
      labels: [],
      children: [],
      relations: [],
      agentSummary: null,
      commits: null,
      pullRequests: null,
    })
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    // Should not throw, and should not show optional sections
    const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(allOutput).not.toContain('Description')
    expect(allOutput).not.toContain('Parent')
    expect(allOutput).not.toContain('Children')
    expect(allOutput).not.toContain('Relations')
    expect(allOutput).not.toContain('Agent')
  })

  it('shows agent results when present', async () => {
    const issue = makeIssueDetail({
      agentSummary: 'Fixed connection pool sizing',
      commits: ['abc1234', 'def5678'],
      pullRequests: ['#12', '#15'],
    })
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(allOutput).toContain('Agent')
    expect(allOutput).toContain('Fixed connection pool sizing')
    expect(allOutput).toContain('abc1234, def5678')
    expect(allOutput).toContain('#12, #15')
  })

  it('outputs JSON in --json mode', async () => {
    const issue = makeIssueDetail()
    const response = { data: issue }
    mockJson.mockResolvedValue(response)

    await program.parseAsync(['node', 'looped', '--json', 'show', 'iss_abc123'])

    expect(stdoutSpy).toHaveBeenCalled()
    const writtenData = stdoutSpy.mock.calls[0]?.[0] as string
    const parsed = JSON.parse(writtenData)
    expect(parsed.data.id).toBe('iss_abc123')
    expect(parsed.data.number).toBe(42)
    // In JSON mode, table rendering should NOT be called
    // consoleSpy calls should not include the header format
  })

  it('formats relates_to relation type', async () => {
    const relations = [
      {
        id: 'rel_1',
        issueId: 'iss_abc123',
        relatedIssueId: 'iss_99',
        type: 'relates_to',
        createdAt: '2026-02-15T10:00:00Z',
      },
    ]
    const issue = makeIssueDetail({ relations })
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    expect(consoleSpy).toHaveBeenCalledWith('  relates to iss_99')
  })

  it('formats duplicates relation type', async () => {
    const relations = [
      {
        id: 'rel_1',
        issueId: 'iss_abc123',
        relatedIssueId: 'iss_50',
        type: 'duplicates',
        createdAt: '2026-02-15T10:00:00Z',
      },
    ]
    const issue = makeIssueDetail({ relations })
    mockJson.mockResolvedValue({ data: issue })

    await program.parseAsync(['node', 'looped', 'show', 'iss_abc123'])

    expect(consoleSpy).toHaveBeenCalledWith('  duplicates iss_50')
  })
})
