import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../types.js';
import { registerGetNextTask } from './get-next-task.js';
import { registerCompleteTask } from './complete-task.js';
import { registerCreateIssue } from './create-issue.js';
import { registerUpdateIssue } from './update-issue.js';
import { registerListIssues } from './list-issues.js';
import { registerGetIssue } from './get-issue.js';
import { registerIngestSignal } from './ingest-signal.js';
import { registerCreateComment } from './create-comment.js';
import { registerGetDashboard } from './get-dashboard.js';

/**
 * Register all Loop MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on
 * @param client - Authenticated API client for Loop
 */
export function registerAllTools(server: McpServer, client: ApiClient): void {
  registerGetNextTask(server, client);
  registerCompleteTask(server, client);
  registerCreateIssue(server, client);
  registerUpdateIssue(server, client);
  registerListIssues(server, client);
  registerGetIssue(server, client);
  registerIngestSignal(server, client);
  registerCreateComment(server, client);
  registerGetDashboard(server, client);
}
