import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerGoalsCommand } from '../../commands/goals.js';

const mockList = vi.fn();

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    goals: { list: mockList },
  })),
}));

describe('goals command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerGoalsCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list', () => {
    const mockGoals = [
      {
        id: 'goal-1',
        title: 'Increase conversion',
        status: 'active',
        metric: 'conversion_rate',
        currentValue: 3.2,
        targetValue: 4.0,
        unit: '%',
        projectId: 'proj-1',
        createdAt: '2026-01-15T00:00:00Z',
      },
      {
        id: 'goal-2',
        title: 'Reduce errors',
        status: 'achieved',
        metric: 'error_rate',
        currentValue: 0.1,
        targetValue: 0.5,
        unit: '%',
        projectId: null,
        createdAt: '2026-01-20T00:00:00Z',
      },
    ];

    it('calls client.goals.list with default params and renders table', async () => {
      mockList.mockResolvedValue({ data: mockGoals, total: 2 });

      await program.parseAsync(['node', 'test', 'goals', 'list']);

      expect(mockList).toHaveBeenCalledWith({ limit: 50, offset: 0 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Showing 2 of 2 goals')
      );
    });

    it('passes status filter and custom pagination', async () => {
      mockList.mockResolvedValue({ data: mockGoals, total: 2 });

      await program.parseAsync([
        'node', 'test', 'goals', 'list',
        '--status', 'active',
        '--limit', '10',
        '--offset', '5',
      ]);

      expect(mockList).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        status: 'active',
      });
    });

    it('shows empty message when no goals found', async () => {
      mockList.mockResolvedValue({ data: [], total: 0 });

      await program.parseAsync(['node', 'test', 'goals', 'list']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No goals found'));
    });

    it('outputs raw JSON when --json is set', async () => {
      const result = { data: mockGoals, total: 2 };
      mockList.mockResolvedValue(result);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'goals', 'list']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('outputs plain tab-separated values when --plain is set', async () => {
      mockList.mockResolvedValue({ data: mockGoals, total: 2 });

      await program.parseAsync(['node', 'test', '--plain', 'goals', 'list']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('goal-1'));
    });

    it('exits with error on API failure', async () => {
      mockList.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'goals', 'list'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
