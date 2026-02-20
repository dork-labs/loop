import { describe, it, expect, vi, afterEach } from 'vitest'
import { HTTPError } from 'ky'

// We test withErrorHandler by importing it directly (no module mocking needed)

async function loadModule() {
  vi.resetModules()
  return import('../../src/lib/errors.js')
}

/** Create a mock HTTPError with the given status and optional JSON body. */
function createHTTPError(status: number, body?: Record<string, string>): HTTPError {
  const response = {
    status,
    json: body ? vi.fn().mockResolvedValue(body) : vi.fn().mockRejectedValue(new Error('no body')),
  } as unknown as Response

  const request = {} as Request
  const options = {} as RequestInit

  return new HTTPError(response, request, options)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('withErrorHandler', () => {
  it('runs the function normally when no error occurs', async () => {
    const { withErrorHandler } = await loadModule()
    const fn = vi.fn().mockResolvedValue(undefined)

    await withErrorHandler(fn)

    expect(fn).toHaveBeenCalledOnce()
  })

  it('prints auth failure message for 401 status', async () => {
    const { withErrorHandler } = await loadModule()
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      withErrorHandler(async () => {
        throw createHTTPError(401, { error: 'Unauthorized' })
      })
    ).rejects.toThrow('process.exit called')

    expect(mockError).toHaveBeenCalledWith(
      'Authentication failed. Run: looped config set token <your-token>'
    )
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('prints auth failure message for 403 status', async () => {
    const { withErrorHandler } = await loadModule()
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      withErrorHandler(async () => {
        throw createHTTPError(403, { error: 'Forbidden' })
      })
    ).rejects.toThrow('process.exit called')

    expect(mockError).toHaveBeenCalledWith(
      'Authentication failed. Run: looped config set token <your-token>'
    )
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('prints "Not found" message for 404 status', async () => {
    const { withErrorHandler } = await loadModule()
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      withErrorHandler(async () => {
        throw createHTTPError(404, { error: 'Issue not found' })
      })
    ).rejects.toThrow('process.exit called')

    expect(mockError).toHaveBeenCalledWith('Not found: Issue not found')
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('prints status code and message for other HTTP errors', async () => {
    const { withErrorHandler } = await loadModule()
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      withErrorHandler(async () => {
        throw createHTTPError(500, { error: 'Internal server error' })
      })
    ).rejects.toThrow('process.exit called')

    expect(mockError).toHaveBeenCalledWith('API error (500): Internal server error')
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('falls back to error.message when response body has no error field', async () => {
    const { withErrorHandler } = await loadModule()
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      withErrorHandler(async () => {
        throw createHTTPError(502)
      })
    ).rejects.toThrow('process.exit called')

    // When json() rejects, falls back to error.message from HTTPError
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('API error (502):'))
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('prints error message for non-HTTP errors', async () => {
    const { withErrorHandler } = await loadModule()
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      withErrorHandler(async () => {
        throw new Error('Network timeout')
      })
    ).rejects.toThrow('process.exit called')

    expect(mockError).toHaveBeenCalledWith('Error: Network timeout')
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('exits with code 1 for all errors', async () => {
    const { withErrorHandler } = await loadModule()
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      withErrorHandler(async () => {
        throw new TypeError('Unexpected type')
      })
    ).rejects.toThrow('process.exit called')

    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
  })
})
