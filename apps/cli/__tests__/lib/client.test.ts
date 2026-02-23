import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';

vi.mock('node:fs');
vi.mock('node:os');
vi.mock('@dork-labs/loop-sdk', () => ({
  LoopClient: vi.fn().mockImplementation((opts) => ({
    _opts: opts,
  })),
}));

beforeEach(() => {
  vi.mocked(os.homedir).mockReturnValue('/mock-home');
});

afterEach(() => {
  vi.restoreAllMocks();
});

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.LOOP_API_URL;
  delete process.env.LOOP_API_TOKEN;
});

afterEach(() => {
  process.env = originalEnv;
});

async function loadModule() {
  vi.resetModules();
  return import('../../src/lib/client.js');
}

async function loadSdk() {
  vi.resetModules();
  return import('@dork-labs/loop-sdk');
}

describe('createClient', () => {
  it('creates LoopClient with resolved url and token', async () => {
    const config = { url: 'https://api.looped.me', token: 'tok_abc123xyz789' };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

    const { createClient } = await loadModule();
    const { LoopClient } = await loadSdk();

    createClient();

    expect(LoopClient).toHaveBeenCalledWith({
      apiKey: 'tok_abc123xyz789',
      baseURL: 'https://api.looped.me',
    });
  });

  it('exits with error when url is missing', async () => {
    const config = { token: 'tok_abc123xyz789' };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { createClient } = await loadModule();

    expect(() => createClient()).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(
      'No API URL configured. Run: loop config set url <url>'
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('exits with error when token is missing', async () => {
    const config = { url: 'https://api.looped.me' };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { createClient } = await loadModule();

    expect(() => createClient()).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(
      'No auth token configured. Run: loop config set token <token>'
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('uses global options (--api-url, --token) when provided', async () => {
    const config = { url: 'https://file.example.com', token: 'tok_from_file' };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

    const { createClient } = await loadModule();
    const { LoopClient } = await loadSdk();

    createClient({ apiUrl: 'https://flag.example.com', token: 'tok_from_flag' });

    expect(LoopClient).toHaveBeenCalledWith({
      apiKey: 'tok_from_flag',
      baseURL: 'https://flag.example.com',
    });
  });

  it('uses env vars when CLI flags not provided', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    process.env.LOOP_API_URL = 'https://env.example.com';
    process.env.LOOP_API_TOKEN = 'tok_from_env';

    const { createClient } = await loadModule();
    const { LoopClient } = await loadSdk();

    createClient();

    expect(LoopClient).toHaveBeenCalledWith({
      apiKey: 'tok_from_env',
      baseURL: 'https://env.example.com',
    });
  });

  it('exits when both url and token are missing', async () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { createClient } = await loadModule();

    expect(() => createClient()).toThrow('process.exit called');
    expect(mockError).toHaveBeenCalledWith(
      'No API URL configured. Run: loop config set url <url>'
    );

    mockExit.mockRestore();
    mockError.mockRestore();
  });

  it('returns a LoopClient instance', async () => {
    const config = { url: 'https://api.looped.me', token: 'tok_abc123xyz789' };
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(config));

    const { createClient } = await loadModule();

    const client = createClient();
    expect(client).toBeDefined();
  });
});
