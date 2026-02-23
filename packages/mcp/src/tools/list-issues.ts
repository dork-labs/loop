import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../types.js';
import { handleToolCall } from './error-handler.js';

/** Shape of the paginated response from GET /api/issues. */
interface ListIssuesApiResponse {
  data: Array<{
    id: string;
    number: number;
    title: string;
    type: string;
    status: string;
    priority: number;
    [key: string]: unknown;
  }>;
  total: number;
}

/**
 * Register the `loop_list_issues` tool on the MCP server.
 *
 * @param server - The MCP server to register the tool on
 * @param client - Authenticated API client for Loop
 */
export function registerListIssues(server: McpServer, client: ApiClient): void {
  server.tool(
    'loop_list_issues',
    'List issues from Loop with optional filters for status, type, and project. Returns paginated results.',
    {
      status: z
        .enum(['triage', 'backlog', 'todo', 'in_progress', 'done', 'canceled'])
        .optional()
        .describe('Filter by issue status'),
      type: z
        .enum(['signal', 'hypothesis', 'plan', 'task', 'monitor'])
        .optional()
        .describe('Filter by issue type'),
      projectId: z.string().optional().describe('Filter by project ID'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of issues to return (1-100, default 20)'),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Number of issues to skip for pagination'),
    },
    {
      readOnlyHint: true,
      idempotentHint: true,
    },
    async ({ status, type, projectId, limit, offset }) => {
      return handleToolCall(async () => {
        const effectiveLimit = limit ?? 20;
        const effectiveOffset = offset ?? 0;
        const searchParams: Record<string, string> = {};
        if (status) searchParams.status = status;
        if (type) searchParams.type = type;
        if (projectId) searchParams.projectId = projectId;
        searchParams.limit = String(effectiveLimit);
        searchParams.offset = String(effectiveOffset);

        const response = await client
          .get('api/issues', { searchParams })
          .json<ListIssuesApiResponse>();

        const issues = response.data.map((issue) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          type: issue.type,
          status: issue.status,
          priority: issue.priority,
        }));

        const hasMore = effectiveOffset + effectiveLimit < response.total;

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ issues, total: response.total, hasMore }, null, 2),
            },
          ],
        };
      });
    }
  );
}
