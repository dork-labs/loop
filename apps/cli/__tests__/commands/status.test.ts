import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies before importing the command
vi.mock('../../src/lib/api-client.js', () => ({
  createApiClient: vi.fn(),
}))

vi.mock('../../src/lib/errors.js', () => ({
  withErrorHandler: vi.fn(async (fn: () => Promise<void>) => fn()),
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { registerStatusCommand } from '../../src/commands/status.js'
import type { DashboardStats } from '../../src/types.js'

const MOCK_STATS: DashboardStats = {
  issues: {
    total: 42,
    byStatus: {
      triage: 5,
      todo: 10,
      backlog: 8,
      in_progress: 7,
      done: 10,
      canceled: 2,
    },
    byType: {
      signal: 15,
      hypothesis: 8,
      plan: 6,
      task: 10,
      monitor: 3,
    },
  },
  goals: {
    total: 5,
    active: 3,
    achieved: 2,
  },
  dispatch: {
    queueDepth: 18,
    activeCount: 7,
    completedLast24h: 4,
  },
}

function createMockApi(stats: DashboardStats) {
  return {
    get: vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue({ data: stats }),
    }),
  }
}

describe('status command', () => {
  let program: Command
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    program = new Command()
    program
      .exitOverride()
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')
    registerStatusCommand(program)

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches dashboard stats from the API', async () => {
    const mockApi = createMockApi(MOCK_STATS)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    await program.parseAsync(['node', 'looped', 'status'])

    expect(mockApi.get).toHaveBeenCalledWith('api/dashboard/stats')
  })

  it('renders issue totals in table mode', async () => {
    const mockApi = createMockApi(MOCK_STATS)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    await program.parseAsync(['node', 'looped', 'status'])

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(allOutput).toContain('42')
  })

  it('renders dispatch stats in table mode', async () => {
    const mockApi = createMockApi(MOCK_STATS)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    await program.parseAsync(['node', 'looped', 'status'])

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(allOutput).toContain('Queue depth')
    expect(allOutput).toContain('Active')
    expect(allOutput).toContain('Done (24h)')
  })

  it('renders goal stats in table mode', async () => {
    const mockApi = createMockApi(MOCK_STATS)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    await program.parseAsync(['node', 'looped', 'status'])

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(allOutput).toContain('Goals')
    expect(allOutput).toContain('5')
    expect(allOutput).toContain('3')
    expect(allOutput).toContain('2')
  })

  it('outputs raw JSON when --json flag is set', async () => {
    const mockApi = createMockApi(MOCK_STATS)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await program.parseAsync(['node', 'looped', '--json', 'status'])

    const written = stdoutSpy.mock.calls.map((c) => c[0]).join('')
    const parsed = JSON.parse(written.trim())
    expect(parsed.issues.total).toBe(42)
    expect(parsed.dispatch.queueDepth).toBe(18)
    expect(parsed.goals.active).toBe(3)
  })

  it('renders status breakdown with all statuses', async () => {
    const mockApi = createMockApi(MOCK_STATS)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    await program.parseAsync(['node', 'looped', 'status'])

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(allOutput).toContain('By Status')
    expect(allOutput).toContain('triage')
    expect(allOutput).toContain('in_progress')
    expect(allOutput).toContain('done')
  })

  it('renders type breakdown with all types', async () => {
    const mockApi = createMockApi(MOCK_STATS)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    await program.parseAsync(['node', 'looped', 'status'])

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(allOutput).toContain('By Type')
    expect(allOutput).toContain('signal')
    expect(allOutput).toContain('hypothesis')
    expect(allOutput).toContain('task')
  })

  it('handles zero counts with dim formatting', async () => {
    const emptyStats: DashboardStats = {
      issues: { total: 0, byStatus: {}, byType: {} },
      goals: { total: 0, active: 0, achieved: 0 },
      dispatch: { queueDepth: 0, activeCount: 0, completedLast24h: 0 },
    }
    const mockApi = createMockApi(emptyStats)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    await program.parseAsync(['node', 'looped', 'status'])

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(allOutput).toContain('Total: ')
    expect(allOutput).toContain('0')
  })

  it('passes global options to createApiClient', async () => {
    const mockApi = createMockApi(MOCK_STATS)
    vi.mocked(createApiClient).mockReturnValue(mockApi as never)

    await program.parseAsync([
      'node',
      'looped',
      '--api-url',
      'https://custom.api',
      '--token',
      'tok_test',
      'status',
    ])

    expect(createApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: 'https://custom.api',
        token: 'tok_test',
      })
    )
  })
})
