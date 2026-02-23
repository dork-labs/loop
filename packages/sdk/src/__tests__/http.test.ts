import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHttpClient, toKyOptions, toSearchParams, type LoopClientOptions } from '../http';

// Typed alias for captured ky.create options
type KyCreateOptions = Record<string, unknown>;

// Capture the options passed to ky.create for assertion
let capturedOptions: KyCreateOptions = {};
const mockKyInstance = {} as object;

vi.mock('ky', () => ({
  default: {
    create: (opts: KyCreateOptions) => {
      capturedOptions = opts;
      return mockKyInstance;
    },
  },
}));

function getHooks() {
  const hooks = capturedOptions.hooks as Record<string, unknown[]>;
  return hooks;
}

describe('createHttpClient', () => {
  beforeEach(() => {
    capturedOptions = {};
  });

  it('returns the ky instance produced by ky.create', () => {
    const client = createHttpClient({ apiKey: 'loop_test_key' });
    expect(client).toBe(mockKyInstance);
  });

  it('uses default prefixUrl when baseURL is not provided', () => {
    createHttpClient({ apiKey: 'loop_test_key' });
    expect(capturedOptions.prefixUrl).toBe('http://localhost:5667');
  });

  it('uses provided baseURL when given', () => {
    createHttpClient({ apiKey: 'loop_test_key', baseURL: 'https://api.looped.me' });
    expect(capturedOptions.prefixUrl).toBe('https://api.looped.me');
  });

  it('sets Authorization header to Bearer <apiKey>', () => {
    createHttpClient({ apiKey: 'loop_abc123' });
    const headers = capturedOptions.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer loop_abc123');
  });

  it('sets Content-Type header to application/json', () => {
    createHttpClient({ apiKey: 'loop_test_key' });
    const headers = capturedOptions.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('uses default timeout of 30000ms', () => {
    createHttpClient({ apiKey: 'loop_test_key' });
    expect(capturedOptions.timeout).toBe(30_000);
  });

  it('uses provided timeout when given', () => {
    createHttpClient({ apiKey: 'loop_test_key', timeout: 5000 });
    expect(capturedOptions.timeout).toBe(5000);
  });

  it('uses default retry limit of 2', () => {
    createHttpClient({ apiKey: 'loop_test_key' });
    const retry = capturedOptions.retry as Record<string, unknown>;
    expect(retry.limit).toBe(2);
  });

  it('uses provided maxRetries when given', () => {
    createHttpClient({ apiKey: 'loop_test_key', maxRetries: 5 });
    const retry = capturedOptions.retry as Record<string, unknown>;
    expect(retry.limit).toBe(5);
  });

  it('uses default retry status codes [429, 500, 503]', () => {
    createHttpClient({ apiKey: 'loop_test_key' });
    const retry = capturedOptions.retry as Record<string, unknown>;
    expect(retry.statusCodes).toEqual([429, 500, 503]);
  });

  it('uses provided retryStatusCodes when given', () => {
    createHttpClient({ apiKey: 'loop_test_key', retryStatusCodes: [408, 429] });
    const retry = capturedOptions.retry as Record<string, unknown>;
    expect(retry.statusCodes).toEqual([408, 429]);
  });

  it('configures backoffLimit of 10000 in retry options', () => {
    createHttpClient({ apiKey: 'loop_test_key' });
    const retry = capturedOptions.retry as Record<string, unknown>;
    expect(retry.backoffLimit).toBe(10_000);
  });

  it('includes beforeError and beforeRequest hooks', () => {
    createHttpClient({ apiKey: 'loop_test_key' });
    const hooks = getHooks();
    expect(Array.isArray(hooks.beforeError)).toBe(true);
    expect(hooks.beforeError).toHaveLength(1);
    expect(Array.isArray(hooks.beforeRequest)).toBe(true);
    expect(hooks.beforeRequest).toHaveLength(1);
  });

  describe('beforeError hook', () => {
    function getBeforeErrorHook(options?: LoopClientOptions) {
      createHttpClient(options ?? { apiKey: 'loop_test_key' });
      const hooks = getHooks();
      return hooks.beforeError[0] as (error: Record<string, unknown>) => Promise<unknown>;
    }

    it('transforms HTTP error responses into LoopError instances', async () => {
      const beforeError = getBeforeErrorHook();
      const mockError = {
        response: {
          status: 404,
          json: vi.fn().mockResolvedValue({ error: 'Not found' }),
        },
      };

      await expect(beforeError(mockError)).rejects.toMatchObject({
        name: 'LoopNotFoundError',
        status: 404,
        code: 'NOT_FOUND',
      });
    });

    it('re-throws the original error when response is absent', async () => {
      const beforeError = getBeforeErrorHook();
      const mockError: Record<string, unknown> = { response: undefined };

      await expect(beforeError(mockError)).rejects.toBe(mockError);
    });

    it('handles non-JSON responses gracefully', async () => {
      const beforeError = getBeforeErrorHook();
      const mockError = {
        response: {
          status: 500,
          json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
        },
      };

      await expect(beforeError(mockError)).rejects.toMatchObject({
        name: 'LoopError',
        status: 500,
        code: 'HTTP_500',
      });
    });

    it('maps 409 to LoopConflictError', async () => {
      const beforeError = getBeforeErrorHook();
      const mockError = {
        response: {
          status: 409,
          json: vi.fn().mockResolvedValue({ error: 'Conflict' }),
        },
      };

      await expect(beforeError(mockError)).rejects.toMatchObject({
        name: 'LoopConflictError',
        status: 409,
      });
    });

    it('maps 422 to LoopValidationError with details', async () => {
      const beforeError = getBeforeErrorHook();
      const mockError = {
        response: {
          status: 422,
          json: vi.fn().mockResolvedValue({ error: 'Invalid', details: { field: 'title' } }),
        },
      };

      await expect(beforeError(mockError)).rejects.toMatchObject({
        name: 'LoopValidationError',
        status: 422,
        details: { field: 'title' },
      });
    });

    it('maps 429 to LoopRateLimitError', async () => {
      const beforeError = getBeforeErrorHook();
      const mockError = {
        response: {
          status: 429,
          json: vi.fn().mockResolvedValue({ error: 'Rate limited' }),
        },
      };

      await expect(beforeError(mockError)).rejects.toMatchObject({
        name: 'LoopRateLimitError',
        status: 429,
      });
    });
  });

  describe('beforeRequest hook', () => {
    function getBeforeRequestHook(options?: LoopClientOptions) {
      createHttpClient(options ?? { apiKey: 'loop_test_key' });
      const hooks = getHooks();
      return hooks.beforeRequest[0] as (request: { method: string; headers: Headers }) => void;
    }

    it('adds Idempotency-Key header for POST requests', () => {
      const beforeRequest = getBeforeRequestHook();
      const headers = new Headers();
      beforeRequest({ method: 'POST', headers });
      expect(headers.has('Idempotency-Key')).toBe(true);
    });

    it('adds Idempotency-Key header for PATCH requests', () => {
      const beforeRequest = getBeforeRequestHook();
      const headers = new Headers();
      beforeRequest({ method: 'PATCH', headers });
      expect(headers.has('Idempotency-Key')).toBe(true);
    });

    it('adds Idempotency-Key header for DELETE requests', () => {
      const beforeRequest = getBeforeRequestHook();
      const headers = new Headers();
      beforeRequest({ method: 'DELETE', headers });
      expect(headers.has('Idempotency-Key')).toBe(true);
    });

    it('does NOT add Idempotency-Key for GET requests', () => {
      const beforeRequest = getBeforeRequestHook();
      const headers = new Headers();
      beforeRequest({ method: 'GET', headers });
      expect(headers.has('Idempotency-Key')).toBe(false);
    });

    it('does not overwrite an existing Idempotency-Key', () => {
      const beforeRequest = getBeforeRequestHook();
      const headers = new Headers({ 'Idempotency-Key': 'existing-key' });
      beforeRequest({ method: 'POST', headers });
      expect(headers.get('Idempotency-Key')).toBe('existing-key');
    });
  });
});

describe('toKyOptions', () => {
  it('returns empty object when no options provided', () => {
    expect(toKyOptions()).toEqual({});
  });

  it('returns empty object when options is undefined', () => {
    expect(toKyOptions(undefined)).toEqual({});
  });

  it('maps timeout to result.timeout', () => {
    const result = toKyOptions({ timeout: 5000 });
    expect(result.timeout).toBe(5000);
  });

  it('maps signal to result.signal', () => {
    const controller = new AbortController();
    const result = toKyOptions({ signal: controller.signal });
    expect(result.signal).toBe(controller.signal);
  });

  it('maps idempotencyKey to headers[Idempotency-Key]', () => {
    const result = toKyOptions({ idempotencyKey: 'my-key-123' });
    expect(result.headers).toEqual({ 'Idempotency-Key': 'my-key-123' });
  });

  it('maps all options together', () => {
    const controller = new AbortController();
    const result = toKyOptions({
      timeout: 10_000,
      signal: controller.signal,
      idempotencyKey: 'multi-key',
    });
    expect(result.timeout).toBe(10_000);
    expect(result.signal).toBe(controller.signal);
    expect(result.headers).toEqual({ 'Idempotency-Key': 'multi-key' });
  });

  it('omits undefined fields', () => {
    const result = toKyOptions({ timeout: undefined, idempotencyKey: undefined });
    expect(result).not.toHaveProperty('timeout');
    expect(result).not.toHaveProperty('headers');
  });
});

describe('toSearchParams', () => {
  it('returns empty URLSearchParams when no params provided', () => {
    const result = toSearchParams();
    expect([...result.entries()]).toHaveLength(0);
  });

  it('returns empty URLSearchParams for empty object', () => {
    const result = toSearchParams({});
    expect([...result.entries()]).toHaveLength(0);
  });

  it('converts string values', () => {
    const result = toSearchParams({ status: 'todo' });
    expect(result.get('status')).toBe('todo');
  });

  it('converts number values to strings', () => {
    const result = toSearchParams({ limit: 50, offset: 10 });
    expect(result.get('limit')).toBe('50');
    expect(result.get('offset')).toBe('10');
  });

  it('converts boolean values to strings', () => {
    const result = toSearchParams({ active: true });
    expect(result.get('active')).toBe('true');
  });

  it('omits undefined values', () => {
    const result = toSearchParams({ status: 'todo', type: undefined });
    expect(result.has('status')).toBe(true);
    expect(result.has('type')).toBe(false);
  });

  it('omits null values', () => {
    const result = toSearchParams({ status: 'todo', projectId: null });
    expect(result.has('status')).toBe(true);
    expect(result.has('projectId')).toBe(false);
  });

  it('handles multiple params', () => {
    const result = toSearchParams({ status: 'todo', type: 'task', limit: 20, offset: 0 });
    expect(result.get('status')).toBe('todo');
    expect(result.get('type')).toBe('task');
    expect(result.get('limit')).toBe('20');
    expect(result.get('offset')).toBe('0');
  });
});
