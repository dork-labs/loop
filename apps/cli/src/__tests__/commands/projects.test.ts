import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerProjectsCommand } from '../../commands/projects.js';

const mockList = vi.fn();

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    projects: { list: mockList },
  })),
}));

describe('projects command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerProjectsCommand(program);
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
    const mockProjects = [
      { id: 'proj-1', name: 'Onboarding', status: 'active', health: 'on_track', createdAt: '2026-01-15T00:00:00Z' },
      { id: 'proj-2', name: 'Auth Revamp', status: 'planned', health: 'at_risk', createdAt: '2026-01-20T00:00:00Z' },
    ];

    it('calls client.projects.list with default params and renders table', async () => {
      mockList.mockResolvedValue({ data: mockProjects, total: 2 });

      await program.parseAsync(['node', 'test', 'projects', 'list']);

      expect(mockList).toHaveBeenCalledWith({ limit: 50, offset: 0 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Showing 2 of 2 projects')
      );
    });

    it('passes custom limit and offset', async () => {
      mockList.mockResolvedValue({ data: mockProjects, total: 2 });

      await program.parseAsync(['node', 'test', 'projects', 'list', '--limit', '10', '--offset', '5']);

      expect(mockList).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });

    it('shows empty message when no projects found', async () => {
      mockList.mockResolvedValue({ data: [], total: 0 });

      await program.parseAsync(['node', 'test', 'projects', 'list']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No projects found'));
    });

    it('outputs raw JSON when --json is set', async () => {
      const result = { data: mockProjects, total: 2 };
      mockList.mockResolvedValue(result);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'projects', 'list']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('outputs plain tab-separated values when --plain is set', async () => {
      mockList.mockResolvedValue({ data: mockProjects, total: 2 });

      await program.parseAsync(['node', 'test', '--plain', 'projects', 'list']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('proj-1'));
    });

    it('exits with error on API failure', async () => {
      mockList.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'projects', 'list'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
