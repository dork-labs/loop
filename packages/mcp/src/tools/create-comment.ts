import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ApiClient } from '../types.js'
import { handleToolCall } from './error-handler.js'

/**
 * Register the `loop_create_comment` tool on the MCP server.
 *
 * Posts a comment on an issue with agent attribution.
 *
 * @param server - MCP server instance to register the tool on
 * @param client - Pre-configured ky HTTP client for the Loop API
 */
export function registerCreateComment(server: McpServer, client: ApiClient): void {
  server.tool(
    'loop_create_comment',
    'Post a comment on an issue as the agent',
    {
      issueId: z.string().describe('ID of the issue to comment on'),
      body: z.string().min(1).describe('Comment text'),
    },
    {
      readOnlyHint: false,
      idempotentHint: false,
    },
    async ({ issueId, body }) => {
      return handleToolCall(async () => {
        const commentRes = await client
          .post(`api/issues/${issueId}/comments`, {
            json: { body, authorName: 'agent', authorType: 'agent' },
          })
          .json<{ data: Record<string, unknown> }>()
        const comment = commentRes.data

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  id: comment.id,
                  body: comment.body,
                  authorName: comment.authorName,
                  createdAt: comment.createdAt,
                },
                null,
                2,
              ),
            },
          ],
        }
      })
    },
  )
}
