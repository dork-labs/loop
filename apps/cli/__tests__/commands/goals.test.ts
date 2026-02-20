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
  formatDate: vi.fn((iso: string) => iso.slice(0, 10)),
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { output } from '../../src/lib/output.js'
import { registerGoalsCommand } from '../../src/commands/goals.js'
import type { Goal } from '../../src/types.js'

const MOCK_GOALS: Goal[] = [
  {
    id: 'goal_1',
    title: 'Reduce error rate',
    description: 'Reduce 5xx errors below threshold',
    metric: 'error_rate',
    targetValue: 0.01,
    currentValue: 0.008,
    unit: '%',
    status: 'active',
    projectId: 'proj_abc',
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'goal_2',
    title: 'Increase test coverage',
    description: null,
    metric: 'coverage',
    targetValue: 80,
    currentValue: 65,
    unit: '%',
    status: 'active',
    projectId: null,
    createdAt: '2026-01-12T10:00:00Z',
    updatedAt: '2026-01-16T10:00:00Z',
  },
  {
    id: 'goal_3',
    title: 'Launch MVP',
    description: 'Ship the first version',
    metric: null,
    targetValue: null,
    currentValue: null,
    unit: null,
    status: 'achieved',
    projectId: 'proj_xyz',
    createdAt: '2025-12-01T10:00:00Z',
    updatedAt: '2026-01-20T10:00:00Z',
  },
]

const MOCK_RESPONSE = { data: MOCK_GOALS, total: 3 }

describe('goals list command', () => {
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
    registerGoalsCommand(program)

    mockJson = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    mockGet = vi.fn().mockReturnValue({ json: mockJson })
    vi.mocked(createApiClient).mockReturnValue({
      get: mockGet,
    } as unknown as ReturnType<typeof createApiClient>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls GET /api/goals with default limit=50, offset=0', async () => {
    await program.parseAsync(['node', 'looped', 'goals', 'list'])

    expect(mockGet).toHaveBeenCalledWith('api/goals', {
      searchParams: { limit: '50', offset: '0' },
    })
  })

  it('passes --status filter as query param', async () => {
    await program.parseAsync(['node', 'looped', 'goals', 'list', '--status', 'achieved'])

    expect(mockGet).toHaveBeenCalledWith('api/goals', {
      searchParams: expect.objectContaining({ status: 'achieved' }),
    })
  })

  it('passes --limit and --offset params', async () => {
    await program.parseAsync([
      'node', 'looped', 'goals', 'list',
      '--limit', '10',
      '--offset', '20',
    ])

    expect(mockGet).toHaveBeenCalledWith('api/goals', {
      searchParams: { limit: '10', offset: '20' },
    })
  })

  it('passes all filters together', async () => {
    await program.parseAsync([
      'node', 'looped', 'goals', 'list',
      '--status', 'active',
      '--limit', '25',
      '--offset', '5',
    ])

    expect(mockGet).toHaveBeenCalledWith('api/goals', {
      searchParams: {
        limit: '25',
        offset: '5',
        status: 'active',
      },
    })
  })

  it('calls output with API response and global opts', async () => {
    await program.parseAsync(['node', 'looped', 'goals', 'list'])

    expect(output).toHaveBeenCalledWith(
      MOCK_RESPONSE,
      expect.any(Object),
      expect.any(Function),
    )
  })

  it('outputs raw JSON when --json flag is set', async () => {
    await program.parseAsync(['node', 'looped', 'goals', 'list', '--json'])

    expect(output).toHaveBeenCalledWith(
      MOCK_RESPONSE,
      expect.objectContaining({ json: true }),
      expect.any(Function),
    )
  })

  it('renders table with progress when render callback is invoked', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await program.parseAsync(['node', 'looped', 'goals', 'list'])

    // Execute the render callback
    const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
    renderFn(MOCK_RESPONSE)

    // Should have printed a table (cli-table3 output) and a summary line
    expect(consoleSpy).toHaveBeenCalled()
    const tableOutput = consoleSpy.mock.calls[0][0] as string
    expect(tableOutput).toContain('Reduce error rate')
    expect(tableOutput).toContain('Increase test coverage')
    expect(tableOutput).toContain('Launch MVP')

    consoleSpy.mockRestore()
  })

  it('renders empty message when no goals exist', async () => {
    mockJson.mockResolvedValue({ data: [], total: 0 })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await program.parseAsync(['node', 'looped', 'goals', 'list'])

    const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
    renderFn({ data: [], total: 0 })

    expect(consoleSpy).toHaveBeenCalled()
    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join(' ')
    expect(allOutput).toContain('No goals found')

    consoleSpy.mockRestore()
  })

  it('shows progress as currentValue/targetValue unit', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await program.parseAsync(['node', 'looped', 'goals', 'list'])

    const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
    renderFn(MOCK_RESPONSE)

    const tableOutput = consoleSpy.mock.calls[0][0] as string
    // Goal 1: 0.008/0.01 %
    expect(tableOutput).toContain('0.008/0.01 %')
    // Goal 2: 65/80 %
    expect(tableOutput).toContain('65/80 %')

    consoleSpy.mockRestore()
  })

  it('shows dash for progress when values are null', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const nullGoal: Goal = {
      id: 'goal_null',
      title: 'No metrics',
      description: null,
      metric: null,
      targetValue: null,
      currentValue: null,
      unit: null,
      status: 'active',
      projectId: null,
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-01-10T10:00:00Z',
    }
    const response = { data: [nullGoal], total: 1 }
    mockJson.mockResolvedValue(response)

    await program.parseAsync(['node', 'looped', 'goals', 'list'])

    const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
    renderFn(response)

    const tableOutput = consoleSpy.mock.calls[0][0] as string
    // Progress column should show "-"
    expect(tableOutput).toContain('-')

    consoleSpy.mockRestore()
  })

  it('creates API client with global options', async () => {
    await program.parseAsync([
      'node', 'looped',
      '--api-url', 'https://custom.api.com',
      '--token', 'tok_custom',
      'goals', 'list',
    ])

    expect(createApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: 'https://custom.api.com',
        token: 'tok_custom',
      }),
    )
  })
})
