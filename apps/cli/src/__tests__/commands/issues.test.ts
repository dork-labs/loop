import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerIssuesCommand } from '../../commands/issues.js';

const mockList = vi.fn();
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCommentsCreate = vi.fn();

vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    issues: { list: mockList, get: mockGet, create: mockCreate, update: mockUpdate },
    comments: { create: mockCommentsCreate },
  })),
}));

describe('issues command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerIssuesCommand(program);
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
    const mockIssues = [
      { id: 'iss-1', number: 1, title: 'Fix bug', type: 'task', status: 'todo', priority: 2 },
      { id: 'iss-2', number: 2, title: 'Add feature', type: 'hypothesis', status: 'in_progress', priority: 1 },
    ];

    it('calls client.issues.list with default params', async () => {
      mockList.mockResolvedValue({ data: mockIssues, total: 2 });

      await program.parseAsync(['node', 'test', 'issues', 'list']);

      expect(mockList).toHaveBeenCalledWith({
        limit: 50,
        offset: 0,
      });
      expect(console.log).toHaveBeenCalled();
    });

    it('passes filter options', async () => {
      mockList.mockResolvedValue({ data: mockIssues, total: 2 });

      await program.parseAsync([
        'node', 'test', 'issues', 'list',
        '--status', 'todo',
        '--type', 'task',
        '--project', 'proj-1',
        '--priority', '2',
        '--limit', '10',
        '--offset', '5',
      ]);

      expect(mockList).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        status: 'todo',
        type: 'task',
        projectId: 'proj-1',
        priority: 2,
      });
    });

    it('outputs raw JSON when --json is set', async () => {
      const result = { data: mockIssues, total: 2 };
      mockList.mockResolvedValue(result);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'issues', 'list']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockList.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'issues', 'list'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('view', () => {
    const mockIssue = {
      id: 'iss-1',
      number: 42,
      title: 'Fix OAuth redirect',
      type: 'task',
      status: 'in_progress',
      priority: 2,
      description: 'The redirect is slow',
      projectId: 'proj-1',
      labels: [{ name: 'bug' }],
      children: [],
      relations: [],
      parent: null,
    };

    it('calls client.issues.get and renders detail', async () => {
      mockGet.mockResolvedValue(mockIssue);

      await program.parseAsync(['node', 'test', 'issues', 'view', 'iss-1']);

      expect(mockGet).toHaveBeenCalledWith('iss-1');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('#42')
      );
    });

    it('outputs raw JSON when --json is set', async () => {
      mockGet.mockResolvedValue(mockIssue);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'issues', 'view', 'iss-1']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(mockIssue, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockGet.mockRejectedValue(new Error('Not found'));

      await expect(
        program.parseAsync(['node', 'test', 'issues', 'view', 'iss-999'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    const mockCreated = {
      id: 'iss-new',
      number: 99,
      title: 'New issue',
      type: 'task',
      status: 'triage',
      priority: 3,
    };

    it('calls client.issues.create with title and flags', async () => {
      mockCreate.mockResolvedValue(mockCreated);

      await program.parseAsync([
        'node', 'test', 'issues', 'create', 'New issue',
        '--type', 'task',
        '--priority', '3',
        '--project', 'proj-1',
        '--description', 'Details here',
      ]);

      expect(mockCreate).toHaveBeenCalledWith({
        title: 'New issue',
        type: 'task',
        priority: 3,
        projectId: 'proj-1',
        description: 'Details here',
      });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('#99')
      );
    });

    it('outputs raw JSON when --json is set', async () => {
      mockCreate.mockResolvedValue(mockCreated);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync([
        'node', 'test', '--json', 'issues', 'create', 'New issue',
        '--type', 'task', '--priority', '2',
      ]);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(mockCreated, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockCreate.mockRejectedValue(new Error('Validation error'));

      await expect(
        program.parseAsync([
          'node', 'test', 'issues', 'create', 'Bad issue',
          '--type', 'task', '--priority', '1',
        ])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Validation error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('start', () => {
    const mockDetail = {
      id: 'iss-1',
      number: 42,
      title: 'Fix OAuth redirect',
      type: 'task',
      status: 'in_progress',
      priority: 2,
      description: 'Some description',
      labels: [],
      children: [],
      relations: [],
      parent: null,
    };

    it('updates issue to in_progress and fetches detail', async () => {
      mockUpdate.mockResolvedValue(mockDetail);
      mockGet.mockResolvedValue(mockDetail);

      await program.parseAsync(['node', 'test', 'issues', 'start', 'iss-1']);

      expect(mockUpdate).toHaveBeenCalledWith('iss-1', { status: 'in_progress' });
      expect(mockGet).toHaveBeenCalledWith('iss-1');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('#42')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('in_progress')
      );
    });

    it('outputs raw JSON when --json is set', async () => {
      mockUpdate.mockResolvedValue(mockDetail);
      mockGet.mockResolvedValue(mockDetail);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'issues', 'start', 'iss-1']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(mockDetail, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockUpdate.mockRejectedValue(new Error('Not found'));

      await expect(
        program.parseAsync(['node', 'test', 'issues', 'start', 'iss-999'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Not found');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('done', () => {
    const mockDone = {
      id: 'iss-1',
      number: 42,
      title: 'Fix OAuth redirect',
      type: 'task',
      status: 'done',
      priority: 2,
    };

    it('marks issue as done', async () => {
      mockUpdate.mockResolvedValue(mockDone);

      await program.parseAsync(['node', 'test', 'issues', 'done', 'iss-1']);

      expect(mockUpdate).toHaveBeenCalledWith('iss-1', { status: 'done' });
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('#42')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('done')
      );
    });

    it('adds outcome comment when --outcome is provided', async () => {
      mockUpdate.mockResolvedValue(mockDone);
      mockCommentsCreate.mockResolvedValue({ id: 'c-1' });

      await program.parseAsync([
        'node', 'test', 'issues', 'done', 'iss-1',
        '--outcome', 'Fixed the redirect issue',
      ]);

      expect(mockCommentsCreate).toHaveBeenCalledWith('iss-1', {
        body: 'Fixed the redirect issue',
        authorName: 'loop-cli',
        authorType: 'human',
      });
    });

    it('does not add comment when --outcome is not provided', async () => {
      mockUpdate.mockResolvedValue(mockDone);

      await program.parseAsync(['node', 'test', 'issues', 'done', 'iss-1']);

      expect(mockCommentsCreate).not.toHaveBeenCalled();
    });

    it('outputs raw JSON when --json is set', async () => {
      mockUpdate.mockResolvedValue(mockDone);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync(['node', 'test', '--json', 'issues', 'done', 'iss-1']);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(mockDone, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockUpdate.mockRejectedValue(new Error('Server error'));

      await expect(
        program.parseAsync(['node', 'test', 'issues', 'done', 'iss-999'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Server error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
