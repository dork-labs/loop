import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerDispatchCommand } from '../../commands/dispatch.js';

// Mock client module
const mockNext = vi.fn();
const mockQueue = vi.fn();
vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    dispatch: { next: mockNext, queue: mockQueue },
  })),
}));

describe('dispatch commands', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerDispatchCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('next', () => {
    const mockDispatchResult = {
      issue: {
        id: 'iss-1',
        number: 42,
        title: 'Fix OAuth redirect',
        type: 'task',
        priority: 2,
        status: 'in_progress',
      },
      prompt: 'You are working on fixing the OAuth redirect...',
      meta: {
        templateSlug: 'fix-bug',
        templateId: 'tmpl-1',
        versionId: 'ver-1',
        versionNumber: 3,
        reviewUrl: '/api/templates/tmpl-1/reviews',
      },
    };

    it('calls client.dispatch.next and renders dispatched issue', async () => {
      mockNext.mockResolvedValue(mockDispatchResult);

      await program.parseAsync(['node', 'test', 'next']);

      expect(mockNext).toHaveBeenCalledWith(undefined);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('#42')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Fix OAuth redirect')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Instructions:')
      );
      expect(console.log).toHaveBeenCalledWith(
        'You are working on fixing the OAuth redirect...'
      );
    });

    it('passes projectId filter when --project is provided', async () => {
      mockNext.mockResolvedValue(mockDispatchResult);

      await program.parseAsync(['node', 'test', 'next', '--project', 'proj-1']);

      expect(mockNext).toHaveBeenCalledWith({ projectId: 'proj-1' });
    });

    it('shows empty message when queue is empty (null result)', async () => {
      mockNext.mockResolvedValue(null);

      await program.parseAsync(['node', 'test', 'next']);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No issues ready for dispatch.')
      );
    });

    it('renders template metadata when present', async () => {
      mockNext.mockResolvedValue(mockDispatchResult);

      await program.parseAsync(['node', 'test', 'next']);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Template:')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('fix-bug')
      );
    });

    it('shows warning when no prompt template matched', async () => {
      mockNext.mockResolvedValue({
        ...mockDispatchResult,
        prompt: null,
        meta: null,
      });

      await program.parseAsync(['node', 'test', 'next']);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No prompt template matched this issue.')
      );
    });

    it('outputs raw JSON when --json is set', async () => {
      mockNext.mockResolvedValue(mockDispatchResult);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'next']);

      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify(mockDispatchResult, null, 2) + '\n'
      );
      writeSpy.mockRestore();
    });

    it('outputs null as JSON when queue is empty and --json is set', async () => {
      mockNext.mockResolvedValue(null);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'next']);

      expect(writeSpy).toHaveBeenCalledWith('null\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockNext.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'next'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('dispatch queue', () => {
    const mockQueueResult = {
      data: [
        {
          issue: {
            id: 'iss-1',
            number: 10,
            title: 'First issue',
            type: 'task',
            priority: 1,
            status: 'todo',
          },
          score: 85,
          breakdown: { priorityWeight: 50, goalBonus: 20, ageBonus: 10, typeBonus: 5 },
        },
        {
          issue: {
            id: 'iss-2',
            number: 11,
            title: 'Second issue',
            type: 'hypothesis',
            priority: 3,
            status: 'todo',
          },
          score: 42,
          breakdown: { priorityWeight: 30, goalBonus: 0, ageBonus: 7, typeBonus: 5 },
        },
      ],
      total: 5,
    };

    it('calls client.dispatch.queue with default params and renders table', async () => {
      mockQueue.mockResolvedValue(mockQueueResult);

      await program.parseAsync(['node', 'test', 'dispatch', 'queue']);

      expect(mockQueue).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
      });
      // Table header and content rendered
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Showing 2 of 5 queued issues')
      );
    });

    it('passes project filter and custom limit', async () => {
      mockQueue.mockResolvedValue(mockQueueResult);

      await program.parseAsync([
        'node', 'test', 'dispatch', 'queue',
        '--project', 'proj-1',
        '--limit', '5',
      ]);

      expect(mockQueue).toHaveBeenCalledWith({
        limit: 5,
        offset: 0,
        projectId: 'proj-1',
      });
    });

    it('shows empty message when queue is empty', async () => {
      mockQueue.mockResolvedValue({ data: [], total: 0 });

      await program.parseAsync(['node', 'test', 'dispatch', 'queue']);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No issues in the dispatch queue.')
      );
    });

    it('outputs raw JSON when --json is set', async () => {
      mockQueue.mockResolvedValue(mockQueueResult);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'dispatch', 'queue']);

      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify(mockQueueResult, null, 2) + '\n'
      );
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockQueue.mockRejectedValue(new Error('Server error'));

      await expect(
        program.parseAsync(['node', 'test', 'dispatch', 'queue'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Server error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
