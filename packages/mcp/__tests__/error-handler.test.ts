import { describe, expect, it } from 'vitest'
import { HTTPError } from 'ky'
import type { NormalizedOptions } from 'ky/distribution/types/options.js'

import { handleToolCall } from '../src/tools/error-handler.js'

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

describe('handleToolCall', () => {
  it('passes through successful results', async () => {
    const result = await handleToolCall(async () => ({
      content: [{ type: 'text', text: 'success' }],
    }))

    expect(result).toEqual({
      content: [{ type: 'text', text: 'success' }],
    })
    expect(result.isError).toBeUndefined()
  })

  it('returns "Not found" message for 404 HTTPError', async () => {
    const error = createHTTPError(404, { message: 'Issue not found' })

    const result = await handleToolCall(async () => {
      throw error
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Not found: Issue not found. Use loop_list_issues to find valid IDs.',
    })
  })

  it('returns "Authentication failed" message for 401 HTTPError', async () => {
    const error = createHTTPError(401, { message: 'Unauthorized' })

    const result = await handleToolCall(async () => {
      throw error
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Authentication failed. Check your LOOP_API_KEY.',
    })
  })

  it('returns generic API error for 500 HTTPError', async () => {
    const error = createHTTPError(500, { message: 'Internal server error' })

    const result = await handleToolCall(async () => {
      throw error
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'API error (500): Internal server error',
    })
  })

  it('falls back to error.message when response body has no message', async () => {
    const error = createHTTPError(422, {})

    const result = await handleToolCall(async () => {
      throw error
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toMatch(/^API error \(422\):/)
  })

  it('returns "Unexpected error" for non-HTTP errors', async () => {
    const result = await handleToolCall(async () => {
      throw new TypeError('Cannot read properties of undefined')
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Unexpected error: TypeError: Cannot read properties of undefined',
    })
  })

  it('returns "Unexpected error" for string errors', async () => {
    const result = await handleToolCall(async () => {
      throw 'something went wrong'
    })

    expect(result.isError).toBe(true)
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Unexpected error: something went wrong',
    })
  })

  it('sets isError: true on all error responses', async () => {
    const errors = [
      createHTTPError(404, { message: 'not found' }),
      createHTTPError(401, { message: 'unauthorized' }),
      createHTTPError(500, { message: 'server error' }),
      new Error('generic'),
    ]

    for (const error of errors) {
      const result = await handleToolCall(async () => {
        throw error
      })
      expect(result.isError).toBe(true)
    }
  })
})
