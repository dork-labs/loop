import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';

vi.mock('node:fs');
vi.mock('node:os');

const CONFIG_DIR = '/mock-home/.loop';
const CONFIG_PATH = '/mock-home/.loop/config.json';

beforeEach(() => {
  vi.mocked(os.homedir).mockReturnValue('/mock-home');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Re-import to pick up mocks each time
async function loadModule() {
  // Reset module registry so mocks take effect
  vi.resetModules();
  return import('../../src/lib/config.js');
}

describe('readConfig', () => {
  it('returns parsed config when file exists', async () => {
    const { readConfig } = await loadModule();
    const mockConfig = { url: 'https://api.looped.me', token: 'tok_abc123xyz789' };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));

    const result = readConfig();

    expect(fs.readFileSync).toHaveBeenCalledWith(CONFIG_PATH, 'utf-8');
    expect(result).toEqual(mockConfig);
  });

  it('returns empty object when file does not exist', async () => {
    const { readConfig } = await loadModule();
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT: no such file or directory');
    });

    const result = readConfig();

    expect(result).toEqual({});
  });

  it('returns empty object when file contains invalid JSON', async () => {
    const { readConfig } = await loadModule();
    vi.mocked(fs.readFileSync).mockReturnValue('not-json');

    const result = readConfig();

    expect(result).toEqual({});
  });
});

describe('writeConfig', () => {
  it('creates config directory and writes file with mode 0o600', async () => {
    const { writeConfig } = await loadModule();
    const config = { url: 'https://api.looped.me', token: 'tok_secret' };

    writeConfig(config);

    expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(CONFIG_PATH, JSON.stringify(config, null, 2), {
      mode: 0o600,
    });
  });

  it('creates directory even if it already exists (recursive: true)', async () => {
    const { writeConfig } = await loadModule();

    writeConfig({ url: 'https://example.com' });

    expect(fs.mkdirSync).toHaveBeenCalledWith(CONFIG_DIR, { recursive: true });
  });

  it('writes pretty-printed JSON', async () => {
    const { writeConfig } = await loadModule();
    const config = { url: 'https://api.looped.me' };

    writeConfig(config);

    const writtenContent = vi.mocked(fs.writeFileSync).mock.calls[0][1];
    expect(writtenContent).toBe('{\n  "url": "https://api.looped.me"\n}');
  });
});

describe('resolveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.LOOP_API_URL;
    delete process.env.LOOP_API_TOKEN;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reads from config file when no flags or env vars', async () => {
    const { resolveConfig } = await loadModule();
    const fileConfig = { url: 'https://file.example.com', token: 'tok_from_file' };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(fileConfig));

    const result = resolveConfig();

    expect(result).toEqual({ url: 'https://file.example.com', token: 'tok_from_file' });
  });

  it('env vars override config file values', async () => {
    const { resolveConfig } = await loadModule();
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ url: 'https://file.example.com', token: 'tok_file' })
    );
    process.env.LOOP_API_URL = 'https://env.example.com';
    process.env.LOOP_API_TOKEN = 'tok_env';

    const result = resolveConfig();

    expect(result).toEqual({ url: 'https://env.example.com', token: 'tok_env' });
  });

  it('CLI flags override env vars and config file', async () => {
    const { resolveConfig } = await loadModule();
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ url: 'https://file.example.com', token: 'tok_file' })
    );
    process.env.LOOP_API_URL = 'https://env.example.com';
    process.env.LOOP_API_TOKEN = 'tok_env';

    const result = resolveConfig({ apiUrl: 'https://flag.example.com', token: 'tok_flag' });

    expect(result).toEqual({ url: 'https://flag.example.com', token: 'tok_flag' });
  });

  it('partial CLI flags override only the specified values', async () => {
    const { resolveConfig } = await loadModule();
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ url: 'https://file.example.com', token: 'tok_file' })
    );
    process.env.LOOP_API_TOKEN = 'tok_env';

    const result = resolveConfig({ apiUrl: 'https://flag.example.com' });

    expect(result).toEqual({ url: 'https://flag.example.com', token: 'tok_env' });
  });

  it('returns undefined for unconfigured values', async () => {
    const { resolveConfig } = await loadModule();
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = resolveConfig();

    expect(result).toEqual({ url: undefined, token: undefined });
  });
});

describe('maskToken', () => {
  it('shows first 4 and last 4 characters for long tokens', async () => {
    const { maskToken } = await loadModule();

    expect(maskToken('tok_abc123xyz789')).toBe('tok_****z789');
  });

  it('returns **** for tokens with exactly 8 characters', async () => {
    const { maskToken } = await loadModule();

    expect(maskToken('12345678')).toBe('****');
  });

  it('returns **** for tokens shorter than 8 characters', async () => {
    const { maskToken } = await loadModule();

    expect(maskToken('short')).toBe('****');
  });

  it('returns **** for tokens with 9-12 characters', async () => {
    const { maskToken } = await loadModule();

    expect(maskToken('123456789')).toBe('****');
    expect(maskToken('123456789012')).toBe('****');
  });

  it('shows first 4 and last 4 for tokens over 12 characters', async () => {
    const { maskToken } = await loadModule();

    expect(maskToken('1234567890123')).toBe('1234****0123');
  });

  it('handles empty string', async () => {
    const { maskToken } = await loadModule();

    expect(maskToken('')).toBe('****');
  });
});
