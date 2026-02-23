#!/usr/bin/env node

/**
 * Stdio transport entry point for the Loop MCP server.
 * Run via: npx @dork-labs/loop-mcp
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLoopMcpServer } from './index.js';

const apiKey = process.env.LOOP_API_KEY;
if (!apiKey) {
  console.error('Missing LOOP_API_KEY environment variable.');
  console.error(
    "Generate one with: node -e \"console.log('loop_' + require('crypto').randomBytes(32).toString('hex'))\""
  );
  process.exit(1);
}

const server = createLoopMcpServer({
  apiKey,
  apiUrl: process.env.LOOP_API_URL,
});

const transport = new StdioServerTransport();
await server.connect(transport);
