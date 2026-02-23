import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  writeEnvLocal,
  writeMcpJson,
  writeClaudeMdBlock,
  writeCursorRules,
  writeOpenHandsMicroagent,
} from '../src/lib/writers.js';
import { CLAUDE_MD_SENTINEL, CLAUDE_MD_BLOCK } from '../src/templates/claude-md.js';
import { CURSOR_RULES_CONTENT } from '../src/templates/cursor-rules.js';
import { OPENHANDS_MICROAGENT_CONTENT } from '../src/templates/openhands-microagent.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);

const FAKE_CWD = '/fake/project';
const FAKE_API_KEY = 'loop_test_key_123';
const FAKE_API_URL = 'https://app.looped.me';

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── writeEnvLocal ──────────────────────────────────────────────────────────

describe('writeEnvLocal', () => {
  it('creates .env.local when the file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeEnvLocal(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('written');
    expect(result.path).toBe(join(FAKE_CWD, '.env.local'));
    expect(mockWriteFileSync).toHaveBeenCalledOnce();
    const written = String(mockWriteFileSync.mock.calls[0][1]);
    expect(written).toContain(`LOOP_API_KEY=${FAKE_API_KEY}`);
    expect(written).toContain(`LOOP_API_URL=${FAKE_API_URL}`);
  });

  it('appends missing keys to an existing .env.local', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(`LOOP_API_KEY=${FAKE_API_KEY}\n`);

    const result = writeEnvLocal(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('written');
    const written = String(mockWriteFileSync.mock.calls[0][1]);
    expect(written).toContain(`LOOP_API_URL=${FAKE_API_URL}`);
    // Should preserve existing content
    expect(written).toContain(`LOOP_API_KEY=${FAKE_API_KEY}`);
  });

  it('returns skipped when both keys already match', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      `LOOP_API_KEY=${FAKE_API_KEY}\nLOOP_API_URL=${FAKE_API_URL}\n`
    );

    const result = writeEnvLocal(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('All keys already set');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('returns conflict when LOOP_API_KEY has a different value', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('LOOP_API_KEY=different_key\n');

    const result = writeEnvLocal(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('conflict');
    expect(result.reason).toContain('LOOP_API_KEY');
    expect(result.reason).toContain('different value');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('returns conflict when LOOP_API_URL has a different value', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      `LOOP_API_KEY=${FAKE_API_KEY}\nLOOP_API_URL=https://other.url\n`
    );

    const result = writeEnvLocal(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('conflict');
    expect(result.reason).toContain('LOOP_API_URL');
  });

  it('adds a newline separator when existing content does not end with newline', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('OTHER_VAR=value');

    const result = writeEnvLocal(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('written');
    const written = String(mockWriteFileSync.mock.calls[0][1]);
    // Should not start appended keys without a newline
    expect(written).toMatch(/OTHER_VAR=value\nLOOP_API_KEY=/);
  });

  it('defaults cwd to process.cwd()', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeEnvLocal(FAKE_API_KEY, FAKE_API_URL);

    expect(result.path).toBe(join(process.cwd(), '.env.local'));
  });
});

// ─── writeMcpJson ───────────────────────────────────────────────────────────

describe('writeMcpJson', () => {
  it('creates .mcp.json when the file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeMcpJson(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('written');
    expect(result.path).toBe(join(FAKE_CWD, '.mcp.json'));
    expect(mockWriteFileSync).toHaveBeenCalledOnce();

    const written = JSON.parse(String(mockWriteFileSync.mock.calls[0][1]));
    expect(written.mcpServers.loop).toBeDefined();
    expect(written.mcpServers.loop.env.LOOP_API_KEY).toBe(FAKE_API_KEY);
    expect(written.mcpServers.loop.env.LOOP_API_URL).toBe(FAKE_API_URL);
  });

  it('merges into existing .mcp.json preserving other servers', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: { other: { command: 'npx', args: ['other-server'] } },
      })
    );

    const result = writeMcpJson(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('written');
    const written = JSON.parse(String(mockWriteFileSync.mock.calls[0][1]));
    expect(written.mcpServers.other).toBeDefined();
    expect(written.mcpServers.loop).toBeDefined();
  });

  it('returns skipped when mcpServers.loop already exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        mcpServers: { loop: { command: 'npx', args: ['@dork-labs/loop-mcp'] } },
      })
    );

    const result = writeMcpJson(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('mcpServers.loop already exists');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('backs up malformed JSON and creates a fresh config', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ not valid json !!!');

    const result = writeMcpJson(FAKE_API_KEY, FAKE_API_URL, FAKE_CWD);

    expect(result.status).toBe('written');
    // Should write backup file
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      join(FAKE_CWD, '.mcp.json.bak'),
      '{ not valid json !!!',
      'utf-8'
    );
    // Should write fresh .mcp.json with loop entry
    const mainWrite = mockWriteFileSync.mock.calls.find(
      (c) => String(c[0]) === join(FAKE_CWD, '.mcp.json')
    );
    expect(mainWrite).toBeDefined();
    const written = JSON.parse(String(mainWrite![1]));
    expect(written.mcpServers.loop).toBeDefined();
  });

  it('defaults cwd to process.cwd()', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeMcpJson(FAKE_API_KEY, FAKE_API_URL);

    expect(result.path).toBe(join(process.cwd(), '.mcp.json'));
  });
});

