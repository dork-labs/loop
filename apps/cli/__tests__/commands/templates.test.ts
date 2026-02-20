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
  truncate: vi.fn((str: string, maxLen: number) =>
    str.length <= maxLen ? str : str.slice(0, maxLen - 1) + '\u2026',
  ),
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { output } from '../../src/lib/output.js'
import { registerTemplatesCommand } from '../../src/commands/templates.js'
import type { PromptTemplate, PromptVersion } from '../../src/types.js'

const MOCK_TEMPLATES: PromptTemplate[] = [
  {
    id: 'tpl_abc123def456',
    slug: 'investigate-signal',
    name: 'Investigate Signal',
    description: 'Template for investigating signals',
    conditions: { type: 'signal' },
    specificity: 10,
    activeVersionId: 'ver_active1',
    projectId: null,
    createdAt: '2026-01-10T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'tpl_xyz789ghi012',
    slug: 'plan-task',
    name: 'Plan Task Execution',
    description: null,
    conditions: { type: 'plan' },
    specificity: 20,
    activeVersionId: null,
    projectId: 'proj_abc',
    createdAt: '2026-01-12T10:00:00Z',
    updatedAt: '2026-01-12T10:00:00Z',
  },
]

const MOCK_VERSIONS: PromptVersion[] = [
  {
    id: 'ver_active1',
    templateId: 'tpl_abc123def456',
    version: 3,
    content: 'You are investigating a signal...',
    changelog: 'Improved clarity',
    authorType: 'human',
    authorName: 'alice',
    status: 'active',
    reviewScore: 4.2,
    usageCount: 42,
    completionRate: 0.85,
    createdAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'ver_retired1',
    templateId: 'tpl_abc123def456',
    version: 2,
    content: 'Previous version content...',
    changelog: 'Initial rewrite',
    authorType: 'agent',
    authorName: 'loop-agent',
    status: 'retired',
    reviewScore: 3.1,
    usageCount: 100,
    completionRate: 0.72,
    createdAt: '2026-01-12T10:00:00Z',
  },
  {
    id: 'ver_draft1',
    templateId: 'tpl_abc123def456',
    version: 4,
    content: 'Draft version...',
    changelog: null,
    authorType: 'human',
    authorName: 'bob',
    status: 'draft',
    reviewScore: null,
    usageCount: 0,
    completionRate: null,
    createdAt: '2026-01-16T10:00:00Z',
  },
]

const MOCK_LIST_RESPONSE = { data: MOCK_TEMPLATES, total: 2 }
const MOCK_SHOW_RESPONSE = {
  data: {
    ...MOCK_TEMPLATES[0],
    activeVersion: MOCK_VERSIONS[0],
  },
}
const MOCK_VERSIONS_RESPONSE = { data: MOCK_VERSIONS, total: 3 }

