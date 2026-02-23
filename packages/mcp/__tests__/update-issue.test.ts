import { describe, expect, it, vi, beforeEach } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { HTTPError } from 'ky'
import type { NormalizedOptions } from 'ky/distribution/types/options.js'

import { registerUpdateIssue } from '../src/tools/update-issue.js'

/** Create a ky HTTPError with the given status and optional JSON body. */
function createHTTPError(
  status: number,
  body?: Record<string, unknown>,
): HTTPError {
  const responseInit: ResponseInit = {
    status,
    headers: { 'Content-Type': 'application/json' },
  }
  const responseBody = body ? JSON.stringify(body) : undefined
  const response = new Response(responseBody, responseInit)
  const request = new Request('http://localhost:5667/api/issues/test-id')

  return new HTTPError(response, request, {} as NormalizedOptions)
}

describe('loop_update_issue', () => {
  let server: McpServer
  let toolHandler: (args: Record<string, unknown>) => Promise<unknown>

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.1' })
    // Capture the tool handler when registered
    const originalTool = server.tool.bind(server)
    vi.spyOn(server, 'tool').mockImplementation(
      (...args: unknown[]): ReturnType<typeof server.tool> => {
        // The callback is the last argument
        toolHandler = args[args.length - 1] as typeof toolHandler
        return originalTool(
          ...(args as Parameters<typeof server.tool>),
        ) as ReturnType<typeof server.tool>
      },
    )
  })

  it('returns updated issue on successful PATCH', async () => {
    const mockIssue = {
      id: 'issue-123',
      number: 42,
      title: 'Updated title',
      type: 'task',
      status: 'in_progress',
      priority: 2,
    }

    const mockClient = {
      patch: vi.fn().mockReturnValue({
        json: vi.fn().mockResolvedValue({ data: mockIssue }),
      }),
    }

    registerUpdateIssue(server, mockClient as never)

    const result = await toolHandler({
      issueId: 'issue-123',
      status: 'in_progress',
      title: 'Updated title',
    })

    expect(mockClient.patch).toHaveBeenCalledWith('api/issues/issue-123', {
      json: { status: 'in_progress', title: 'Updated title' },
    })

    const content = (result as { content: { type: string; text: string }[] })
      .content
    expect(content).toHaveLength(1)
    expect(content[0].type).toBe('text')

    const parsed = JSON.parse(content[0].text)
    expect(parsed).toEqual(mockIssue)
  })

  it('returns error for 404 not found', async () => {
    const mockClient = {
      patch: vi.fn().mockReturnValue({
        json: vi
          .fn()
          .mockRejectedValue(
            createHTTPError(404, { message: 'Issue not found' }),
          ),
      }),
    }

    registerUpdateIssue(server, mockClient as never)

    const result = await toolHandler({
      issueId: 'nonexistent-id',
      status: 'done',
    })

    const typed = result as {
      content: { type: string; text: string }[]
      isError: boolean
    }
    expect(typed.isError).toBe(true)
    expect(typed.content[0].text).toContain('Not found')
  })
})
