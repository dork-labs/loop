import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Command } from 'commander'

// Mock dependencies before importing the command
vi.mock('../../src/lib/config.js', () => ({
  readConfig: vi.fn().mockReturnValue({}),
  writeConfig: vi.fn(),
  maskToken: vi.fn(),
  resolveConfig: vi.fn().mockReturnValue({
    url: 'https://api.looped.me',
    token: 'tok_test123',
  }),
}))

vi.mock('../../src/lib/api-client.js', () => ({
  createApiClient: vi.fn(),
}))

vi.mock('../../src/lib/errors.js', () => ({
  withErrorHandler: vi.fn(async (fn: () => Promise<void>) => fn()),
}))

import { createApiClient } from '../../src/lib/api-client.js'
import { registerCommentCommand } from '../../src/commands/comment.js'

describe('comment command', () => {
  let program: Command
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let stdoutSpy: ReturnType<typeof vi.spyOn>
  let mockPost: ReturnType<typeof vi.fn>

  beforeEach(() => {
    program = new Command()
    program.exitOverride()
    program
      .option('--json', 'Output raw JSON')
      .option('--api-url <url>', 'Override API URL')
      .option('--token <token>', 'Override auth token')

    registerCommentCommand(program)

    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    mockPost = vi.fn().mockReturnValue({
      json: vi.fn().mockResolvedValue({
        data: { id: 'cmt_1', body: 'This needs review', issueId: 'abc123' },
      }),
    })

    vi.mocked(createApiClient).mockReturnValue({ post: mockPost } as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST to correct endpoint with issue ID', async () => {
    await program.parseAsync(['node', 'looped', 'comment', 'abc123', 'This needs review'])

    expect(mockPost).toHaveBeenCalledWith('api/issues/abc123/comments', {
      json: { body: 'This needs review', authorName: 'looped-cli', authorType: 'human' },
    })
  })

  it('request body includes body, authorName, and authorType', async () => {
    await program.parseAsync(['node', 'looped', 'comment', 'issue-42', 'Fix the bug'])

    const callArgs = mockPost.mock.calls[0]
    expect(callArgs[1].json).toEqual({
      body: 'Fix the bug',
      authorName: 'looped-cli',
      authorType: 'human',
    })
  })

  it('outputs confirmation message', async () => {
    await program.parseAsync(['node', 'looped', 'comment', 'abc123', 'This needs review'])

    expect(consoleSpy).toHaveBeenCalledWith('Comment added to issue abc123')
  })

  it('outputs JSON in --json mode', async () => {
    const responseData = {
      data: { id: 'cmt_1', body: 'This needs review', issueId: 'abc123' },
    }
    mockPost.mockReturnValue({
      json: vi.fn().mockResolvedValue(responseData),
    })

    await program.parseAsync(['node', 'looped', '--json', 'comment', 'abc123', 'This needs review'])

    expect(stdoutSpy).toHaveBeenCalledWith(JSON.stringify(responseData, null, 2) + '\n')
    // Should NOT print the human-readable message
    expect(consoleSpy).not.toHaveBeenCalled()
  })
})
