import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { CLAUDE_MD_BLOCK, CLAUDE_MD_SENTINEL } from '../templates/claude-md.js';
import { buildMcpServerEntry } from '../templates/mcp-config.js';
import { CURSOR_RULES_CONTENT } from '../templates/cursor-rules.js';
import { OPENHANDS_MICROAGENT_CONTENT } from '../templates/openhands-microagent.js';

/** Result of a file write operation. */
export interface WriteResult {
  status: 'written' | 'skipped' | 'conflict';
  path: string;
  reason?: string;
}

/**
 * Write or update .env.local with LOOP_API_KEY and LOOP_API_URL.
 *
 * - Creates the file if it doesn't exist
 * - Appends missing keys at end of file
 * - Returns 'skipped' if both keys already match
 * - Returns 'conflict' if a key exists with a different value
 *
 * @param apiKey - Loop API key
 * @param apiUrl - Loop API base URL
 * @param cwd - Working directory (defaults to process.cwd())
 */
export function writeEnvLocal(
  apiKey: string,
  apiUrl: string,
  cwd: string = process.cwd()
): WriteResult {
  const filePath = join(cwd, '.env.local');
  const desired: Record<string, string> = {
    LOOP_API_KEY: apiKey,
    LOOP_API_URL: apiUrl,
  };

  let existing = '';
  if (existsSync(filePath)) {
    existing = readFileSync(filePath, 'utf-8');
  }

  // Parse existing env vars
  const existingVars = new Map<string, string>();
  for (const line of existing.split('\n')) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (match) {
      existingVars.set(match[1], match[2]);
    }
  }

  // Check for conflicts
  for (const [key, value] of Object.entries(desired)) {
    const existingVal = existingVars.get(key);
    if (existingVal !== undefined && existingVal !== value) {
      return {
        status: 'conflict',
        path: filePath,
        reason: `${key} already set to a different value`,
      };
    }
  }

  // Check if all already present
  const allPresent = Object.entries(desired).every(
    ([key, value]) => existingVars.get(key) === value
  );
  if (allPresent) {
    return { status: 'skipped', path: filePath, reason: 'All keys already set' };
  }

  // Append missing keys
  const lines: string[] = [];
  for (const [key, value] of Object.entries(desired)) {
    if (!existingVars.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  const separator = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  writeFileSync(filePath, existing + separator + lines.join('\n') + '\n', 'utf-8');
  return { status: 'written', path: filePath };
}

/**
 * Write or merge .mcp.json with the Loop MCP server entry.
 *
 * - Creates the file if it doesn't exist
 * - Backs up malformed JSON to .mcp.json.bak
 * - Skips if mcpServers.loop already exists
 * - Preserves existing MCP server entries
 *
 * @param apiKey - Loop API key
 * @param apiUrl - Loop API base URL
 * @param cwd - Working directory (defaults to process.cwd())
 */
export function writeMcpJson(
  apiKey: string,
  apiUrl: string,
  cwd: string = process.cwd()
): WriteResult {
  const filePath = join(cwd, '.mcp.json');
  let config: Record<string, unknown> = {};

  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf-8');
    try {
      config = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      // Malformed JSON — back up and start fresh
      writeFileSync(join(cwd, '.mcp.json.bak'), raw, 'utf-8');
      config = {};
    }
  }

  const servers = (config.mcpServers ?? {}) as Record<string, unknown>;
  if (servers.loop) {
    return { status: 'skipped', path: filePath, reason: 'mcpServers.loop already exists' };
  }

  servers.loop = buildMcpServerEntry(apiKey, apiUrl);
  config.mcpServers = servers;

  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
  return { status: 'written', path: filePath };
}

/**
 * Append the Loop context block to CLAUDE.md.
 *
 * - Checks for sentinel comment to prevent duplicate appends
 * - Skips if sentinel is already present
 *
 * @param cwd - Working directory (defaults to process.cwd())
 */
export function writeClaudeMdBlock(cwd: string = process.cwd()): WriteResult {
  const filePath = join(cwd, 'CLAUDE.md');

  if (!existsSync(filePath)) {
    return { status: 'skipped', path: filePath, reason: 'CLAUDE.md does not exist' };
  }

  const content = readFileSync(filePath, 'utf-8');
  if (content.includes(CLAUDE_MD_SENTINEL)) {
    return { status: 'skipped', path: filePath, reason: 'Loop block already present' };
  }

  const separator = content.endsWith('\n') ? '' : '\n';
  writeFileSync(filePath, content + separator + CLAUDE_MD_BLOCK, 'utf-8');
  return { status: 'written', path: filePath };
}

/**
 * Write Cursor rules file for Loop integration.
 *
 * - Creates .cursor/rules/ directory recursively
 * - Skips if .cursor/rules/loop.mdc already exists
 *
 * @param cwd - Working directory (defaults to process.cwd())
 */
export function writeCursorRules(cwd: string = process.cwd()): WriteResult {
  const filePath = join(cwd, '.cursor', 'rules', 'loop.mdc');

  if (existsSync(filePath)) {
    return { status: 'skipped', path: filePath, reason: 'File already exists' };
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, CURSOR_RULES_CONTENT, 'utf-8');
  return { status: 'written', path: filePath };
}

/**
 * Write OpenHands microagent file for Loop integration.
 *
 * - Creates .openhands/microagents/ directory recursively
 * - Skips if .openhands/microagents/loop.md already exists
 *
 * @param cwd - Working directory (defaults to process.cwd())
 */
export function writeOpenHandsMicroagent(cwd: string = process.cwd()): WriteResult {
  const filePath = join(cwd, '.openhands', 'microagents', 'loop.md');

  if (existsSync(filePath)) {
    return { status: 'skipped', path: filePath, reason: 'File already exists' };
  }

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, OPENHANDS_MICROAGENT_CONTENT, 'utf-8');
  return { status: 'written', path: filePath };
}
