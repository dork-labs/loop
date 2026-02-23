import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../dist/bin.js');

/**
 * Run the CLI binary and return stdout.
 * Returns combined stdout/stderr on failure to capture error output.
 */
function runCli(args: string[]): string {
  try {
    return execFileSync('node', [CLI_PATH, ...args], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string };
    return (err.stdout?.trim() ?? '') + (err.stderr?.trim() ?? '');
  }
}

describe('CLI integration (binary)', () => {
  describe('global flags', () => {
    it('--version prints a semver version string', () => {
      const result = runCli(['--version']);
      expect(result).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('--help shows program name and top-level commands', () => {
      const result = runCli(['--help']);
      expect(result).toContain('loop');
      expect(result).toContain('next');
      expect(result).toContain('issues');
      expect(result).toContain('auth');
      expect(result).toContain('dashboard');
      expect(result).toContain('projects');
      expect(result).toContain('goals');
      expect(result).toContain('labels');
      expect(result).toContain('signals');
      expect(result).toContain('templates');
      expect(result).toContain('comments');
      expect(result).toContain('config');
      expect(result).toContain('completions');
      expect(result).toContain('triage');
      expect(result).toContain('dispatch');
    });

    it('--help shows global options (--json, --plain, --api-url, --token)', () => {
      const result = runCli(['--help']);
      expect(result).toContain('--json');
      expect(result).toContain('--plain');
      expect(result).toContain('--api-url');
      expect(result).toContain('--token');
    });
  });

  describe('issues command', () => {
    it('issues --help shows all subcommands', () => {
      const result = runCli(['issues', '--help']);
      expect(result).toContain('list');
      expect(result).toContain('view');
      expect(result).toContain('create');
      expect(result).toContain('start');
      expect(result).toContain('done');
    });
  });

  describe('auth command', () => {
    it('auth --help shows login, logout, status', () => {
      const result = runCli(['auth', '--help']);
      expect(result).toContain('login');
      expect(result).toContain('logout');
      expect(result).toContain('status');
    });
  });

  describe('next command', () => {
    it('next --help shows project filter option', () => {
      const result = runCli(['next', '--help']);
      expect(result).toContain('--project');
      expect(result).toContain('highest-priority');
    });
  });

  describe('dispatch command', () => {
    it('dispatch --help shows queue subcommand', () => {
      const result = runCli(['dispatch', '--help']);
      expect(result).toContain('queue');
    });
  });

  describe('completions command', () => {
    it('completions bash outputs a valid bash completion script', () => {
      const result = runCli(['completions', 'bash']);
      expect(result).toContain('_loop_completions');
      expect(result).toContain('complete -F _loop_completions loop');
    });

    it('completions zsh outputs a valid zsh completion script', () => {
      const result = runCli(['completions', 'zsh']);
      expect(result).toContain('#compdef loop');
      expect(result).toContain('_loop');
    });

    it('completions fish outputs a valid fish completion script', () => {
      const result = runCli(['completions', 'fish']);
      expect(result).toContain('complete -c loop -f');
      expect(result).toContain("__fish_use_subcommand");
    });
  });

  describe('other resource commands', () => {
    it('projects --help shows list subcommand', () => {
      const result = runCli(['projects', '--help']);
      expect(result).toContain('list');
    });

    it('goals --help shows list subcommand', () => {
      const result = runCli(['goals', '--help']);
      expect(result).toContain('list');
    });

    it('labels --help shows list subcommand', () => {
      const result = runCli(['labels', '--help']);
      expect(result).toContain('list');
    });

    it('templates --help shows subcommands', () => {
      const result = runCli(['templates', '--help']);
      expect(result).toContain('list');
      expect(result).toContain('show');
      expect(result).toContain('promote');
    });

    it('signals --help shows ingest subcommand', () => {
      const result = runCli(['signals', '--help']);
      expect(result).toContain('ingest');
    });

    it('comments --help shows add subcommand', () => {
      const result = runCli(['comments', '--help']);
      expect(result).toContain('add');
    });

    it('triage --help shows accept and decline subcommands', () => {
      const result = runCli(['triage', '--help']);
      expect(result).toContain('accept');
      expect(result).toContain('decline');
    });
  });

  describe('error handling', () => {
    it('unknown command shows help or error', () => {
      const result = runCli(['nonexistent-command']);
      expect(result).toContain('unknown command');
    });
  });
});
