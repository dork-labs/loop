import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { ApiClient } from '../types.js'
import { handleToolCall } from './error-handler.js'

const ISSUE_STATUSES = [
  'triage',
  'backlog',
  'todo',
  'in_progress',
  'done',
  'canceled',
] as const

const ISSUE_TYPES = [
  'signal',
  'hypothesis',
  'plan',
  'task',
  'monitor',
] as const

const inputSchema = {
  issueId: z.string().describe('ID of the issue to update'),
  status: z
    .enum(ISSUE_STATUSES)
    .optional()
    .describe('New status for the issue'),
  priority: z
    .number()
    .int()
    .min(0)
    .max(4)
    .optional()
    .describe('Priority level (0=none, 1=urgent, 2=high, 3=medium, 4=low)'),
  type: z
    .enum(ISSUE_TYPES)
    .optional()
    .describe('Issue type'),
  title: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe('New title for the issue'),
  description: z.string().optional().describe('New description for the issue'),
}

interface IssueResponse {
  id: string
  number: number
  title: string
  type: string
  status: string
  priority: number
}

/**
 * Register the loop_update_issue tool on the MCP server.
 *
 * @param server - The MCP server to register the tool on
 * @param client - Authenticated API client for Loop
 */
export function registerUpdateIssue(
  server: McpServer,
  client: ApiClient,
): void {
  // @ts-expect-error TS2589 — MCP SDK server.tool() overload inference with complex Zod schemas
  server.tool(
    'loop_update_issue',
    'Update an existing issue in Loop (status, priority, type, title, or description)',
    inputSchema,
    async ({ issueId, ...updates }) => {
      return handleToolCall(async () => {
        const res = await client
          .patch(`api/issues/${issueId}`, { json: updates })
          .json<{ data: IssueResponse }>()
        const issue = res.data

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  id: issue.id,
                  number: issue.number,
                  title: issue.title,
                  type: issue.type,
                  status: issue.status,
                  priority: issue.priority,
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
