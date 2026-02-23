import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerDashboardCommand } from '../../commands/dashboard.js';

const mockStats = vi.fn();

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    dashboard: { stats: mockStats },
  })),
}));

describe('dashboard command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerDashboardCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockStatsData = {
    issues: {
      total: 42,
      byStatus: { triage: 5, todo: 10, in_progress: 8, done: 15, canceled: 4 },
      byType: { signal: 12, hypothesis: 5, plan: 3, task: 20, monitor: 2 },
    },
    goals: {
      total: 5,
      active: 3,
      achieved: 2,
    },
    dispatch: {
      queueDepth: 7,
      activeCount: 3,
      completedLast24h: 12,
    },
  };

  it('calls client.dashboard.stats and renders formatted output', async () => {
    mockStats.mockResolvedValue(mockStatsData);

    await program.parseAsync(['node', 'test', 'dashboard']);

    expect(mockStats).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Loop System Status')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Issues')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Dispatch')
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Goals')
    );
  });

  it('outputs raw JSON when --json is set', async () => {
    mockStats.mockResolvedValue(mockStatsData);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['node', 'test', '--json', 'dashboard']);

    expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(mockStatsData, null, 2) + '\n');
    writeSpy.mockRestore();
  });

  it('outputs plain tab-separated values when --plain is set', async () => {
    mockStats.mockResolvedValue(mockStatsData);

    await program.parseAsync(['node', 'test', '--plain', 'dashboard']);

    expect(console.log).toHaveBeenCalledWith('issues_total\t42');
    expect(console.log).toHaveBeenCalledWith('queue_depth\t7');
    expect(console.log).toHaveBeenCalledWith('active\t3');
    expect(console.log).toHaveBeenCalledWith('done_24h\t12');
    expect(console.log).toHaveBeenCalledWith('goals_total\t5');
    expect(console.log).toHaveBeenCalledWith('goals_achieved\t2');
  });

  it('exits with error on API failure', async () => {
    mockStats.mockRejectedValue(new Error('Unauthorized'));

    await expect(
      program.parseAsync(['node', 'test', 'dashboard'])
    ).rejects.toThrow('process.exit');

    expect(console.error).toHaveBeenCalledWith('Error: Unauthorized');
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
