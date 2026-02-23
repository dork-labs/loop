/**
 * Loop MCP Server — factory export for creating the MCP server instance.
 *
 * @module @dork-labs/loop-mcp
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createApiClient } from './client.js'
import { registerAllTools } from './tools/index.js'
import type { LoopMcpConfig } from './types.js'

export { type LoopMcpConfig, type ApiClient, type ApiClientConfig } from './types.js'

const DEFAULT_API_URL = 'http://localhost:5667'

/**
 * Create a configured Loop MCP server with all tools registered.
 *
 * @param config - API key and optional API URL
 * @returns A ready-to-connect McpServer instance
 */
export function createLoopMcpServer(config: LoopMcpConfig): McpServer {
  const server = new McpServer({
    name: 'loop-mcp',
    version: '0.1.0',
  })

  const client = createApiClient({
    apiKey: config.apiKey,
    apiUrl: config.apiUrl ?? DEFAULT_API_URL,
  })

  registerAllTools(server, client)

  return server
}
