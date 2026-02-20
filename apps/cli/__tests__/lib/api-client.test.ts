import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'

vi.mock('node:fs')
vi.mock('node:os')
vi.mock('ky', () => {
  const mockInstance = { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  }
})

beforeEach(() => {
  vi.mocked(os.homedir).mockReturnValue('/mock-home')
})

afterEach(() => {
  vi.restoreAllMocks()
})

const originalEnv = process.env

beforeEach(() => {
  process.env = { ...originalEnv }
  delete process.env.LOOP_API_URL
  delete process.env.LOOP_API_TOKEN
})

afterEach(() => {
  process.env = originalEnv
})

async function loadModule() {
  vi.resetModules()
  return import('../../src/lib/api-client.js')
}

async function loadKy() {
  vi.resetModules()
  return (await import('ky')).default
}

describe('createApiClient', () => {
  it('creates ky instance with correct prefixUrl and Authorization header', async () => {
    const config = { url: 'https://api.looped.me', token: 'tok_abc123xyz789' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config))

    const { createApiClient } = await loadModule()
    const ky = await loadKy()

    createApiClient()

    expect(ky.create).toHaveBeenCalledWith({
      prefixUrl: 'https://api.looped.me',
      headers: {
        Authorization: 'Bearer tok_abc123xyz789',
      },
      retry: {
        limit: 2,
        statusCodes: [429, 500, 503],
      },
    })
  })

  it('exits with error message when url is missing', async () => {
    const config = { token: 'tok_abc123xyz789' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config))

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { createApiClient } = await loadModule()

    expect(() => createApiClient()).toThrow('process.exit called')
    expect(mockError).toHaveBeenCalledWith(
      'No API URL configured. Run: looped config set url <url>'
    )
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('exits with error message when token is missing', async () => {
    const config = { url: 'https://api.looped.me' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config))

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { createApiClient } = await loadModule()

    expect(() => createApiClient()).toThrow('process.exit called')
    expect(mockError).toHaveBeenCalledWith(
      'No auth token configured. Run: looped config set token <token>'
    )
    expect(mockExit).toHaveBeenCalledWith(1)

    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('uses global options (--api-url, --token) when provided', async () => {
    const config = { url: 'https://file.example.com', token: 'tok_from_file' }
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config))

    const { createApiClient } = await loadModule()
    const ky = await loadKy()

    createApiClient({ apiUrl: 'https://flag.example.com', token: 'tok_from_flag' })

    expect(ky.create).toHaveBeenCalledWith(
      expect.objectContaining({
        prefixUrl: 'https://flag.example.com',
        headers: {
          Authorization: 'Bearer tok_from_flag',
        },
      })
    )
  })

  it('uses env vars when CLI flags not provided', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })
    process.env.LOOP_API_URL = 'https://env.example.com'
    process.env.LOOP_API_TOKEN = 'tok_from_env'

    const { createApiClient } = await loadModule()
    const ky = await loadKy()

    createApiClient()

    expect(ky.create).toHaveBeenCalledWith(
      expect.objectContaining({
        prefixUrl: 'https://env.example.com',
        headers: {
          Authorization: 'Bearer tok_from_env',
        },
      })
    )
  })

  it('exits when both url and token are missing', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT')
    })

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { createApiClient } = await loadModule()

    expect(() => createApiClient()).toThrow('process.exit called')
    expect(mockError).toHaveBeenCalledWith(
      'No API URL configured. Run: looped config set url <url>'
    )

    mockExit.mockRestore()
    mockError.mockRestore()
  })
})
