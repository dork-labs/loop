import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  password: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  select: vi.fn(),
  text: vi.fn(),
  confirm: vi.fn(),
  note: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock node:fs (used by writers and detectors)
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import * as p from '@clack/prompts';
import { existsSync, writeFileSync } from 'node:fs';
import { run, type RunOptions } from '../src/index.js';
import type { LoopProject, ProjectListResponse } from '../src/lib/api.js';

const mockExistsSync = vi.mocked(existsSync);
const mockWriteFileSync = vi.mocked(writeFileSync);

const API_URL = 'https://app.looped.me';
const VALID_KEY = 'loop_test_abcdefghijklmnopqrstuvwxyz1234';
const INVALID_KEY = 'loop_bad_abcdefghijklmnopqrstuvwxyz12345';

const PROJECT: LoopProject = {
  id: 'proj_1',
  name: 'My Project',
  status: 'active',
  description: null,
};

const PROJECTS_RESPONSE: ProjectListResponse = {
  data: [PROJECT],
  total: 1,
};

/** Sentinel error thrown by the mocked process.exit to halt execution. */
class ExitError extends Error {
  code: number;
  constructor(code: number) {
    super(`process.exit(${code})`);
    this.name = 'ExitError';
    this.code = code;
  }
}

function mockFetchJson(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('run (index.ts)', () => {
  const originalFetch = globalThis.fetch;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();

    // Mock process.exit to throw, halting execution like the real exit would
    process.exit = vi.fn((code?: number) => {
      throw new ExitError(code ?? 0);
    }) as never;

    // Default: existsSync returns false (no files detected)
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.exit = originalExit;
  });

  describe('interactive mode', () => {
    const baseOptions: RunOptions = {
      nonInteractive: false,
      apiUrl: API_URL,
    };

    it('happy path: prompts for key, selects project, writes files', async () => {
      // Password prompt returns a valid key
      vi.mocked(p.password).mockResolvedValueOnce(VALID_KEY);

      // API validates the key successfully
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(PROJECTS_RESPONSE));

      // User selects the existing project
      vi.mocked(p.select).mockResolvedValueOnce(PROJECT.id);

      await run(baseOptions);

      // Verify intro and outro were called
      expect(p.intro).toHaveBeenCalledWith(expect.stringContaining('Loop'));
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining(PROJECT.id));

      // Verify password was prompted
      expect(p.password).toHaveBeenCalledOnce();

      // Verify project selection was prompted
      expect(p.select).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Select a project',
          options: expect.arrayContaining([
            expect.objectContaining({ value: PROJECT.id, label: PROJECT.name }),
          ]),
        })
      );

      // Verify file write summary was shown
      expect(p.note).toHaveBeenCalledOnce();

      // Verify .env.local was written (always written)
      expect(mockWriteFileSync).toHaveBeenCalled();
    });

    it('happy path with --api-key flag skips password prompt', async () => {
      const options: RunOptions = {
        ...baseOptions,
        apiKey: VALID_KEY,
      };

      // API validates the provided key
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(PROJECTS_RESPONSE));

      // User selects the existing project
      vi.mocked(p.select).mockResolvedValueOnce(PROJECT.id);

      await run(options);

      // Password should NOT be prompted since key was provided via flag
      expect(p.password).not.toHaveBeenCalled();

      // Select should still be prompted for project
      expect(p.select).toHaveBeenCalledOnce();
      expect(p.outro).toHaveBeenCalled();
    });

    it('re-prompts on auth error then succeeds', async () => {
      const options: RunOptions = {
        ...baseOptions,
        apiKey: INVALID_KEY,
      };

      // First validation (--api-key) fails with 401
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      // Prompted for new key
      vi.mocked(p.password).mockResolvedValueOnce(VALID_KEY);

      // Second validation succeeds
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(PROJECTS_RESPONSE));

      // User selects project
      vi.mocked(p.select).mockResolvedValueOnce(PROJECT.id);

      await run(options);

      // The invalid key error was shown
      expect(p.log.error).toHaveBeenCalledWith(expect.stringContaining('invalid'));

      // Password prompt was shown for re-entry
      expect(p.password).toHaveBeenCalledOnce();

      // Eventually succeeds
      expect(p.outro).toHaveBeenCalled();
    });

    it('handles network error with user choosing to continue', async () => {
      // Password prompt returns key
      vi.mocked(p.password).mockResolvedValueOnce(VALID_KEY);

      // API call fails with network error
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // User confirms to continue without validation
      vi.mocked(p.confirm).mockResolvedValueOnce(true);

      // Text prompt for project name (since no projects available)
      vi.mocked(p.text).mockResolvedValueOnce('offline-project');

      // createProject also fails (still offline)
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await run(baseOptions);

      // Network warning was shown
      expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Network error'));

      // User was asked to continue
      expect(p.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Continue without validating'),
        })
      );

      // Files were still written
      expect(p.note).toHaveBeenCalledOnce();
      expect(p.outro).toHaveBeenCalled();
    });

    it('handles network error with --api-key flag and user continues', async () => {
      const options: RunOptions = {
        ...baseOptions,
        apiKey: VALID_KEY,
      };

      // API call fails with network error
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // User confirms to continue
      vi.mocked(p.confirm).mockResolvedValueOnce(true);

      // Text prompt for project name
      vi.mocked(p.text).mockResolvedValueOnce('offline-project');

      // createProject also fails
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await run(options);

      // Password should NOT be prompted
      expect(p.password).not.toHaveBeenCalled();

      // Network warning was shown
      expect(p.log.warn).toHaveBeenCalledWith(expect.stringContaining('Network error'));

      // Files were still written
      expect(p.note).toHaveBeenCalledOnce();
    });

    it('cancellation at password prompt exits', async () => {
      // Password prompt returns cancel symbol
      const cancelSymbol = Symbol('cancel');
      vi.mocked(p.password).mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(p.isCancel).mockImplementation((value) => value === cancelSymbol);

      await expect(run(baseOptions)).rejects.toThrow(ExitError);

      expect(p.cancel).toHaveBeenCalledWith('Setup cancelled.');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('cancellation at project select exits', async () => {
      const cancelSymbol = Symbol('cancel');

      // Password prompt succeeds
      vi.mocked(p.password).mockResolvedValueOnce(VALID_KEY);

      // API validates
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(PROJECTS_RESPONSE));

      // Select returns cancel
      vi.mocked(p.select).mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(p.isCancel).mockImplementation((value) => value === cancelSymbol);

      await expect(run(baseOptions)).rejects.toThrow(ExitError);

      expect(p.cancel).toHaveBeenCalledWith('Setup cancelled.');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('cancellation at network error confirm exits', async () => {
      const cancelSymbol = Symbol('cancel');

      // Password prompt succeeds
      vi.mocked(p.password).mockResolvedValueOnce(VALID_KEY);

      // Network error
      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      // Confirm returns cancel
      vi.mocked(p.confirm).mockResolvedValueOnce(cancelSymbol as never);
      vi.mocked(p.isCancel).mockImplementation((value) => value === cancelSymbol);

      await expect(run(baseOptions)).rejects.toThrow(ExitError);

      expect(p.cancel).toHaveBeenCalledWith('Setup cancelled.');
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    it('creates new project when user selects "Create new project"', async () => {
      const newProject: LoopProject = {
        id: 'proj_new',
        name: 'Brand New',
        status: 'active',
        description: null,
      };

      // Password prompt
      vi.mocked(p.password).mockResolvedValueOnce(VALID_KEY);

      // API validates
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(PROJECTS_RESPONSE));

      // User selects "Create new project"
      vi.mocked(p.select).mockResolvedValueOnce('__create_new__');

      // User types project name
      vi.mocked(p.text).mockResolvedValueOnce('Brand New');

      // createProject API call
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(newProject, { status: 201 }));

      await run(baseOptions);

      // Verify createProject was called
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(p.outro).toHaveBeenCalledWith(expect.stringContaining(newProject.id));
    });

    it('writes detected environment files and shows summary', async () => {
      // Simulate CLAUDE.md and .mcp.json detected
      mockExistsSync.mockImplementation((filePath) => {
        const s = String(filePath);
        if (s.endsWith('CLAUDE.md')) return true;
        if (s.endsWith('.mcp.json')) return true;
        return false;
      });

      vi.mocked(p.password).mockResolvedValueOnce(VALID_KEY);
      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(PROJECTS_RESPONSE));
      vi.mocked(p.select).mockResolvedValueOnce(PROJECT.id);

      await run(baseOptions);

      // Summary note should mention skipped items for undetected environments
      expect(p.note).toHaveBeenCalledWith(expect.stringContaining('Skipped'), expect.any(String));
    });
  });

  describe('non-interactive mode', () => {
    it('happy path: uses first project, writes files, logs output', async () => {
      const options: RunOptions = {
        nonInteractive: true,
        apiKey: VALID_KEY,
        apiUrl: API_URL,
      };

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(PROJECTS_RESPONSE));

      await run(options);

      // Should log project name
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining(PROJECT.name));

      // Should NOT call any interactive prompts
      expect(p.password).not.toHaveBeenCalled();
      expect(p.select).not.toHaveBeenCalled();
      expect(p.intro).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('exits with error when no API key provided', async () => {
      const options: RunOptions = {
        nonInteractive: true,
        apiUrl: API_URL,
      };

      const originalEnv = process.env.LOOP_API_KEY;
      delete process.env.LOOP_API_KEY;

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(run(options)).rejects.toThrow(ExitError);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No API key'));
      expect(process.exit).toHaveBeenCalledWith(1);

      process.env.LOOP_API_KEY = originalEnv;
      errorSpy.mockRestore();
    });

    it('exits with error on auth failure', async () => {
      const options: RunOptions = {
        nonInteractive: true,
        apiKey: INVALID_KEY,
        apiUrl: API_URL,
      };

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(run(options)).rejects.toThrow(ExitError);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid API key'));
      expect(process.exit).toHaveBeenCalledWith(1);

      errorSpy.mockRestore();
    });

    it('exits with error on network failure', async () => {
      const options: RunOptions = {
        nonInteractive: true,
        apiKey: VALID_KEY,
        apiUrl: API_URL,
      };

      vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(run(options)).rejects.toThrow(ExitError);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not reach'));
      expect(process.exit).toHaveBeenCalledWith(1);

      errorSpy.mockRestore();
    });

    it('exits with error when no projects exist', async () => {
      const options: RunOptions = {
        nonInteractive: true,
        apiKey: VALID_KEY,
        apiUrl: API_URL,
      };

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson({ data: [], total: 0 }));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(run(options)).rejects.toThrow(ExitError);

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No projects found'));
      expect(process.exit).toHaveBeenCalledWith(1);

      errorSpy.mockRestore();
    });

    it('uses LOOP_API_KEY env var when --api-key not provided', async () => {
      const options: RunOptions = {
        nonInteractive: true,
        apiUrl: API_URL,
      };

      const originalEnv = process.env.LOOP_API_KEY;
      process.env.LOOP_API_KEY = VALID_KEY;

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockFetchJson(PROJECTS_RESPONSE));

      await run(options);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${VALID_KEY}`,
          }),
        })
      );

      process.env.LOOP_API_KEY = originalEnv;
      consoleSpy.mockRestore();
    });
  });
});
