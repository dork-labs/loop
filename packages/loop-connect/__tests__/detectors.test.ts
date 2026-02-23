import { describe, it, expect, vi, beforeEach } from 'vitest';
import { join } from 'node:path';

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import { existsSync, readFileSync } from 'node:fs';
import { detectEnvironment } from '../src/lib/detectors.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);

const FAKE_CWD = '/fake/project';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('detectEnvironment', () => {
  it('returns all true when every file/directory exists and .env.local is in .gitignore', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('node_modules\n.env.local\n.env\n');

    const result = detectEnvironment(FAKE_CWD);

    expect(result).toEqual({
      hasClaudeMd: true,
      hasCursor: true,
      hasOpenHands: true,
      hasMcpJson: true,
      hasGitignore: true,
      envLocalIgnored: true,
    });
  });

  it('returns all false when no files exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = detectEnvironment(FAKE_CWD);

    expect(result).toEqual({
      hasClaudeMd: false,
      hasCursor: false,
      hasOpenHands: false,
      hasMcpJson: false,
      hasGitignore: false,
      envLocalIgnored: false,
    });
    // readFileSync should never be called when .gitignore does not exist
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('detects partial environments (only CLAUDE.md and .gitignore)', () => {
    mockExistsSync.mockImplementation((filePath) => {
      const p = String(filePath);
      if (p === join(FAKE_CWD, 'CLAUDE.md')) return true;
      if (p === join(FAKE_CWD, '.gitignore')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('dist\n');

    const result = detectEnvironment(FAKE_CWD);

    expect(result).toEqual({
      hasClaudeMd: true,
      hasCursor: false,
      hasOpenHands: false,
      hasMcpJson: false,
      hasGitignore: true,
      envLocalIgnored: false,
    });
  });

  describe('gitignore parsing', () => {
    beforeEach(() => {
      // Make all existsSync calls return true so .gitignore is read
      mockExistsSync.mockReturnValue(true);
    });

    it('detects .env.local with surrounding whitespace on the line', () => {
      mockReadFileSync.mockReturnValue('node_modules\n  .env.local  \n');

      const result = detectEnvironment(FAKE_CWD);

      expect(result.envLocalIgnored).toBe(true);
    });

    it('does not match partial patterns like .env.local.bak', () => {
      mockReadFileSync.mockReturnValue('.env.local.bak\n');

      const result = detectEnvironment(FAKE_CWD);

      expect(result.envLocalIgnored).toBe(false);
    });

    it('does not match substrings like my-.env.local', () => {
      mockReadFileSync.mockReturnValue('my-.env.local\n');

      const result = detectEnvironment(FAKE_CWD);

      expect(result.envLocalIgnored).toBe(false);
    });

    it('detects .env.local when it is the only line', () => {
      mockReadFileSync.mockReturnValue('.env.local');

      const result = detectEnvironment(FAKE_CWD);

      expect(result.envLocalIgnored).toBe(true);
    });

    it('detects .env.local among many entries', () => {
      mockReadFileSync.mockReturnValue('node_modules\n.env\n.env.local\ndist\ncoverage\n');

      const result = detectEnvironment(FAKE_CWD);

      expect(result.envLocalIgnored).toBe(true);
    });

    it('returns envLocalIgnored false when .gitignore has no .env.local entry', () => {
      mockReadFileSync.mockReturnValue('node_modules\ndist\n');

      const result = detectEnvironment(FAKE_CWD);

      expect(result.envLocalIgnored).toBe(false);
    });
  });

  describe('read failure handling', () => {
    it('returns envLocalIgnored false when readFileSync throws', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const result = detectEnvironment(FAKE_CWD);

      expect(result.hasGitignore).toBe(true);
      expect(result.envLocalIgnored).toBe(false);
    });
  });

  describe('cwd parameter', () => {
    it('defaults to process.cwd() when no argument is provided', () => {
      mockExistsSync.mockReturnValue(false);

      detectEnvironment();

      // All existsSync calls should use process.cwd() as base
      const calls = mockExistsSync.mock.calls.map((c) => String(c[0]));
      for (const call of calls) {
        expect(call).toContain(process.cwd());
      }
    });

    it('uses the provided cwd for all file lookups', () => {
      const customCwd = '/custom/path';
      mockExistsSync.mockReturnValue(false);

      detectEnvironment(customCwd);

      const calls = mockExistsSync.mock.calls.map((c) => String(c[0]));
      expect(calls).toContain(join(customCwd, 'CLAUDE.md'));
      expect(calls).toContain(join(customCwd, '.cursor'));
      expect(calls).toContain(join(customCwd, '.openhands'));
      expect(calls).toContain(join(customCwd, '.mcp.json'));
      expect(calls).toContain(join(customCwd, '.gitignore'));
    });
  });
});
