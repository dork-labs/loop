import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../types.js';
import { handleToolCall } from './error-handler.js';

/**
 * Register the `loop_get_issue` tool on the MCP server.
 *
 * @param server - The MCP server to register the tool on
 * @param client - Authenticated API client for Loop
 */
export function registerGetIssue(server: McpServer, client: ApiClient): void {
  server.tool(
    'loop_get_issue',
    'Get full details of a single issue by ID, including labels, comments, and relations.',
    {
      issueId: z.string().describe('ID of the issue to retrieve'),
    },
    {
      readOnlyHint: true,
      idempotentHint: true,
    },
    async ({ issueId }) => {
      return handleToolCall(async () => {
        const res = await client
          .get(`api/issues/${issueId}`)
          .json<{ data: Record<string, unknown> }>();

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(res.data, null, 2),
            },
          ],
        };
      });
    }
  );
}
