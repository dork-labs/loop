/**
 * Build a Cursor protocol deeplink for one-click MCP server installation.
 *
 * @param apiUrl - Loop API base URL
 * @param apiKey - Loop API key
 */
export function buildCursorDeeplink(apiUrl: string, apiKey: string): string {
  const config = {
    command: 'npx',
    args: ['-y', '@dork-labs/loop-mcp', '--api-url', apiUrl, '--api-key', apiKey],
  };
  const encoded = btoa(JSON.stringify(config));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=loop&config=${encoded}`;
}

/**
 * Build a Cursor web fallback deeplink for environments where cursor:// protocol isn't available.
 *
 * @param apiUrl - Loop API base URL
 * @param apiKey - Loop API key
 */
export function buildCursorWebDeeplink(apiUrl: string, apiKey: string): string {
  const config = {
    command: 'npx',
    args: ['-y', '@dork-labs/loop-mcp', '--api-url', apiUrl, '--api-key', apiKey],
  };
  const encoded = encodeURIComponent(btoa(JSON.stringify(config)));
  return `https://cursor.com/link/mcp/install?name=loop&config=${encoded}`;
}
