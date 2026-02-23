import { describe, it, expect } from 'vitest';
import { program } from '../cli.js';

describe('CLI program configuration', () => {
  it('has program name set to loop', () => {
    expect(program.name()).toBe('loop');
  });

  it('has version 0.2.0', () => {
    expect(program.version()).toBe('0.2.0');
  });

  it('has description set to Terminal-native interface to Loop', () => {
    expect(program.description()).toBe('Terminal-native interface to Loop');
  });

  it('has --json global option', () => {
    const jsonOption = program.options.find((o) => o.long === '--json');
    expect(jsonOption).toBeDefined();
  });

  it('has --plain global option', () => {
    const plainOption = program.options.find((o) => o.long === '--plain');
    expect(plainOption).toBeDefined();
    expect(plainOption?.description).toBe('Output tab-separated values (no colors)');
  });

  it('has --api-url global option', () => {
    const apiUrlOption = program.options.find((o) => o.long === '--api-url');
    expect(apiUrlOption).toBeDefined();
  });

  it('has --token global option', () => {
    const tokenOption = program.options.find((o) => o.long === '--token');
    expect(tokenOption).toBeDefined();
  });

  it('registers expected commands', () => {
    const commandNames = program.commands.map((c) => c.name());
    expect(commandNames).toContain('auth');
    expect(commandNames).toContain('config');
    expect(commandNames).toContain('issues');
    expect(commandNames).toContain('comments');
    expect(commandNames).toContain('signals');
    expect(commandNames).toContain('triage');
    expect(commandNames).toContain('projects');
    expect(commandNames).toContain('goals');
    expect(commandNames).toContain('templates');
    expect(commandNames).toContain('next');
    expect(commandNames).toContain('dispatch');
    expect(commandNames).toContain('dashboard');
    expect(commandNames).toContain('labels');
    expect(commandNames).toContain('completions');
  });

  it('issues command has expected subcommands', () => {
    const issuesCmd = program.commands.find((c) => c.name() === 'issues');
    expect(issuesCmd).toBeDefined();
    const subcommandNames = issuesCmd!.commands.map((c) => c.name());
    expect(subcommandNames).toContain('list');
    expect(subcommandNames).toContain('view');
    expect(subcommandNames).toContain('create');
    expect(subcommandNames).toContain('start');
    expect(subcommandNames).toContain('done');
  });
});
