import { HTTPError } from 'ky';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Wrap an MCP tool handler with standardized error handling for ky HTTP errors.
 *
 * Catches ky `HTTPError` instances and maps them to MCP-friendly error responses
 * with actionable messages. Non-HTTP errors are caught and returned as generic errors.
 *
 * @param fn - Async function that performs the tool's work and returns a `CallToolResult`
 */
export async function handleToolCall(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HTTPError) {
      const status = error.response.status;
      const body = await error.response.json().catch(() => null);
      const message = (body as Record<string, unknown> | null)?.message ?? error.message;

      if (status === 404) {
        return {
          content: [
            {
              type: 'text',
              text: `Not found: ${message}. Use loop_list_issues to find valid IDs.`,
            },
          ],
          isError: true,
        };
      }

      if (status === 401) {
        return {
          content: [
            {
              type: 'text',
              text: 'Authentication failed. Check your LOOP_API_KEY.',
            },
          ],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `API error (${status}): ${message}` }],
        isError: true,
      };
    }

    return {
      content: [{ type: 'text', text: `Unexpected error: ${String(error)}` }],
      isError: true,
    };
  }
}
