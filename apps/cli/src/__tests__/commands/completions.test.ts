import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerCompletionsCommand } from '../../commands/completions.js';

describe('completions command', () => {
  let program: Command;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    program.name('loop').exitOverride();

    // Register a few test commands with subcommands to verify introspection
    const issues = program.command('issues').description('Manage issues');
    issues.command('list').description('List issues');
    issues.command('view').description('View an issue');
    issues.command('create').description('Create an issue');

    const config = program.command('config').description('Manage config');
    config.command('set').description('Set a value');
    config.command('get').description('Get a value');

    program.command('dashboard').description('View dashboard');

    registerCompletionsCommand(program);

    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('bash', () => {
    it('generates a valid bash completion script', async () => {
      await program.parseAsync(['node', 'test', 'completions', 'bash']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('_loop_completions');
      expect(output).toContain('complete -F _loop_completions loop');
      expect(output).toContain('issues');
      expect(output).toContain('config');
      expect(output).toContain('dashboard');
      expect(output).toContain('completions');
    });

    it('includes subcommands in bash case statements', async () => {
      await program.parseAsync(['node', 'test', 'completions', 'bash']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('issues) COMPREPLY=');
      expect(output).toContain('list view create');
      expect(output).toContain('config) COMPREPLY=');
      expect(output).toContain('set get');
    });
  });

  describe('zsh', () => {
    it('generates a valid zsh completion script', async () => {
      await program.parseAsync(['node', 'test', 'completions', 'zsh']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('#compdef loop');
      expect(output).toContain('_loop');
      expect(output).toContain('issues');
      expect(output).toContain('config');
      expect(output).toContain('completions');
    });

    it('includes subcommand values in zsh script', async () => {
      await program.parseAsync(['node', 'test', 'completions', 'zsh']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("'list:list subcommand'");
      expect(output).toContain("'set:set subcommand'");
    });
  });

  describe('fish', () => {
    it('generates a valid fish completion script', async () => {
      await program.parseAsync(['node', 'test', 'completions', 'fish']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('complete -c loop -f');
      expect(output).toContain("complete -c loop -n '__fish_use_subcommand' -a 'issues'");
      expect(output).toContain("complete -c loop -n '__fish_use_subcommand' -a 'config'");
      expect(output).toContain("complete -c loop -n '__fish_use_subcommand' -a 'completions'");
    });

    it('includes subcommand completions in fish script', async () => {
      await program.parseAsync(['node', 'test', 'completions', 'fish']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("__fish_seen_subcommand_from issues' -a 'list'");
      expect(output).toContain("__fish_seen_subcommand_from config' -a 'set'");
      expect(output).toContain("__fish_seen_subcommand_from completions' -a 'bash'");
    });
  });

  describe('auto-detection', () => {
    it('auto-detects bash from SHELL env var', async () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/bin/bash';

      await program.parseAsync(['node', 'test', 'completions']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('_loop_completions');

      process.env.SHELL = originalShell;
    });

    it('auto-detects zsh from SHELL env var', async () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/bin/zsh';

      await program.parseAsync(['node', 'test', 'completions']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('#compdef loop');

      process.env.SHELL = originalShell;
    });

    it('auto-detects fish from SHELL env var', async () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/usr/bin/fish';

      await program.parseAsync(['node', 'test', 'completions']);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('complete -c loop -f');

      process.env.SHELL = originalShell;
    });

    it('errors when shell cannot be detected', async () => {
      const originalShell = process.env.SHELL;
      process.env.SHELL = '/usr/bin/unknown';

      await expect(program.parseAsync(['node', 'test', 'completions'])).rejects.toThrow(
        'process.exit'
      );

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Could not detect shell')
      );

      process.env.SHELL = originalShell;
    });
  });

  describe('error handling', () => {
    it('rejects unsupported shell names', async () => {
      await expect(
        program.parseAsync(['node', 'test', 'completions', 'powershell'])
      ).rejects.toThrow('process.exit');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unsupported shell: powershell')
      );
    });
  });

  describe('registration', () => {
    it('registers completions as a top-level command', () => {
      const commandNames = program.commands.map((c) => c.name());
      expect(commandNames).toContain('completions');
    });

    it('has a description', () => {
      const completionsCmd = program.commands.find((c) => c.name() === 'completions');
      expect(completionsCmd?.description()).toBe('Output shell completion scripts');
    });
  });
});
