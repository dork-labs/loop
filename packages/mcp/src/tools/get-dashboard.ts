import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ApiClient } from '../types.js'
import { handleToolCall } from './error-handler.js'

/**
 * Register the `loop_get_dashboard` tool on the MCP server.
 *
 * Returns system health metrics including issue counts, goal progress,
 * and dispatch queue status.
 *
 * @param server - MCP server instance to register the tool on
 * @param client - Pre-configured ky HTTP client for the Loop API
 */
export function registerGetDashboard(server: McpServer, client: ApiClient): void {
  server.tool(
    'loop_get_dashboard',
    'Get system health metrics: issue counts, goal progress, and dispatch queue status',
    {},
    {
      readOnlyHint: true,
      idempotentHint: true,
    },
    async () => {
      return handleToolCall(async () => {
        const res = await client
          .get('api/dashboard/stats')
          .json<{ data: Record<string, unknown> }>()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res.data, null, 2),
            },
          ],
        }
      })
    },
  )
}
