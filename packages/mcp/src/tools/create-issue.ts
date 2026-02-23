import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../types.js';
import { handleToolCall } from './error-handler.js';

/**
 * Register the `loop_create_issue` tool on the MCP server.
 *
 * @param server - The MCP server to register the tool on
 * @param client - Authenticated API client for Loop
 */
export function registerCreateIssue(server: McpServer, client: ApiClient): void {
  server.tool(
    'loop_create_issue',
    'Create a new issue in Loop. Issues are the atomic unit of work — signals, hypotheses, plans, tasks, and monitors are all issue types.',
    {
      title: z.string().min(1).max(500).describe('Issue title'),
      type: z
        .enum(['signal', 'hypothesis', 'plan', 'task', 'monitor'])
        .optional()
        .describe('Issue type (default: task)'),
      priority: z
        .number()
        .int()
        .min(0)
        .max(4)
        .optional()
        .describe('0=none, 1=urgent, 2=high, 3=medium, 4=low (default: 0)'),
      projectId: z.string().optional().describe('Project to assign the issue to'),
      description: z.string().optional(),
      parentId: z.string().optional().describe('Parent issue ID for hierarchy'),
    },
    {
      readOnlyHint: false,
      idempotentHint: false,
    },
    async ({ title, type, priority, projectId, description, parentId }) => {
      return handleToolCall(async () => {
        const res = await client
          .post('api/issues', {
            json: {
              title,
              type: type ?? 'task',
              priority: priority ?? 0,
              ...(projectId && { projectId }),
              ...(description && { description }),
              ...(parentId && { parentId }),
            },
          })
          .json<{
            data: {
              id: string;
              number: number;
              title: string;
              type: string;
              status: string;
              priority: number;
            };
          }>();
        const issue = res.data;

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
                2
              ),
            },
          ],
        };
      });
    }
  );
}
