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
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { output } from '../../src/lib/output.js'
import { registerSignalCommand } from '../../src/commands/signal.js'

const MOCK_SIGNAL_RESPONSE = {
  data: {
    signal: {
      id: 'sig_abc123',
      source: 'manual',
      sourceId: null,
      type: 'manual-signal',
      severity: 'medium',
      payload: { message: 'Error rate spike' },
      issueId: 'iss_xyz789',
      createdAt: '2026-02-20T10:00:00Z',
    },
    issue: {
      id: 'iss_xyz789',
      number: 42,
      title: 'Error rate spike',
      type: 'signal',
      status: 'triage',
      priority: 3,
      createdAt: '2026-02-20T10:00:00Z',
      updatedAt: '2026-02-20T10:00:00Z',
    },
  },
}

describe('signal command', () => {
  let program: Command
  let mockJson: ReturnType<typeof vi.fn>
  let mockPost: ReturnType<typeof vi.fn>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    program = new Command()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')
    program.exitOverride()
    registerSignalCommand(program)

    mockJson = vi.fn().mockResolvedValue(MOCK_SIGNAL_RESPONSE)
    mockPost = vi.fn().mockReturnValue({ json: mockJson })
    vi.mocked(createApiClient).mockReturnValue({
      post: mockPost,
    } as unknown as ReturnType<typeof createApiClient>)

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST to /api/signals with correct default body', async () => {
    await program.parseAsync(['node', 'looped', 'signal', 'Error rate spike'])

    expect(mockPost).toHaveBeenCalledWith('api/signals', {
      json: {
        source: 'manual',
        type: 'manual-signal',
        severity: 'medium',
        payload: { message: 'Error rate spike' },
      },
    })
  })

  it('uses default source "manual" and severity "medium"', async () => {
    await program.parseAsync(['node', 'looped', 'signal', 'Something happened'])

    const callArgs = mockPost.mock.calls[0][1].json
    expect(callArgs.source).toBe('manual')
    expect(callArgs.severity).toBe('medium')
  })

  it('--source flag overrides default source', async () => {
    await program.parseAsync(['node', 'looped', 'signal', '--source', 'ci', 'Build failed'])

    const callArgs = mockPost.mock.calls[0][1].json
    expect(callArgs.source).toBe('ci')
  })

  it('--severity flag overrides default severity', async () => {
    await program.parseAsync(['node', 'looped', 'signal', '--severity', 'high', 'Critical error'])

    const callArgs = mockPost.mock.calls[0][1].json
    expect(callArgs.severity).toBe('high')
  })

  it('--project passes projectId in body', async () => {
    await program.parseAsync([
      'node', 'looped', 'signal',
      '--project', 'proj_abc',
      'Error in project',
    ])

    expect(mockPost).toHaveBeenCalledWith('api/signals', {
      json: {
        source: 'manual',
        type: 'manual-signal',
        severity: 'medium',
        payload: { message: 'Error in project' },
        projectId: 'proj_abc',
      },
    })
  })

  it('outputs signal ID and linked issue number in default mode', async () => {
    await program.parseAsync(['node', 'looped', 'signal', 'Error rate spike'])

    expect(output).toHaveBeenCalledWith(
      MOCK_SIGNAL_RESPONSE,
      expect.any(Object),
      expect.any(Function),
    )

    // Execute the render callback to verify console output
    const renderFn = vi.mocked(output).mock.calls[0][2] as (d: unknown) => void
    renderFn(MOCK_SIGNAL_RESPONSE)

    expect(consoleSpy).toHaveBeenCalledWith('Signal created: sig_abc123')
    expect(consoleSpy).toHaveBeenCalledWith('Linked issue: #42 Error rate spike')
  })

  it('outputs raw JSON when --json flag is set', async () => {
    await program.parseAsync(['node', 'looped', '--json', 'signal', 'Error rate spike'])

    expect(output).toHaveBeenCalledWith(
      MOCK_SIGNAL_RESPONSE,
      expect.objectContaining({ json: true }),
      expect.any(Function),
    )
  })

  it('combines --source, --severity, and --project flags', async () => {
    await program.parseAsync([
      'node', 'looped', 'signal',
      '--source', 'ci',
      '--severity', 'critical',
      '--project', 'proj_xyz',
      'Deployment failed',
    ])

    expect(mockPost).toHaveBeenCalledWith('api/signals', {
      json: {
        source: 'ci',
        type: 'manual-signal',
        severity: 'critical',
        payload: { message: 'Deployment failed' },
        projectId: 'proj_xyz',
      },
    })
  })

  it('creates API client with global options', async () => {
    await program.parseAsync([
      'node', 'looped',
      '--api-url', 'https://custom.api.com',
      '--token', 'tok_custom',
      'signal', 'Test signal',
    ])

    expect(createApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: 'https://custom.api.com',
        token: 'tok_custom',
      }),
    )
  })
})
