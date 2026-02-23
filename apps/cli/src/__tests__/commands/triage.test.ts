import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerTriageCommand } from '../../commands/triage.js';

const mockIssuesList = vi.fn();
const mockIssuesUpdate = vi.fn();
const mockCommentsCreate = vi.fn();

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    issues: { list: mockIssuesList, update: mockIssuesUpdate },
    comments: { create: mockCommentsCreate },
  })),
}));

describe('triage command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerTriageCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list (default action)', () => {
    const mockIssues = [
      { id: 'iss-1', number: 1, title: 'Signal: error spike', type: 'signal', status: 'triage', priority: 2 },
      { id: 'iss-2', number: 2, title: 'Signal: slow response', type: 'signal', status: 'triage', priority: 3 },
    ];

    it('lists triage issues by filtering for status=triage', async () => {
      mockIssuesList.mockResolvedValue({ data: mockIssues, total: 2 });

      await program.parseAsync(['node', 'test', 'triage']);

      expect(mockIssuesList).toHaveBeenCalledWith({ status: 'triage' });
      expect(console.log).toHaveBeenCalled();
    });

    it('outputs raw JSON when --json is set', async () => {
      const result = { data: mockIssues, total: 2 };
      mockIssuesList.mockResolvedValue(result);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'triage']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockIssuesList.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'triage'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('accept', () => {
    const mockIssue = {
      id: 'iss-1',
      number: 1,
      title: 'Signal: error spike',
      status: 'backlog',
    };

    it('updates issue status to backlog and prints success', async () => {
      mockIssuesUpdate.mockResolvedValue(mockIssue);

      await program.parseAsync(['node', 'test', 'triage', 'accept', 'iss-1']);

      expect(mockIssuesUpdate).toHaveBeenCalledWith('iss-1', { status: 'backlog' });
      expect(console.log).toHaveBeenCalledWith('Issue iss-1 accepted into backlog');
    });

    it('outputs raw JSON when --json is set', async () => {
      mockIssuesUpdate.mockResolvedValue(mockIssue);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'triage', 'accept', 'iss-1']);

      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify({ data: mockIssue }, null, 2) + '\n'
      );
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockIssuesUpdate.mockRejectedValue(new Error('Not found'));

      await expect(
        program.parseAsync(['node', 'test', 'triage', 'accept', 'iss-999'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('decline', () => {
    const mockIssue = {
      id: 'iss-1',
      number: 1,
      title: 'Signal: noise',
      status: 'canceled',
    };

    it('updates issue status to canceled and prints success', async () => {
      mockIssuesUpdate.mockResolvedValue(mockIssue);

      await program.parseAsync(['node', 'test', 'triage', 'decline', 'iss-1']);

      expect(mockIssuesUpdate).toHaveBeenCalledWith('iss-1', { status: 'canceled' });
      expect(console.log).toHaveBeenCalledWith('Issue iss-1 declined');
    });

    it('adds reason as a comment when provided', async () => {
      mockIssuesUpdate.mockResolvedValue(mockIssue);
      mockCommentsCreate.mockResolvedValue({ id: 'c-1' });

      await program.parseAsync(['node', 'test', 'triage', 'decline', 'iss-1', 'Not a real issue']);

      expect(mockCommentsCreate).toHaveBeenCalledWith('iss-1', {
        body: 'Not a real issue',
        authorName: 'loop-cli',
        authorType: 'human',
      });
    });

    it('does not add comment when no reason is provided', async () => {
      mockIssuesUpdate.mockResolvedValue(mockIssue);

      await program.parseAsync(['node', 'test', 'triage', 'decline', 'iss-1']);

      expect(mockCommentsCreate).not.toHaveBeenCalled();
    });

    it('warns but does not fail if reason comment fails', async () => {
      mockIssuesUpdate.mockResolvedValue(mockIssue);
      mockCommentsCreate.mockRejectedValue(new Error('Comment failed'));

      await program.parseAsync(['node', 'test', 'triage', 'decline', 'iss-1', 'Noise signal']);

      expect(console.error).toHaveBeenCalledWith(
        'Warning: issue declined but reason comment could not be saved.'
      );
      // Should still print success
      expect(console.log).toHaveBeenCalledWith('Issue iss-1 declined');
    });

    it('outputs raw JSON when --json is set', async () => {
      mockIssuesUpdate.mockResolvedValue(mockIssue);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'triage', 'decline', 'iss-1']);

      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify({ data: mockIssue }, null, 2) + '\n'
      );
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockIssuesUpdate.mockRejectedValue(new Error('Server error'));

      await expect(
        program.parseAsync(['node', 'test', 'triage', 'decline', 'iss-999'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Server error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
