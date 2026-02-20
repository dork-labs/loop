import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies
vi.mock('../../src/lib/api-client.js', () => ({
  createApiClient: vi.fn(),
}))

vi.mock('../../src/lib/errors.js', () => ({
  withErrorHandler: vi.fn(async (fn: () => Promise<void>) => fn()),
}))

vi.mock('../../src/lib/output.js', () => ({
  output: vi.fn(),
  renderIssueTable: vi.fn(),
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { output, renderIssueTable } from '../../src/lib/output.js'
import { registerIssuesCommand } from '../../src/commands/issues.js'
import type { Issue } from '../../src/types.js'

const MOCK_ISSUES: Issue[] = [
  {
    id: 'iss_1',
    number: 1,
    title: 'Fix login timeout',
    type: 'task',
    status: 'todo',
    priority: 2,
    projectId: 'proj_abc',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'iss_2',
    number: 2,
    title: 'Error rate spike detected',
    type: 'signal',
    status: 'triage',
    priority: 1,
    projectId: null,
    createdAt: '2026-01-16T12:00:00Z',
    updatedAt: '2026-01-16T12:00:00Z',
  },
]

const MOCK_RESPONSE = { data: MOCK_ISSUES, total: 2 }

describe('list command', () => {
  let program: Command
  let mockJson: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    program = new Command()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')
    program.exitOverride()
    registerIssuesCommand(program)

    mockJson = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    mockGet = vi.fn().mockReturnValue({ json: mockJson })
    vi.mocked(createApiClient).mockReturnValue({ get: mockGet } as unknown as ReturnType<typeof createApiClient>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls GET /api/issues with default limit=50, offset=0', async () => {
    await program.parseAsync(['node', 'looped', 'list'])

    expect(mockGet).toHaveBeenCalledWith('api/issues', {
      searchParams: { limit: '50', offset: '0' },
    })
  })

  it('passes --status filter as query param', async () => {
    await program.parseAsync(['node', 'looped', 'list', '--status', 'todo'])

    expect(mockGet).toHaveBeenCalledWith('api/issues', {
      searchParams: expect.objectContaining({ status: 'todo' }),
    })
  })

  it('passes --type filter as query param', async () => {
    await program.parseAsync(['node', 'looped', 'list', '--type', 'task'])

    expect(mockGet).toHaveBeenCalledWith('api/issues', {
      searchParams: expect.objectContaining({ type: 'task' }),
    })
  })

  it('passes --project filter as projectId query param', async () => {
    await program.parseAsync(['node', 'looped', 'list', '--project', 'proj_abc'])

    expect(mockGet).toHaveBeenCalledWith('api/issues', {
      searchParams: expect.objectContaining({ projectId: 'proj_abc' }),
    })
  })

  it('passes --priority filter as query param', async () => {
    await program.parseAsync(['node', 'looped', 'list', '--priority', '2'])

    expect(mockGet).toHaveBeenCalledWith('api/issues', {
      searchParams: expect.objectContaining({ priority: '2' }),
    })
  })

  it('passes all filters together', async () => {
    await program.parseAsync([
      'node', 'looped', 'list',
      '--status', 'in_progress',
      '--type', 'task',
      '--project', 'proj_abc',
      '--priority', '1',
      '--limit', '10',
      '--offset', '20',
    ])

    expect(mockGet).toHaveBeenCalledWith('api/issues', {
      searchParams: {
        limit: '10',
        offset: '20',
        status: 'in_progress',
        type: 'task',
        projectId: 'proj_abc',
        priority: '1',
      },
    })
  })

  it('renders issue table in default mode', async () => {
    await program.parseAsync(['node', 'looped', 'list'])

    expect(output).toHaveBeenCalledWith(
      MOCK_RESPONSE,
      expect.any(Object),
      expect.any(Function),
    )

    // Verify json flag is not set in default mode
    const passedOpts = vi.mocked(output).mock.calls[0][1] as { json?: boolean }
    expect(passedOpts.json).toBeFalsy()

    // Execute the render callback to verify it calls renderIssueTable
    const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
    renderFn(MOCK_RESPONSE)

    expect(renderIssueTable).toHaveBeenCalledWith(MOCK_ISSUES)
  })

  it('outputs raw JSON when --json flag is set', async () => {
    await program.parseAsync(['node', 'looped', 'list', '--json'])

    expect(output).toHaveBeenCalledWith(
      MOCK_RESPONSE,
      expect.objectContaining({ json: true }),
      expect.any(Function),
    )
  })

  it('creates API client with global options', async () => {
    await program.parseAsync([
      'node', 'looped',
      '--api-url', 'https://custom.api.com',
      '--token', 'tok_custom',
      'list',
    ])

    expect(createApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: 'https://custom.api.com',
        token: 'tok_custom',
      }),
    )
  })
})