describe('templates command', () => {
  let program: Command
  let mockJson: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>
  let mockPost: ReturnType<typeof vi.fn>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    program = new Command()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')
    program.exitOverride()
    registerTemplatesCommand(program)

    mockJson = vi.fn()
    mockGet = vi.fn().mockReturnValue({ json: mockJson })
    mockPost = vi.fn().mockReturnValue({ json: mockJson })
    vi.mocked(createApiClient).mockReturnValue({
      get: mockGet,
      post: mockPost,
    } as unknown as ReturnType<typeof createApiClient>)

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── templates list ──────────────────────────────────────────────────────

  describe('templates list', () => {
    beforeEach(() => {
      mockJson.mockResolvedValue(MOCK_LIST_RESPONSE)
    })

    it('calls GET /api/templates with default limit=50, offset=0', async () => {
      await program.parseAsync(['node', 'looped', 'templates', 'list'])

      expect(mockGet).toHaveBeenCalledWith('api/templates', {
        searchParams: { limit: '50', offset: '0' },
      })
    })

    it('passes custom --limit and --offset as query params', async () => {
      await program.parseAsync([
        'node', 'looped', 'templates', 'list',
        '--limit', '10',
        '--offset', '20',
      ])

      expect(mockGet).toHaveBeenCalledWith('api/templates', {
        searchParams: { limit: '10', offset: '20' },
      })
    })

    it('calls output with the API response', async () => {
      await program.parseAsync(['node', 'looped', 'templates', 'list'])

      expect(output).toHaveBeenCalledWith(
        MOCK_LIST_RESPONSE,
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('outputs raw JSON when --json flag is set', async () => {
      await program.parseAsync(['node', 'looped', '--json', 'templates', 'list'])

      expect(output).toHaveBeenCalledWith(
        MOCK_LIST_RESPONSE,
        expect.objectContaining({ json: true }),
        expect.any(Function),
      )
    })

    it('renders table with template data when render callback is invoked', async () => {
      await program.parseAsync(['node', 'looped', 'templates', 'list'])

      // Execute the render callback
      const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
      renderFn(MOCK_LIST_RESPONSE)

      // Should have called console.log for the table output
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('renders empty state when no templates found', async () => {
      mockJson.mockResolvedValue({ data: [], total: 0 })

      await program.parseAsync(['node', 'looped', 'templates', 'list'])

      const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
      renderFn({ data: [], total: 0 })

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No templates found'))
    })
  })

  // ── templates show ──────────────────────────────────────────────────────

  describe('templates show', () => {
    beforeEach(() => {
      // First call returns template detail, second returns versions
      mockJson
        .mockResolvedValueOnce(MOCK_SHOW_RESPONSE)
        .mockResolvedValueOnce(MOCK_VERSIONS_RESPONSE)
    })

    it('calls GET /api/templates/:id and GET /api/templates/:id/versions', async () => {
      await program.parseAsync(['node', 'looped', 'templates', 'show', 'tpl_abc123def456'])

      expect(mockGet).toHaveBeenCalledWith('api/templates/tpl_abc123def456')
      expect(mockGet).toHaveBeenCalledWith('api/templates/tpl_abc123def456/versions', {
        searchParams: { limit: '10' },
      })
    })

    it('calls output with combined template + versions data', async () => {
      await program.parseAsync(['node', 'looped', 'templates', 'show', 'tpl_abc123def456'])

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tpl_abc123def456',
          slug: 'investigate-signal',
          versions: MOCK_VERSIONS,
        }),
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('outputs raw JSON when --json flag is set', async () => {
      await program.parseAsync([
        'node', 'looped', '--json', 'templates', 'show', 'tpl_abc123def456',
      ])

      expect(output).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ json: true }),
        expect.any(Function),
      )
    })

    it('renders detail view with active version info', async () => {
      await program.parseAsync(['node', 'looped', 'templates', 'show', 'tpl_abc123def456'])

      const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
      renderFn(null)

      // Should print template name and version details
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Investigate Signal'))
    })

    it('renders detail view without active version when none set', async () => {
      const noActiveResponse = {
        data: { ...MOCK_TEMPLATES[1], activeVersion: null },
      }
      mockJson.mockReset()
      mockJson
        .mockResolvedValueOnce(noActiveResponse)
        .mockResolvedValueOnce({ data: [], total: 0 })

      await program.parseAsync(['node', 'looped', 'templates', 'show', 'tpl_xyz789ghi012'])

      const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
      renderFn(null)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No active version'))
    })
  })

  // ── templates promote ─────────────────────────────────────────────────

  describe('templates promote', () => {
    const PROMOTED_VERSION: PromptVersion = {
      ...MOCK_VERSIONS[2],
      status: 'active',
    }

    beforeEach(() => {
      mockJson.mockResolvedValue({ data: PROMOTED_VERSION })
    })

    it('calls POST /api/templates/:templateId/versions/:versionId/promote', async () => {
      await program.parseAsync([
        'node', 'looped', 'templates', 'promote', 'tpl_abc123def456', 'ver_draft1',
      ])

      expect(mockPost).toHaveBeenCalledWith(
        'api/templates/tpl_abc123def456/versions/ver_draft1/promote',
      )
    })

    it('calls output with the promoted version data', async () => {
      await program.parseAsync([
        'node', 'looped', 'templates', 'promote', 'tpl_abc123def456', 'ver_draft1',
      ])

      expect(output).toHaveBeenCalledWith(
        PROMOTED_VERSION,
        expect.any(Object),
        expect.any(Function),
      )
    })

    it('renders success message when promote completes', async () => {
      await program.parseAsync([
        'node', 'looped', 'templates', 'promote', 'tpl_abc123def456', 'ver_draft1',
      ])

      const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
      renderFn(null)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Promoted version 4 to active'),
      )
    })

    it('outputs raw JSON when --json flag is set', async () => {
      await program.parseAsync([
        'node', 'looped', '--json',
        'templates', 'promote', 'tpl_abc123def456', 'ver_draft1',
      ])

      expect(output).toHaveBeenCalledWith(
        PROMOTED_VERSION,
        expect.objectContaining({ json: true }),
        expect.any(Function),
      )
    })

    it('creates API client with global options', async () => {
      await program.parseAsync([
        'node', 'looped',
        '--api-url', 'https://custom.api.com',
        '--token', 'tok_custom',
        'templates', 'promote', 'tpl_abc123def456', 'ver_draft1',
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
