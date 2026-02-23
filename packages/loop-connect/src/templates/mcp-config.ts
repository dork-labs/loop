/**
 * Build the MCP server entry for .mcp.json.
 *
 * @param apiKey - Loop API key
 * @param apiUrl - Loop API base URL
 * @returns The mcpServers.loop object
 */
export function buildMcpServerEntry(apiKey: string, apiUrl: string) {
  return {
    command: 'npx',
    args: ['-y', '@dork-labs/loop-mcp'],
    env: {
      LOOP_API_KEY: apiKey,
      LOOP_API_URL: apiUrl,
    },
  };
}
