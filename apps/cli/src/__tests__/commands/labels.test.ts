import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerLabelsCommand } from '../../commands/labels.js';

const mockList = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    labels: { list: mockList, create: mockCreate, delete: mockDelete },
  })),
}));

describe('labels command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerLabelsCommand(program);
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
    const mockLabels = [
      { id: 'lbl-1', name: 'bug', color: '#ff0000', createdAt: '2026-01-15T00:00:00Z', deletedAt: null },
      { id: 'lbl-2', name: 'feature', color: '#00ff00', createdAt: '2026-01-16T00:00:00Z', deletedAt: null },
    ];

    it('calls client.labels.list and renders a table', async () => {
      mockList.mockResolvedValue({ data: mockLabels, total: 2 });

      await program.parseAsync(['node', 'test', 'labels', 'list']);

      expect(mockList).toHaveBeenCalledWith({ limit: 50, offset: 0 });
      expect(console.log).toHaveBeenCalled();
    });

    it('passes custom limit and offset', async () => {
      mockList.mockResolvedValue({ data: mockLabels, total: 2 });

      await program.parseAsync(['node', 'test', 'labels', 'list', '--limit', '10', '--offset', '5']);

      expect(mockList).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });

    it('shows empty message when no labels found', async () => {
      mockList.mockResolvedValue({ data: [], total: 0 });

      await program.parseAsync(['node', 'test', 'labels', 'list']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No labels found'));
    });

    it('outputs raw JSON when --json is set', async () => {
      const result = { data: mockLabels, total: 2 };
      mockList.mockResolvedValue(result);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'labels', 'list']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('outputs plain tab-separated values when --plain is set', async () => {
      mockList.mockResolvedValue({ data: mockLabels, total: 2 });

      await program.parseAsync(['node', 'test', '--plain', 'labels', 'list']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('lbl-1'));
    });

    it('exits with error on API failure', async () => {
      mockList.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'labels', 'list'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('calls client.labels.create and prints success', async () => {
      const label = { id: 'lbl-new', name: 'urgent', color: '#ff0000', createdAt: '2026-01-20T00:00:00Z', deletedAt: null };
      mockCreate.mockResolvedValue(label);

      await program.parseAsync(['node', 'test', 'labels', 'create', '--name', 'urgent', '--color', '#ff0000']);

      expect(mockCreate).toHaveBeenCalledWith({ name: 'urgent', color: '#ff0000' });
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Label created'));
    });

    it('outputs raw JSON when --json is set', async () => {
      const label = { id: 'lbl-new', name: 'urgent', color: '#ff0000', createdAt: '2026-01-20T00:00:00Z', deletedAt: null };
      mockCreate.mockResolvedValue(label);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'labels', 'create', '--name', 'urgent', '--color', '#ff0000']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(label, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockCreate.mockRejectedValue(new Error('Validation error'));

      await expect(
        program.parseAsync(['node', 'test', 'labels', 'create', '--name', 'x', '--color', 'y'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Validation error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('delete', () => {
    it('calls client.labels.delete and prints success', async () => {
      mockDelete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'labels', 'delete', 'lbl-1']);

      expect(mockDelete).toHaveBeenCalledWith('lbl-1');
      expect(console.log).toHaveBeenCalledWith('Label lbl-1 deleted.');
    });

    it('outputs raw JSON when --json is set', async () => {
      mockDelete.mockResolvedValue(undefined);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'labels', 'delete', 'lbl-1']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify({ deleted: true, id: 'lbl-1' }, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockDelete.mockRejectedValue(new Error('Not found'));

      await expect(
        program.parseAsync(['node', 'test', 'labels', 'delete', 'lbl-999'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
