import ky, { type KyInstance } from 'ky';
import { LoopError } from './errors';

export type HttpClient = KyInstance;

/**
 * Configuration options for {@link LoopClient}.
 */
export interface LoopClientOptions {
  /** Loop API key — must start with `loop_`. */
  apiKey: string;
  /** Base URL of the Loop API (default: `http://localhost:5667`). */
  baseURL?: string;
  /** Request timeout in milliseconds (default: 30 000). */
  timeout?: number;
  /** Maximum number of automatic retries on transient errors (default: 2). */
  maxRetries?: number;
  /** HTTP status codes that trigger a retry (default: `[429, 500, 503]`). */
  retryStatusCodes?: number[];
}

/** Per-request overrides for mutating operations. */
export interface RequestOptions {
  idempotencyKey?: string;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Create a ky HTTP client pre-configured with auth, retry, and error mapping.
 *
 * @param options - Client configuration
 */
export function createHttpClient(options: LoopClientOptions): HttpClient {
  return ky.create({
    prefixUrl: options.baseURL ?? 'http://localhost:5667',
    timeout: options.timeout ?? 30_000,
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    retry: {
      limit: options.maxRetries ?? 2,
      statusCodes: options.retryStatusCodes ?? [429, 500, 503],
      backoffLimit: 10_000,
    },
    hooks: {
      beforeError: [
        async (error) => {
          const { response } = error;
          if (response) {
            const body = await response.json().catch(() => ({}));
            throw LoopError.fromResponse(response.status, body as Record<string, unknown>);
          }
          throw error;
        },
      ],
      beforeRequest: [
        (request) => {
          // Add idempotency key for mutating requests
          if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
            if (!request.headers.has('Idempotency-Key')) {
              request.headers.set('Idempotency-Key', crypto.randomUUID());
            }
          }
        },
      ],
    },
  });
}

/**
 * Convert RequestOptions to ky-compatible options.
 *
 * @param options - Per-request overrides
 */
export function toKyOptions(options?: RequestOptions): Record<string, unknown> {
  if (!options) return {};
  const result: Record<string, unknown> = {};
  if (options.timeout) result.timeout = options.timeout;
  if (options.signal) result.signal = options.signal;
  if (options.idempotencyKey) {
    result.headers = { 'Idempotency-Key': options.idempotencyKey };
  }
  return result;
}

/**
 * Convert an object of params to URLSearchParams, omitting undefined values.
 *
 * @param params - Query parameters object
 */
export function toSearchParams(params?: Record<string, unknown>): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (!params) return searchParams;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  }
  return searchParams;
}
