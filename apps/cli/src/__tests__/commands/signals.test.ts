import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerSignalsCommand } from '../../commands/signals.js';

// Mock client module
const mockIngest = vi.fn();
vi.mock('../../lib/client.js', () => ({
  createClient: vi.fn(() => ({
    signals: { ingest: mockIngest },
  })),
}));

describe('signals command', () => {
  let program: Command;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.exitOverride();
    program.option('--json', 'Output raw JSON');
    program.option('--plain', 'Output tab-separated values (no colors)');
    program.option('--api-url <url>', 'Override API URL');
    program.option('--token <token>', 'Override auth token');
    registerSignalsCommand(program);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ingest', () => {
    it('calls client.signals.ingest with default options and prints success', async () => {
      mockIngest.mockResolvedValue({
        signal: { id: 'sig-1' },
        issue: { number: 42, title: 'Triage: manual signal' },
      });

      await program.parseAsync(['node', 'test', 'signals', 'ingest', 'Something broke']);

      expect(mockIngest).toHaveBeenCalledWith({
        source: 'manual',
        type: 'manual-signal',
        severity: 'medium',
        payload: { message: 'Something broke' },
      });
      expect(console.log).toHaveBeenCalledWith('Signal created: sig-1');
      expect(console.log).toHaveBeenCalledWith(
        'Linked issue: #42 Triage: manual signal'
      );
    });

    it('passes custom source, severity, and project options', async () => {
      mockIngest.mockResolvedValue({
        signal: { id: 'sig-2' },
        issue: { number: 43, title: 'Triage: custom signal' },
      });

      await program.parseAsync([
        'node',
        'test',
        'signals',
        'ingest',
        'Critical failure',
        '--source',
        'sentry',
        '--severity',
        'critical',
        '--project',
        'proj-1',
      ]);

      expect(mockIngest).toHaveBeenCalledWith({
        source: 'sentry',
        type: 'manual-signal',
        severity: 'critical',
        payload: { message: 'Critical failure' },
        projectId: 'proj-1',
      });
    });

    it('outputs raw JSON when --json is set', async () => {
      const result = {
        signal: { id: 'sig-1' },
        issue: { number: 42, title: 'Triage: manual signal' },
      };
      mockIngest.mockResolvedValue(result);
      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await program.parseAsync([
        'node',
        'test',
        '--json',
        'signals',
        'ingest',
        'Something broke',
      ]);

      expect(writeSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2) + '\n');
      writeSpy.mockRestore();
    });

    it('exits with error on API failure', async () => {
      mockIngest.mockRejectedValue(new Error('Network error'));

      await expect(
        program.parseAsync(['node', 'test', 'signals', 'ingest', 'Something broke'])
      ).rejects.toThrow('process.exit');

      expect(console.error).toHaveBeenCalledWith('Error: Network error');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
