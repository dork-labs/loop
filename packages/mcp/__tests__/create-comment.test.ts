import { describe, expect, it, vi } from 'vitest'
import { HTTPError } from 'ky'
import type { NormalizedOptions } from 'ky/distribution/types/options.js'

import { registerCreateComment } from '../src/tools/create-comment.js'
import type { ApiClient } from '../src/types.js'

/** Create a mock McpServer that captures the tool handler. */
function createMockServer() {
  let handler: (args: Record<string, unknown>) => Promise<unknown>

  return {
    tool: vi.fn(
      (
        _name: string,
        _description: string,
        _schema: unknown,
        _annotations: unknown,
        fn: (args: Record<string, unknown>) => Promise<unknown>,
      ) => {
        handler = fn
      },
    ),
    getHandler: () => handler,
  }
}

/** Create a mock API client with chainable .post().json() pattern. */
function createMockClient(response: Record<string, unknown>) {
  const jsonFn = vi.fn().mockResolvedValue(response)
  const postFn = vi.fn().mockReturnValue({ json: jsonFn })

  return {
    client: { post: postFn } as unknown as ApiClient,
    postFn,
    jsonFn,
  }
}

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
  const request = new Request('http://localhost:5667/api/test')

  return new HTTPError(response, request, {} as NormalizedOptions)
}

describe('registerCreateComment', () => {
  const mockComment = {
    id: 'comment_abc123',
    body: 'Investigation complete. Root cause identified.',
    authorName: 'agent',
    authorType: 'agent',
    createdAt: '2026-02-22T12:00:00.000Z',
    issueId: 'issue_xyz',
  }

  it('registers the tool with correct name and annotations', () => {
    const server = createMockServer()
    const { client } = createMockClient({ data: mockComment })

    registerCreateComment(server as never, client)

    expect(server.tool).toHaveBeenCalledWith(
      'loop_create_comment',
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        readOnlyHint: false,
        idempotentHint: false,
      }),
      expect.any(Function),
    )
  })

  it('posts a comment and returns the created comment fields', async () => {
    const server = createMockServer()
    const { client, postFn } = createMockClient({ data: mockComment })

    registerCreateComment(server as never, client)
    const handler = server.getHandler()
    const result = (await handler({
      issueId: 'issue_xyz',
      body: 'Investigation complete. Root cause identified.',
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean }

    expect(postFn).toHaveBeenCalledWith('api/issues/issue_xyz/comments', {
      json: {
        body: 'Investigation complete. Root cause identified.',
        authorName: 'agent',
        authorType: 'agent',
      },
    })

    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed).toEqual({
      id: 'comment_abc123',
      body: 'Investigation complete. Root cause identified.',
      authorName: 'agent',
      createdAt: '2026-02-22T12:00:00.000Z',
    })
  })

  it('returns a not-found error for missing issues', async () => {
    const server = createMockServer()
    const error = createHTTPError(404, { message: 'Issue not found' })
    const postFn = vi.fn().mockReturnValue({
      json: vi.fn().mockRejectedValue(error),
    })
    const client = { post: postFn } as unknown as ApiClient

    registerCreateComment(server as never, client)
    const handler = server.getHandler()
    const result = (await handler({
      issueId: 'issue_nonexistent',
      body: 'This should fail',
    })) as { content: Array<{ type: string; text: string }>; isError?: boolean }

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Not found')
  })
})
