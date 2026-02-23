import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerAuthCommand } from '../../commands/auth.js';

// Mock config module
vi.mock('../../lib/config.js', () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
  maskToken: vi.fn((t: string) => (t.length > 12 ? `${t.slice(0, 4)}****${t.slice(-4)}` : '****')),
}));

// Mock nanospinner
const mockSpinner = {
  start: vi.fn().mockReturnThis(),
  success: vi.fn().mockReturnThis(),
  error: vi.fn().mockReturnThis(),
};
vi.mock('nanospinner', () => ({
  createSpinner: vi.fn(() => mockSpinner),
}));

// Mock @dork-labs/loop-sdk
const mockDashboard = { stats: vi.fn() };
vi.mock('@dork-labs/loop-sdk', () => ({
  LoopClient: vi.fn(() => ({ dashboard: mockDashboard })),
}));

// Mock @inquirer/prompts (dynamic import)
vi.mock('@inquirer/prompts', () => ({
  input: vi.fn(),
  password: vi.fn(),
}));

import { readConfig, writeConfig, maskToken } from '../../lib/config.js';
import { LoopClient } from '@dork-labs/loop-sdk';

describe('auth command', () => {
  let program: Command;
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup spinner chaining after clearAllMocks
    mockSpinner.start.mockReturnThis();
    mockSpinner.success.mockReturnThis();
    mockSpinner.error.mockReturnThis();

    program = new Command();
    program.exitOverride();
    registerAuthCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('prompts for URL and token, validates, and saves config', async () => {
      const { input, password } = await import('@inquirer/prompts');
      vi.mocked(readConfig).mockReturnValue({ url: 'http://existing:5667' });
      vi.mocked(input).mockResolvedValue('http://localhost:5667');
      vi.mocked(password).mockResolvedValue('loop_testkey1234567890');
      mockDashboard.stats.mockResolvedValue({ issues: { total: 5 } });

      await program.parseAsync(['node', 'test', 'auth', 'login']);

      // Should use existing URL as default
      expect(input).toHaveBeenCalledWith(
        expect.objectContaining({
          default: 'http://existing:5667',
        })
      );

      // Should create client with provided credentials
      expect(LoopClient).toHaveBeenCalledWith({
        apiKey: 'loop_testkey1234567890',
        baseURL: 'http://localhost:5667',
      });

      // Should validate by calling dashboard.stats()
      expect(mockDashboard.stats).toHaveBeenCalled();

      // Should show success spinner
      expect(mockSpinner.success).toHaveBeenCalledWith({ text: 'Authenticated successfully' });

      // Should save config
      expect(writeConfig).toHaveBeenCalledWith({
        url: 'http://localhost:5667',
        token: 'loop_testkey1234567890',
      });
    });

    it('shows error and exits on invalid credentials', async () => {
      const { input, password } = await import('@inquirer/prompts');
      vi.mocked(readConfig).mockReturnValue({});
      vi.mocked(input).mockResolvedValue('http://localhost:5667');
      vi.mocked(password).mockResolvedValue('loop_badkey');
      mockDashboard.stats.mockRejectedValue(new Error('Unauthorized'));

      await expect(program.parseAsync(['node', 'test', 'auth', 'login'])).rejects.toThrow(
        'process.exit'
      );

      expect(mockSpinner.error).toHaveBeenCalledWith({
        text: 'Authentication failed. Check your API key and URL.',
      });
      expect(writeConfig).not.toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('defaults to localhost when no existing config URL', async () => {
      const { input, password } = await import('@inquirer/prompts');
      vi.mocked(readConfig).mockReturnValue({});
      vi.mocked(input).mockResolvedValue('http://localhost:5667');
      vi.mocked(password).mockResolvedValue('loop_testkey1234567890');
      mockDashboard.stats.mockResolvedValue({});

      await program.parseAsync(['node', 'test', 'auth', 'login']);

      expect(input).toHaveBeenCalledWith(
        expect.objectContaining({
          default: 'http://localhost:5667',
        })
      );
    });
  });

  describe('logout', () => {
    it('clears credentials by writing empty config', async () => {
      await program.parseAsync(['node', 'test', 'auth', 'logout']);

      expect(writeConfig).toHaveBeenCalledWith({});
      expect(console.log).toHaveBeenCalledWith('Logged out. Credentials cleared.');
    });
  });

  describe('status', () => {
    it('shows authenticated state with masked token and URL', async () => {
      vi.mocked(readConfig).mockReturnValue({
        url: 'http://localhost:5667',
        token: 'loop_testkey1234567890',
      });

      await program.parseAsync(['node', 'test', 'auth', 'status']);

      expect(console.log).toHaveBeenCalledWith('Authenticated');
      expect(console.log).toHaveBeenCalledWith('  URL:   http://localhost:5667');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Token:'));
      expect(maskToken).toHaveBeenCalledWith('loop_testkey1234567890');
    });

    it('shows not authenticated when no token', async () => {
      vi.mocked(readConfig).mockReturnValue({});

      await program.parseAsync(['node', 'test', 'auth', 'status']);

      expect(console.log).toHaveBeenCalledWith('Not authenticated. Run: loop auth login');
    });

    it('shows (not set) when URL is missing but token exists', async () => {
      vi.mocked(readConfig).mockReturnValue({ token: 'loop_testkey1234567890' });

      await program.parseAsync(['node', 'test', 'auth', 'status']);

      expect(console.log).toHaveBeenCalledWith('Authenticated');
      expect(console.log).toHaveBeenCalledWith('  URL:   (not set)');
    });
  });
});
