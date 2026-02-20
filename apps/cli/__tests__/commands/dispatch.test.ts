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
  TYPE_ICON: {
    signal: '\u26A1',
    hypothesis: '\uD83D\uDD2C',
    plan: '\uD83D\uDCCB',
    task: '\uD83D\uDD27',
    monitor: '\uD83D\uDC41',
  },
  PRIORITY_LABEL: {
    0: 'none',
    1: 'urgent',
    2: 'high',
    3: 'medium',
    4: 'low',
  },
  STATUS_COLOR: {
    triage: (s: string) => s,
    todo: (s: string) => s,
    backlog: (s: string) => s,
    in_progress: (s: string) => s,
    done: (s: string) => s,
    canceled: (s: string) => s,
  },
  truncate: (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '\u2026' : s),
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { output } from '../../src/lib/output.js'
import { registerDispatchCommand } from '../../src/commands/dispatch.js'
import type { DispatchQueueItem, Issue } from '../../src/types.js'

const MOCK_QUEUE_ITEMS: DispatchQueueItem[] = [
  {
    issue: {
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
    score: 120,
    breakdown: {
      priorityWeight: 75,
      goalBonus: 20,
      ageBonus: 5,
      typeBonus: 20,
    },
  },
  {
    issue: {
      id: 'iss_2',
      number: 2,
      title: 'Error rate spike detected',
      type: 'signal',
      status: 'todo',
      priority: 1,
      projectId: null,
      createdAt: '2026-01-16T12:00:00Z',
      updatedAt: '2026-01-16T12:00:00Z',
    },
    score: 155,
    breakdown: {
      priorityWeight: 100,
      goalBonus: 0,
      ageBonus: 5,
      typeBonus: 50,
    },
  },
]

const MOCK_QUEUE_RESPONSE = { data: MOCK_QUEUE_ITEMS, total: 2 }

const MOCK_ISSUE: Issue = {
  id: 'iss_1',
  number: 1,
  title: 'Fix login timeout',
  description: 'Users experience timeouts during login.',
  type: 'task',
  status: 'in_progress',
  priority: 2,
  projectId: 'proj_abc',
  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-01-20T08:00:00Z',
}

describe('dispatch commands', () => {
  let program: Command
  let mockJsonGet: ReturnType<typeof vi.fn>
  let mockJsonPatch: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>
  let mockPatch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    program = new Command()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')
    program.exitOverride()
    registerDispatchCommand(program)

    mockJsonGet = vi.fn()
    mockJsonPatch = vi.fn()
    mockGet = vi.fn().mockReturnValue({ json: mockJsonGet })
    mockPatch = vi.fn().mockReturnValue({ json: mockJsonPatch })

    vi.mocked(createApiClient).mockReturnValue({
      get: mockGet,
      patch: mockPatch,
    } as unknown as ReturnType<typeof createApiClient>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('next command', () => {
    beforeEach(() => {
      mockJsonGet.mockResolvedValue(MOCK_QUEUE_RESPONSE)
    })

    it('calls GET /api/dispatch/queue with default limit=10, offset=0', async () => {
      await program.parseAsync(['node', 'looped', 'next'])

      expect(mockGet).toHaveBeenCalledWith('api/dispatch/queue', {
        searchParams: { limit: '10', offset: '0' },
      })
    })

    it('passes --project filter as projectId query param', async () => {
      await program.parseAsync(['node', 'looped', 'next', '--project', 'proj_abc'])

      expect(mockGet).toHaveBeenCalledWith('api/dispatch/queue', {
        searchParams: expect.objectContaining({ projectId: 'proj_abc' }),
      })
    })

    it('passes custom --limit value', async () => {
      await program.parseAsync(['node', 'looped', 'next', '--limit', '25'])

      expect(mockGet).toHaveBeenCalledWith('api/dispatch/queue', {
        searchParams: expect.objectContaining({ limit: '25' }),
      })
    })

    it('calls output with queue response', async () => {
      await program.parseAsync(['node', 'looped', 'next'])

      expect(output).toHaveBeenCalledWith(
        MOCK_QUEUE_RESPONSE,
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('outputs raw JSON when --json flag is set', async () => {
      await program.parseAsync(['node', 'looped', 'next', '--json'])

      expect(output).toHaveBeenCalledWith(
        MOCK_QUEUE_RESPONSE,
        expect.objectContaining({ json: true }),
        expect.any(Function),
      )
    })

    it('creates API client with global options', async () => {
      await program.parseAsync([
        'node', 'looped',
        '--api-url', 'https://custom.api.com',
        '--token', 'tok_custom',
        'next',
      ])

      expect(createApiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: 'https://custom.api.com',
          token: 'tok_custom',
        }),
      )
    })
  })

  describe('dispatch command', () => {
    beforeEach(() => {
      mockPatch.mockReturnValue({ json: vi.fn().mockResolvedValue({}) })
      mockJsonGet.mockResolvedValue({ data: MOCK_ISSUE })
    })

    it('calls PATCH /api/issues/:id with status in_progress', async () => {
      await program.parseAsync(['node', 'looped', 'dispatch', 'iss_1'])

      expect(mockPatch).toHaveBeenCalledWith('api/issues/iss_1', {
        json: { status: 'in_progress' },
      })
    })

    it('fetches the updated issue after patching', async () => {
      await program.parseAsync(['node', 'looped', 'dispatch', 'iss_1'])

      expect(mockGet).toHaveBeenCalledWith('api/issues/iss_1')
    })

    it('calls output with the claimed issue', async () => {
      await program.parseAsync(['node', 'looped', 'dispatch', 'iss_1'])

      expect(output).toHaveBeenCalledWith(
        MOCK_ISSUE,
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('outputs raw JSON when --json flag is set', async () => {
      await program.parseAsync(['node', 'looped', '--json', 'dispatch', 'iss_1'])

      expect(output).toHaveBeenCalledWith(
        MOCK_ISSUE,
        expect.objectContaining({ json: true }),
        expect.any(Function),
      )
    })

    it('creates API client with global options', async () => {
      await program.parseAsync([
        'node', 'looped',
        '--api-url', 'https://custom.api.com',
        '--token', 'tok_custom',
        'dispatch', 'iss_1',
      ])

      expect(createApiClient).toHaveBeenCalledWith(
        expect.objectContaining({
          apiUrl: 'https://custom.api.com',
          token: 'tok_custom',
        }),
      )
    })
  })
})