// ─── writeClaudeMdBlock ─────────────────────────────────────────────────────

describe('writeClaudeMdBlock', () => {
  it('appends Loop block when CLAUDE.md exists without sentinel', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('# My Project\n\nSome content.\n');

    const result = writeClaudeMdBlock(FAKE_CWD);

    expect(result.status).toBe('written');
    expect(result.path).toBe(join(FAKE_CWD, 'CLAUDE.md'));
    const written = String(mockWriteFileSync.mock.calls[0][1]);
    expect(written).toContain(CLAUDE_MD_SENTINEL);
    expect(written).toContain(CLAUDE_MD_BLOCK);
    // Should start with original content
    expect(written).toMatch(/^# My Project/);
  });

  it('returns skipped when CLAUDE.md does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeClaudeMdBlock(FAKE_CWD);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('CLAUDE.md does not exist');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('returns skipped when sentinel is already present', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(`# Project\n\n${CLAUDE_MD_SENTINEL}\nSome block\n`);

    const result = writeClaudeMdBlock(FAKE_CWD);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('Loop block already present');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('adds a newline separator when content does not end with newline', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('# Project\nNo trailing newline');

    const result = writeClaudeMdBlock(FAKE_CWD);

    expect(result.status).toBe('written');
    const written = String(mockWriteFileSync.mock.calls[0][1]);
    // Should add a newline before appending the block
    expect(written).toMatch(/No trailing newline\n/);
  });

  it('defaults cwd to process.cwd()', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeClaudeMdBlock();

    expect(result.path).toBe(join(process.cwd(), 'CLAUDE.md'));
  });
});

// ─── writeCursorRules ───────────────────────────────────────────────────────

describe('writeCursorRules', () => {
  it('creates .cursor/rules/loop.mdc when it does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeCursorRules(FAKE_CWD);

    expect(result.status).toBe('written');
    expect(result.path).toBe(join(FAKE_CWD, '.cursor', 'rules', 'loop.mdc'));
    expect(mockMkdirSync).toHaveBeenCalledWith(join(FAKE_CWD, '.cursor', 'rules'), {
      recursive: true,
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      join(FAKE_CWD, '.cursor', 'rules', 'loop.mdc'),
      CURSOR_RULES_CONTENT,
      'utf-8'
    );
  });

  it('returns skipped when file already exists', () => {
    mockExistsSync.mockReturnValue(true);

    const result = writeCursorRules(FAKE_CWD);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('File already exists');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it('defaults cwd to process.cwd()', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeCursorRules();

    expect(result.path).toBe(join(process.cwd(), '.cursor', 'rules', 'loop.mdc'));
  });
});

// ─── writeOpenHandsMicroagent ───────────────────────────────────────────────

describe('writeOpenHandsMicroagent', () => {
  it('creates .openhands/microagents/loop.md when it does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeOpenHandsMicroagent(FAKE_CWD);

    expect(result.status).toBe('written');
    expect(result.path).toBe(join(FAKE_CWD, '.openhands', 'microagents', 'loop.md'));
    expect(mockMkdirSync).toHaveBeenCalledWith(join(FAKE_CWD, '.openhands', 'microagents'), {
      recursive: true,
    });
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      join(FAKE_CWD, '.openhands', 'microagents', 'loop.md'),
      OPENHANDS_MICROAGENT_CONTENT,
      'utf-8'
    );
  });

  it('returns skipped when file already exists', () => {
    mockExistsSync.mockReturnValue(true);

    const result = writeOpenHandsMicroagent(FAKE_CWD);

    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('File already exists');
    expect(mockWriteFileSync).not.toHaveBeenCalled();
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it('defaults cwd to process.cwd()', () => {
    mockExistsSync.mockReturnValue(false);

    const result = writeOpenHandsMicroagent();

    expect(result.path).toBe(join(process.cwd(), '.openhands', 'microagents', 'loop.md'));
  });
});
