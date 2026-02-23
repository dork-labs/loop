import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ApiClient } from '../types.js'
import { handleToolCall } from './error-handler.js'

/**
 * Register the `loop_get_next_task` tool on the MCP server.
 *
 * Calls `GET /api/dispatch/next` to atomically claim the highest-priority
 * unblocked issue and return it with hydrated prompt instructions.
 *
 * @param server - MCP server instance to register the tool on
 * @param client - Authenticated ky client for the Loop API
 */
export function registerGetNextTask(server: McpServer, client: ApiClient): void {
  // @ts-expect-error TS2589 — MCP SDK server.tool() overload inference with complex Zod schemas
  server.tool(
    'loop_get_next_task',
    'Get the highest-priority unblocked issue with dispatch instructions. Atomically claims the issue. Returns issue details and hydrated prompt.',
    { projectId: z.string().optional().describe('Filter to a specific project') },
    async ({ projectId }) => {
      return handleToolCall(async () => {
        const searchParams: Record<string, string> = {}
        if (projectId) searchParams.projectId = projectId

        const response = await client.get('api/dispatch/next', { searchParams })

        // Dispatch returns 204 when queue is empty (no body)
        if (response.status === 204) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No tasks available. The dispatch queue is empty.',
              },
            ],
          }
        }

        const result = (await response.json()) as Record<string, unknown>

        if (!result || !result.issue) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'No tasks available. The dispatch queue is empty.',
              },
            ],
          }
        }

        const issue = result.issue as Record<string, unknown>
        const structured = {
          issue: {
            id: issue.id,
            number: issue.number,
            title: issue.title,
            type: issue.type,
            priority: issue.priority,
            status: issue.status,
          },
          prompt: result.prompt ?? null,
          meta: result.meta ?? null,
        }

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(structured, null, 2),
            },
          ],
          structuredContent: structured,
        }
      })
    },
  )
}
