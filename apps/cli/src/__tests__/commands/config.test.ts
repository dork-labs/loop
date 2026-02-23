import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerConfigCommand } from '../../commands/config.js';

vi.mock('../../lib/config.js', () => ({
  readConfig: vi.fn(),
  writeConfig: vi.fn(),
  maskToken: vi.fn((t: string) => (t.length > 12 ? `${t.slice(0, 4)}****${t.slice(-4)}` : '****')),
}));

import { readConfig, writeConfig, maskToken } from '../../lib/config.js';

describe('config command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    registerConfigCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('set', () => {
    it('sets url and saves config', async () => {
      vi.mocked(readConfig).mockReturnValue({ url: 'http://old:5667' });

      await program.parseAsync(['node', 'test', 'config', 'set', 'url', 'http://new:5667']);

      expect(writeConfig).toHaveBeenCalledWith({ url: 'http://new:5667' });
      expect(console.log).toHaveBeenCalledWith('URL set: http://new:5667');
    });

    it('sets token and saves config with masked output', async () => {
      vi.mocked(readConfig).mockReturnValue({});

      await program.parseAsync(['node', 'test', 'config', 'set', 'token', 'loop_testkey1234567890']);

      expect(writeConfig).toHaveBeenCalledWith({ token: 'loop_testkey1234567890' });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Token set:'));
      expect(maskToken).toHaveBeenCalledWith('loop_testkey1234567890');
    });

    it('errors on unknown key', async () => {
      vi.mocked(readConfig).mockReturnValue({});

      await expect(
        program.parseAsync(['node', 'test', 'config', 'set', 'unknown', 'value'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith(
        'Unknown config key: unknown. Valid keys: url, token'
      );
      expect(writeConfig).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('gets url value', async () => {
      vi.mocked(readConfig).mockReturnValue({ url: 'http://localhost:5667' });

      await program.parseAsync(['node', 'test', 'config', 'get', 'url']);

      expect(console.log).toHaveBeenCalledWith('http://localhost:5667');
    });

    it('shows (not set) when url is missing', async () => {
      vi.mocked(readConfig).mockReturnValue({});

      await program.parseAsync(['node', 'test', 'config', 'get', 'url']);

      expect(console.log).toHaveBeenCalledWith('(not set)');
    });

    it('gets token value (masked)', async () => {
      vi.mocked(readConfig).mockReturnValue({ token: 'loop_testkey1234567890' });

      await program.parseAsync(['node', 'test', 'config', 'get', 'token']);

      expect(maskToken).toHaveBeenCalledWith('loop_testkey1234567890');
    });

    it('shows (not set) when token is missing', async () => {
      vi.mocked(readConfig).mockReturnValue({});

      await program.parseAsync(['node', 'test', 'config', 'get', 'token']);

      expect(console.log).toHaveBeenCalledWith('(not set)');
    });

    it('errors on unknown key', async () => {
      vi.mocked(readConfig).mockReturnValue({});

      await expect(
        program.parseAsync(['node', 'test', 'config', 'get', 'unknown'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith(
        'Unknown config key: unknown. Valid keys: url, token'
      );
    });
  });

  describe('list', () => {
    it('shows all config values', async () => {
      vi.mocked(readConfig).mockReturnValue({
        url: 'http://localhost:5667',
        token: 'loop_testkey1234567890',
      });

      await program.parseAsync(['node', 'test', 'config', 'list']);

      expect(console.log).toHaveBeenCalledWith('url:   http://localhost:5667');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('token:'));
      expect(maskToken).toHaveBeenCalledWith('loop_testkey1234567890');
    });

    it('shows (not set) for missing values', async () => {
      vi.mocked(readConfig).mockReturnValue({});

      await program.parseAsync(['node', 'test', 'config', 'list']);

      expect(console.log).toHaveBeenCalledWith('url:   (not set)');
      expect(console.log).toHaveBeenCalledWith('token: (not set)');
    });
  });
});
