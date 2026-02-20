import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies before importing the command
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
import { registerTriageCommand } from '../../src/commands/triage.js'

function createMockApi() {
  const jsonFn = vi.fn()
  const getMock = vi.fn(() => ({ json: jsonFn }))
  const patchMock = vi.fn(() => ({ json: jsonFn }))
  const postMock = vi.fn(() => ({ json: jsonFn }))
  return { getMock, patchMock, postMock, jsonFn, api: { get: getMock, patch: patchMock, post: postMock } }
}

describe('triage command', () => {
  let program: Command
  let mockApi: ReturnType<typeof createMockApi>

  beforeEach(() => {
    program = new Command()
    program.exitOverride()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')

    registerTriageCommand(program)

    mockApi = createMockApi()
    vi.mocked(createApiClient).mockReturnValue(mockApi.api as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('triage (list)', () => {
    it('lists issues with status=triage filter', async () => {
      const triageIssues = {
        data: [
          { id: 'iss_1', number: 1, title: 'Error spike', type: 'signal', status: 'triage', priority: 2, createdAt: '2026-02-20T00:00:00Z' },
          { id: 'iss_2', number: 2, title: 'Performance drop', type: 'signal', status: 'triage', priority: 3, createdAt: '2026-02-20T00:00:00Z' },
        ],
        total: 2,
      }
      mockApi.jsonFn.mockResolvedValue(triageIssues)

      await program.parseAsync(['node', 'looped', 'triage'])

      expect(mockApi.getMock).toHaveBeenCalledWith('api/issues', {
        searchParams: { status: 'triage' },
      })
      expect(output).toHaveBeenCalledWith(
        triageIssues,
        expect.objectContaining({}),
        expect.any(Function),
      )
    })

    it('renders issue table in default mode', async () => {
      const triageIssues = {
        data: [{ id: 'iss_1', number: 1, title: 'Error spike', type: 'signal', status: 'triage', priority: 2, createdAt: '2026-02-20T00:00:00Z' }],
        total: 1,
      }
      mockApi.jsonFn.mockResolvedValue(triageIssues)

      await program.parseAsync(['node', 'looped', 'triage'])

      // Extract the renderFn passed to output and call it to verify it calls renderIssueTable
      const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
      renderFn(triageIssues)

      expect(renderIssueTable).toHaveBeenCalledWith(triageIssues.data)
    })

    it('passes --json flag through global options', async () => {
      const triageIssues = { data: [], total: 0 }
      mockApi.jsonFn.mockResolvedValue(triageIssues)

      await program.parseAsync(['node', 'looped', '--json', 'triage'])

      expect(output).toHaveBeenCalledWith(
        triageIssues,
        expect.objectContaining({ json: true }),
        expect.any(Function),
      )
    })
  })

  describe('triage accept', () => {
    it('PATCHes issue status to backlog', async () => {
      const updatedIssue = { data: { id: 'iss_1', number: 1, title: 'Error spike', status: 'backlog' } }
      mockApi.jsonFn.mockResolvedValue(updatedIssue)

      await program.parseAsync(['node', 'looped', 'triage', 'accept', 'iss_1'])

      expect(mockApi.patchMock).toHaveBeenCalledWith('api/issues/iss_1', {
        json: { status: 'backlog' },
      })
    })

    it('prints confirmation message', async () => {
      const updatedIssue = { data: { id: 'iss_1', number: 1, title: 'Error spike', status: 'backlog' } }
      mockApi.jsonFn.mockResolvedValue(updatedIssue)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'looped', 'triage', 'accept', 'iss_1'])

      // Call the renderFn to verify it prints confirmation
      const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
      renderFn(updatedIssue)

      expect(consoleSpy).toHaveBeenCalledWith('Issue iss_1 accepted into backlog')
      consoleSpy.mockRestore()
    })

    it('supports --json mode', async () => {
      const updatedIssue = { data: { id: 'iss_1', status: 'backlog' } }
      mockApi.jsonFn.mockResolvedValue(updatedIssue)

      await program.parseAsync(['node', 'looped', '--json', 'triage', 'accept', 'iss_1'])

      expect(output).toHaveBeenCalledWith(
        updatedIssue,
        expect.objectContaining({ json: true }),
        expect.any(Function),
      )
    })
  })

  describe('triage decline', () => {
    it('PATCHes issue status to canceled', async () => {
      const updatedIssue = { data: { id: 'iss_2', number: 2, title: 'Noise', status: 'canceled' } }
      mockApi.jsonFn.mockResolvedValue(updatedIssue)

      await program.parseAsync(['node', 'looped', 'triage', 'decline', 'iss_2'])

      expect(mockApi.patchMock).toHaveBeenCalledWith('api/issues/iss_2', {
        json: { status: 'canceled' },
      })
    })

    it('does not post a comment when no reason is provided', async () => {
      const updatedIssue = { data: { id: 'iss_2', status: 'canceled' } }
      mockApi.jsonFn.mockResolvedValue(updatedIssue)

      await program.parseAsync(['node', 'looped', 'triage', 'decline', 'iss_2'])

      expect(mockApi.postMock).not.toHaveBeenCalled()
    })

    it('POSTs comment when reason is provided', async () => {
      const updatedIssue = { data: { id: 'iss_2', status: 'canceled' } }
      mockApi.jsonFn.mockResolvedValue(updatedIssue)

      await program.parseAsync(['node', 'looped', 'triage', 'decline', 'iss_2', 'Not actionable'])

      expect(mockApi.patchMock).toHaveBeenCalledWith('api/issues/iss_2', {
        json: { status: 'canceled' },
      })
      expect(mockApi.postMock).toHaveBeenCalledWith('api/issues/iss_2/comments', {
        json: { body: 'Not actionable', authorName: 'looped-cli', authorType: 'human' },
      })
    })

    it('prints confirmation message', async () => {
      const updatedIssue = { data: { id: 'iss_2', status: 'canceled' } }
      mockApi.jsonFn.mockResolvedValue(updatedIssue)
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await program.parseAsync(['node', 'looped', 'triage', 'decline', 'iss_2'])

      const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
      renderFn(updatedIssue)

      expect(consoleSpy).toHaveBeenCalledWith('Issue iss_2 declined')
      consoleSpy.mockRestore()
    })

    it('supports --json mode', async () => {
      const updatedIssue = { data: { id: 'iss_2', status: 'canceled' } }
      mockApi.jsonFn.mockResolvedValue(updatedIssue)

      await program.parseAsync(['node', 'looped', '--json', 'triage', 'decline', 'iss_2'])

      expect(output).toHaveBeenCalledWith(
        updatedIssue,
        expect.objectContaining({ json: true }),
        expect.any(Function),
      )
    })
  })
})
