import { describe, expect, it, vi } from 'vitest'

import { registerGetDashboard } from '../src/tools/get-dashboard.js'
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

describe('registerGetDashboard', () => {
  const mockStats = {
    issues: {
      total: 42,
      byStatus: { triage: 5, todo: 12, in_progress: 8, done: 15, cancelled: 2 },
      byType: { bug: 10, feature: 20, chore: 12 },
    },
    goals: {
      total: 6,
      active: 4,
      achieved: 2,
    },
    dispatch: {
      queueDepth: 12,
      activeCount: 3,
      completedLast24h: 7,
    },
  }

  it('registers the tool with correct name and read-only annotations', () => {
    const server = createMockServer()
    const client = {} as ApiClient

    registerGetDashboard(server as never, client)

    expect(server.tool).toHaveBeenCalledWith(
      'loop_get_dashboard',
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({
        readOnlyHint: true,
        idempotentHint: true,
      }),
      expect.any(Function),
    )
  })

  it('returns dashboard stats from the API', async () => {
    const server = createMockServer()
    const jsonFn = vi.fn().mockResolvedValue({ data: mockStats })
    const getFn = vi.fn().mockReturnValue({ json: jsonFn })
    const client = { get: getFn } as unknown as ApiClient

    registerGetDashboard(server as never, client)
    const handler = server.getHandler()
    const result = (await handler({})) as {
      content: Array<{ type: string; text: string }>
      isError?: boolean
    }

    expect(getFn).toHaveBeenCalledWith('api/dashboard/stats')
    expect(result.isError).toBeUndefined()

    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.issues.total).toBe(42)
    expect(parsed.goals.active).toBe(4)
    expect(parsed.dispatch.queueDepth).toBe(12)
    expect(parsed).toEqual(mockStats)
  })
})
