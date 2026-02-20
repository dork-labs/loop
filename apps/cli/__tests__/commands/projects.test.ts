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
import { registerProjectsCommand } from '../../src/commands/projects.js'
import type { Project, PaginatedResponse } from '../../src/types.js'

/** Build a fake project for testing. */
function fakeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_1',
    name: 'Test Project',
    description: 'A test project',
    status: 'active',
    health: 'on_track',
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-02-10T12:00:00Z',
    ...overrides,
  }
}

describe('projects command', () => {
  let program: Command
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let mockJson: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    program = new Command()
    program.exitOverride()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')

    registerProjectsCommand(program)

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    mockJson = vi.fn()
    mockGet = vi.fn().mockReturnValue({ json: mockJson })
    vi.mocked(createApiClient).mockReturnValue({ get: mockGet } as unknown as ReturnType<typeof createApiClient>)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('projects list', () => {
    it('fetches projects from the API with default pagination', async () => {
      const response: PaginatedResponse<Project> = {
        data: [fakeProject()],
        total: 1,
      }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', 'projects', 'list'])

      expect(mockGet).toHaveBeenCalledWith('api/projects', {
        searchParams: { limit: '50', offset: '0' },
      })
    })

    it('passes custom limit and offset to the API', async () => {
      const response: PaginatedResponse<Project> = { data: [], total: 0 }
      mockJson.mockResolvedValue(response)

      await program.parseAsync([
        'node', 'looped', 'projects', 'list', '--limit', '10', '--offset', '20',
      ])

      expect(mockGet).toHaveBeenCalledWith('api/projects', {
        searchParams: { limit: '10', offset: '20' },
      })
    })

    it('renders a table with project data', async () => {
      const response: PaginatedResponse<Project> = {
        data: [
          fakeProject({ name: 'Alpha', status: 'active', health: 'on_track' }),
          fakeProject({ name: 'Beta', status: 'completed', health: 'at_risk' }),
        ],
        total: 2,
      }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', 'projects', 'list'])

      // Table header + rows are logged via console.log
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allOutput).toContain('Alpha')
      expect(allOutput).toContain('Beta')
      expect(allOutput).toContain('Showing 2 of 2 projects')
    })

    it('shows empty message when no projects found', async () => {
      const response: PaginatedResponse<Project> = { data: [], total: 0 }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', 'projects', 'list'])

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allOutput).toContain('No projects found')
    })

    it('outputs raw JSON when --json flag is set', async () => {
      const response: PaginatedResponse<Project> = {
        data: [fakeProject()],
        total: 1,
      }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', '--json', 'projects', 'list'])

      expect(stdoutSpy).toHaveBeenCalled()
      const written = stdoutSpy.mock.calls[0]?.[0] as string
      const parsed = JSON.parse(written)
      expect(parsed.data).toHaveLength(1)
      expect(parsed.total).toBe(1)
    })

    it('renders health with color coding', async () => {
      const response: PaginatedResponse<Project> = {
        data: [
          fakeProject({ name: 'Healthy', health: 'on_track' }),
          fakeProject({ name: 'Risky', health: 'at_risk' }),
          fakeProject({ name: 'Behind', health: 'off_track' }),
        ],
        total: 3,
      }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', 'projects', 'list'])

      // Verify table rendered without errors (color codes are terminal-specific)
      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allOutput).toContain('Healthy')
      expect(allOutput).toContain('Risky')
      expect(allOutput).toContain('Behind')
    })

    it('renders status with color coding', async () => {
      const response: PaginatedResponse<Project> = {
        data: [
          fakeProject({ name: 'Proj1', status: 'backlog' }),
          fakeProject({ name: 'Proj2', status: 'active' }),
          fakeProject({ name: 'Proj3', status: 'completed' }),
        ],
        total: 3,
      }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', 'projects', 'list'])

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allOutput).toContain('Proj1')
      expect(allOutput).toContain('Proj2')
      expect(allOutput).toContain('Proj3')
    })

    it('truncates long project names', async () => {
      const longName = 'A'.repeat(60)
      const response: PaginatedResponse<Project> = {
        data: [fakeProject({ name: longName })],
        total: 1,
      }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', 'projects', 'list'])

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
      // Should be truncated to 40 chars (39 + ellipsis)
      expect(allOutput).not.toContain(longName)
      expect(allOutput).toContain('\u2026') // ellipsis character
    })

    it('formats dates as YYYY-MM-DD', async () => {
      const response: PaginatedResponse<Project> = {
        data: [fakeProject({ createdAt: '2026-03-15T10:30:00Z' })],
        total: 1,
      }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', 'projects', 'list'])

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
      expect(allOutput).toContain('2026-03-15')
    })

    it('delegates to withErrorHandler for error handling', async () => {
      const { withErrorHandler } = await import('../../src/lib/errors.js')
      const response: PaginatedResponse<Project> = { data: [], total: 0 }
      mockJson.mockResolvedValue(response)

      await program.parseAsync(['node', 'looped', 'projects', 'list'])

      expect(withErrorHandler).toHaveBeenCalled()
    })
  })
})
