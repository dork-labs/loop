import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerCommentsCommand } from '../../commands/comments.js';

// Mock client module
const mockCreate = vi.fn();
vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    comments: { create: mockCreate },
  })),
}));

describe('comments command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerCommentsCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('add', () => {
    it('calls client.comments.create with correct params and prints success', async () => {
      mockCreate.mockResolvedValue({ id: 'comment-1', body: 'Hello' });

      await program.parseAsync(['node', 'test', 'comments', 'add', 'issue-123', 'Hello']);

      expect(mockCreate).toHaveBeenCalledWith('issue-123', {
        body: 'Hello',
        authorName: 'loop-cli',
        authorType: 'human',
      });
      expect(console.log).toHaveBeenCalledWith('Comment added to issue issue-123');
    });

    it('outputs raw JSON when --json is set', async () => {
      const comment = { id: 'comment-1', body: 'Hello' };
      mockCreate.mockResolvedValue(comment);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync([
        'node',
        'test',
        '--json',
        'comments',
        'add',
        'issue-123',
        'Hello',
      ]);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(comment, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'comments', 'add', 'issue-123', 'Hello'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
