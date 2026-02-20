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
  TYPE_ICON: {
    signal: '\u26A1',
    hypothesis: '\uD83D\uDD2C',
    plan: '\uD83D\uDCCB',
    task: '\uD83D\uDD27',
    monitor: '\uD83D\uDC41',
  },
}))

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { output } from '../../src/lib/output.js'
import { select } from '@inquirer/prompts'
import { registerCreateCommand } from '../../src/commands/create.js'
import type { Issue } from '../../src/types.js'

const MOCK_ISSUE: Issue = {
  id: 'iss_new',
  number: 42,
  title: 'Fix login timeout',
  type: 'task',
  status: 'triage',
  priority: 2,
  projectId: null,
  createdAt: '2026-02-20T10:00:00Z',
  updatedAt: '2026-02-20T10:00:00Z',
}

const MOCK_RESPONSE = { data: MOCK_ISSUE }

describe('create command', () => {
  let program: Command
  let mockJson: ReturnType<typeof vi.fn>
  let mockPost: ReturnType<typeof vi.fn>
  let mockGet: ReturnType<typeof vi.fn>
  let consoleSpy: ReturnType<typeof vi.spyOn>
  const originalIsTTY = process.stdout.isTTY

  beforeEach(() => {
    program = new Command()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')
    program.exitOverride()
    registerCreateCommand(program)

    mockJson = vi.fn().mockResolvedValue(MOCK_RESPONSE)
    mockPost = vi.fn().mockReturnValue({ json: mockJson })
    mockGet = vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    })
    vi.mocked(createApiClient).mockReturnValue({
      post: mockPost,
      get: mockGet,
    } as unknown as ReturnType<typeof createApiClient>)

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true })
  })

  it('creates issue with all flags provided (no prompts)', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })

    await program.parseAsync([
      'node', 'looped', 'create', 'Fix login timeout',
      '--type', 'task',
      '--priority', '2',
      '--project', 'proj_abc',
      '--description', 'Login times out after 30s',
      '--parent', 'iss_parent',
    ])

    expect(mockPost).toHaveBeenCalledWith('api/issues', {
      json: {
        title: 'Fix login timeout',
        type: 'task',
        priority: 2,
        projectId: 'proj_abc',
        description: 'Login times out after 30s',
        parentId: 'iss_parent',
      },
    })
  })

  it('uses defaults in non-TTY mode when flags omitted', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })

    await program.parseAsync(['node', 'looped', 'create', 'Quick fix'])

    expect(mockPost).toHaveBeenCalledWith('api/issues', {
      json: {
        title: 'Quick fix',
        type: 'task',
        priority: 3,
      },
    })
  })

  it('sends correct POST body to API', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })

    await program.parseAsync([
      'node', 'looped', 'create', 'New signal issue',
      '--type', 'signal',
      '--priority', '1',
    ])

    expect(mockPost).toHaveBeenCalledWith('api/issues', {
      json: {
        title: 'New signal issue',
        type: 'signal',
        priority: 1,
      },
    })
  })

  it('prompts for type in TTY mode when --type not provided', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })

    vi.mocked(select)
      .mockResolvedValueOnce('hypothesis') // type prompt
      .mockResolvedValueOnce('1')          // priority prompt
      .mockResolvedValueOnce('')           // project prompt (none)

    // Mock projects list for TTY mode
    mockGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({
        data: [{ id: 'proj_1', name: 'Alpha' }],
        total: 1,
      }),
    })

    await program.parseAsync(['node', 'looped', 'create', 'Test hypothesis'])

    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Issue type:' }),
    )
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Priority:' }),
    )
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Project:' }),
    )

    expect(mockPost).toHaveBeenCalledWith('api/issues', {
      json: {
        title: 'Test hypothesis',
        type: 'hypothesis',
        priority: 1,
      },
    })
  })

  it('skips project prompt when no projects exist in TTY mode', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })

    vi.mocked(select)
      .mockResolvedValueOnce('task') // type prompt
      .mockResolvedValueOnce('3')    // priority prompt

    await program.parseAsync(['node', 'looped', 'create', 'No projects'])

    // select should be called twice (type + priority) but NOT for project
    expect(select).toHaveBeenCalledTimes(2)
  })

  it('includes project when selected in TTY mode', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })

    vi.mocked(select)
      .mockResolvedValueOnce('plan')      // type prompt
      .mockResolvedValueOnce('0')         // priority prompt
      .mockResolvedValueOnce('proj_abc')  // project prompt

    mockGet.mockReturnValue({
      json: vi.fn().mockResolvedValue({
        data: [{ id: 'proj_abc', name: 'Alpha Project' }],
        total: 1,
      }),
    })

    await program.parseAsync(['node', 'looped', 'create', 'New plan'])

    expect(mockPost).toHaveBeenCalledWith('api/issues', {
      json: {
        title: 'New plan',
        type: 'plan',
        priority: 0,
        projectId: 'proj_abc',
      },
    })
  })

  it('does not prompt when --type and --priority flags are provided in TTY mode', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true })

    await program.parseAsync([
      'node', 'looped', 'create', 'Flagged issue',
      '--type', 'monitor',
      '--priority', '4',
      '--project', 'proj_xyz',
    ])

    // select should not be called since all flags were provided
    expect(select).not.toHaveBeenCalled()

    expect(mockPost).toHaveBeenCalledWith('api/issues', {
      json: {
        title: 'Flagged issue',
        type: 'monitor',
        priority: 4,
        projectId: 'proj_xyz',
      },
    })
  })

  it('outputs JSON in --json mode', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })

    await program.parseAsync(['node', 'looped', 'create', 'JSON test', '--json', '--type', 'task', '--priority', '3'])

    expect(output).toHaveBeenCalledWith(
      MOCK_RESPONSE,
      expect.objectContaining({ json: true }),
      expect.any(Function),
    )
  })

  it('renders confirmation message with issue number and type icon', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })

    await program.parseAsync(['node', 'looped', 'create', 'Fix bug', '--type', 'task', '--priority', '2'])

    // Execute the render callback
    const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
    renderFn(MOCK_RESPONSE)

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

  it('creates API client with global options', async () => {
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true })

    await program.parseAsync([
      'node', 'looped',
      '--api-url', 'https://custom.api.com',
      '--token', 'tok_custom',
      'create', 'Test issue',
      '--type', 'task',
      '--priority', '3',
    ])

    expect(createApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: 'https://custom.api.com',
        token: 'tok_custom',
      }),
    )
  })
})
