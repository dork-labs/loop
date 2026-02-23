import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerTemplatesCommand } from '../../commands/templates.js';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockVersions = vi.fn();
const mockPromote = vi.fn();

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    templates: {
      list: mockList,
      get: mockGet,
      versions: mockVersions,
      promote: mockPromote,
    },
  })),
}));

describe('templates command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerTemplatesCommand(program);
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
    const mockTemplates = [
      {
        id: 'tmpl-1',
        slug: 'fix-bug',
        name: 'Fix Bug Template',
        specificity: 10,
        activeVersionId: 'ver-1',
        createdAt: '2026-01-15T00:00:00Z',
      },
      {
        id: 'tmpl-2',
        slug: 'triage-signal',
        name: 'Triage Signal',
        specificity: 5,
        activeVersionId: null,
        createdAt: '2026-01-20T00:00:00Z',
      },
    ];

    it('calls client.templates.list with default params', async () => {
      mockList.mockResolvedValue({ data: mockTemplates, total: 2 });

      await program.parseAsync(['node', 'test', 'templates', 'list']);

      expect(mockList).toHaveBeenCalledWith({ limit: 50, offset: 0 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Showing 2 of 2 templates')
      );
    });

    it('passes custom limit and offset', async () => {
      mockList.mockResolvedValue({ data: mockTemplates, total: 2 });

      await program.parseAsync(['node', 'test', 'templates', 'list', '--limit', '10', '--offset', '5']);

      expect(mockList).toHaveBeenCalledWith({ limit: 10, offset: 5 });
    });

    it('shows empty message when no templates found', async () => {
      mockList.mockResolvedValue({ data: [], total: 0 });

      await program.parseAsync(['node', 'test', 'templates', 'list']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No templates found'));
    });

    it('outputs raw JSON when --json is set', async () => {
      const result = { data: mockTemplates, total: 2 };
      mockList.mockResolvedValue(result);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'templates', 'list']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('outputs plain tab-separated values when --plain is set', async () => {
      mockList.mockResolvedValue({ data: mockTemplates, total: 2 });

      await program.parseAsync(['node', 'test', '--plain', 'templates', 'list']);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('tmpl-1'));
    });

    it('exits with error on API failure', async () => {
      mockList.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'templates', 'list'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('show', () => {
    const mockTemplate = {
      id: 'tmpl-1',
      slug: 'fix-bug',
      name: 'Fix Bug Template',
      description: 'Template for fixing bugs',
      specificity: 10,
      activeVersionId: 'ver-1',
      activeVersion: {
        version: 3,
        status: 'active',
        authorName: 'alice',
        authorType: 'human',
        usageCount: 42,
        completionRate: 0.85,
        changelog: 'Improved context section',
      },
      createdAt: '2026-01-15T00:00:00Z',
      updatedAt: '2026-02-01T00:00:00Z',
    };

    const mockVersionsList = [
      {
        version: 3,
        status: 'active',
        authorName: 'alice',
        usageCount: 42,
        completionRate: 0.85,
        createdAt: '2026-02-01T00:00:00Z',
      },
      {
        version: 2,
        status: 'retired',
        authorName: 'bob',
        usageCount: 100,
        completionRate: 0.72,
        createdAt: '2026-01-20T00:00:00Z',
      },
    ];

    it('calls client.templates.get and versions, renders detail', async () => {
      mockGet.mockResolvedValue(mockTemplate);
      mockVersions.mockResolvedValue({ data: mockVersionsList });

      await program.parseAsync(['node', 'test', 'templates', 'show', 'tmpl-1']);

      expect(mockGet).toHaveBeenCalledWith('tmpl-1');
      expect(mockVersions).toHaveBeenCalledWith('tmpl-1', { limit: 10 });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Fix Bug Template')
      );
    });

    it('outputs raw JSON when --json is set', async () => {
      mockGet.mockResolvedValue(mockTemplate);
      mockVersions.mockResolvedValue({ data: mockVersionsList });
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'templates', 'show', 'tmpl-1']);

      const expected = { ...mockTemplate, versions: mockVersionsList };
      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(expected, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockGet.mockRejectedValue(new Error('Not found'));

      await expect(
        program.parseAsync(['node', 'test', 'templates', 'show', 'tmpl-999'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('promote', () => {
    const mockVersion = {
      id: 'ver-2',
      version: 4,
      status: 'active',
    };

    it('calls client.templates.promote and prints success', async () => {
      mockPromote.mockResolvedValue(mockVersion);

      await program.parseAsync(['node', 'test', 'templates', 'promote', 'tmpl-1', 'ver-2']);

      expect(mockPromote).toHaveBeenCalledWith('tmpl-1', 'ver-2');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Promoted version 4')
      );
    });

    it('outputs raw JSON when --json is set', async () => {
      mockPromote.mockResolvedValue(mockVersion);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'templates', 'promote', 'tmpl-1', 'ver-2']);

      expect(writeSpy).toHaveBeenCalledWith(
        JSON.stringify({ data: mockVersion }, null, 2) + '\n'
      );
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockPromote.mockRejectedValue(new Error('Conflict'));

      await expect(
        program.parseAsync(['node', 'test', 'templates', 'promote', 'tmpl-1', 'ver-999'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Conflict');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
