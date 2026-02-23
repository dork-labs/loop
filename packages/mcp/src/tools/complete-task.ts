import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { ApiClient } from '../types.js';
import { handleToolCall } from './error-handler.js';

/**
 * Register the `loop_complete_task` tool on the MCP server.
 *
 * Marks an issue as done, posts an outcome comment, and identifies
 * any issues that were blocked by the completed one.
 *
 * @param server - MCP server instance to register the tool on
 * @param client - Pre-configured ky HTTP client for the Loop API
 */
export function registerCompleteTask(server: McpServer, client: ApiClient): void {
  server.tool(
    'loop_complete_task',
    'Mark an issue as done, record what was accomplished, and find newly unblocked issues',
    {
      issueId: z.string().describe('ID of the issue to complete'),
      outcome: z.string().describe('Summary of what was accomplished'),
    },
    {
      readOnlyHint: false,
      idempotentHint: true,
    },
    async ({ issueId, outcome }) => {
      return handleToolCall(async () => {
        // 1. Mark the issue as done
        const issueRes = await client
          .patch(`api/issues/${issueId}`, { json: { status: 'done' } })
          .json<{ data: Record<string, unknown> }>();
        const issue = issueRes.data;

        // 2. Post an outcome comment
        const commentRes = await client
          .post(`api/issues/${issueId}/comments`, {
            json: { body: outcome, authorName: 'agent', authorType: 'agent' },
          })
          .json<{ data: Record<string, unknown> }>();
        const comment = commentRes.data;

        // 3. Find issues that were blocked by this one
        const todoIssues = await client
          .get('api/issues', { searchParams: { status: 'todo' } })
          .json<{ data: Array<Record<string, unknown>> }>();

        const unblockedIssues = todoIssues.data.filter((i: Record<string, unknown>) => {
          const relations = i.relations as Array<Record<string, unknown>> | undefined;
          return relations?.some((r) => r.type === 'blocked_by' && r.targetId === issueId);
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ issue, comment, unblockedIssues }, null, 2),
            },
          ],
        };
      });
    }
  );
}
