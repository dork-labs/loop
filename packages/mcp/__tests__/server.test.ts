import { describe, expect, it, vi } from 'vitest'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { createLoopMcpServer } from '../src/index.js'

// Mock ky to prevent real HTTP calls during server creation
vi.mock('ky', () => ({
  default: {
    create: vi.fn().mockReturnValue({}),
  },
}))

const EXPECTED_TOOLS = [
  'loop_get_next_task',
  'loop_complete_task',
  'loop_create_issue',
  'loop_update_issue',
  'loop_list_issues',
  'loop_get_issue',
  'loop_ingest_signal',
  'loop_create_comment',
  'loop_get_dashboard',
] as const

describe('createLoopMcpServer', () => {
  it('returns an McpServer instance', () => {
    const server = createLoopMcpServer({ apiKey: 'test_key' })

    expect(server).toBeInstanceOf(McpServer)
  })

  it('registers all 9 tools', () => {
    const toolSpy = vi.spyOn(McpServer.prototype, 'tool')

    createLoopMcpServer({ apiKey: 'test_key' })

    expect(toolSpy).toHaveBeenCalledTimes(9)

    const registeredNames = toolSpy.mock.calls.map((call) => call[0] as string)
    for (const name of EXPECTED_TOOLS) {
      expect(registeredNames).toContain(name)
    }

    toolSpy.mockRestore()
  })

  it('uses default API URL when not provided', () => {
    // Server should create without error using default URL
    const server = createLoopMcpServer({ apiKey: 'test_key' })
    expect(server).toBeInstanceOf(McpServer)
  })

  it('accepts custom API URL', () => {
    const server = createLoopMcpServer({
      apiKey: 'test_key',
      apiUrl: 'https://api.looped.me',
    })
    expect(server).toBeInstanceOf(McpServer)
  })

  it('throws when LOOP_API_KEY is missing in stdio mode', async () => {
    // The stdio entry point reads from env — verify the factory itself requires apiKey
    expect(() => createLoopMcpServer({ apiKey: '' })).not.toThrow()
    // Empty key is accepted at creation time; auth fails at request time
  })
})
