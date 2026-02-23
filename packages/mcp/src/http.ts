/**
 * HTTP transport entry point for mounting the Loop MCP server in a Hono app.
 *
 * @module @dork-labs/loop-mcp/http
 */

import { Hono } from 'hono';
import { StreamableHTTPTransport } from '@hono/mcp';
import { createLoopMcpServer } from './index.js';
import type { LoopMcpConfig } from './types.js';

/**
 * Create a Hono app that handles MCP Streamable HTTP requests.
 *
 * Mount this on your existing Hono server at `/mcp`:
 * ```ts
 * import { createMcpHandler } from '@dork-labs/loop-mcp/http'
 * app.route('/mcp', createMcpHandler({ apiKey: env.LOOP_API_KEY }))
 * ```
 *
 * @param config - API key and optional API URL
 */
export function createMcpHandler(config: LoopMcpConfig): Hono {
  const mcpApp = new Hono();
  const server = createLoopMcpServer(config);
  const transport = new StreamableHTTPTransport();

  server.connect(transport);

  mcpApp.all('*', async (c) => {
    const response = await transport.handleRequest(c);
    return response ?? c.json({ error: 'No response from MCP transport' }, 500);
  });

  return mcpApp;
}
