import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../src/client.js';

// Spy on ky.create to capture the config it receives
vi.mock('ky', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ky')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(actual.default.create),
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports -- need the mocked version
import ky from 'ky';

describe('createApiClient', () => {
  const config = {
    apiKey: 'test-api-key',
    apiUrl: 'https://api.example.com',
  };

  it('creates a ky instance with standard HTTP methods', () => {
    const client = createApiClient(config);
    expect(client).toBeDefined();
    expect(typeof client.get).toBe('function');
    expect(typeof client.post).toBe('function');
    expect(typeof client.patch).toBe('function');
    expect(typeof client.delete).toBe('function');
  });

  it('passes the prefixUrl from config', () => {
    createApiClient(config);

    expect(ky.create).toHaveBeenCalledWith(
      expect.objectContaining({
        prefixUrl: 'https://api.example.com',
      })
    );
  });

  it('sets the Authorization header with Bearer token', () => {
    createApiClient(config);

    expect(ky.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-api-key',
        },
      })
    );
  });

  it('configures retry for transient error status codes', () => {
    createApiClient(config);

    expect(ky.create).toHaveBeenCalledWith(
      expect.objectContaining({
        retry: {
          limit: 2,
          statusCodes: [429, 500, 503],
        },
      })
    );
  });
});
