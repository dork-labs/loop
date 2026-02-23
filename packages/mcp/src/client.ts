import ky, { type KyInstance } from 'ky'

import type { ApiClientConfig } from './types.js'

/**
 * Create a ky HTTP client pre-configured for the Loop API.
 *
 * @param config - API base URL and authentication key
 */
export function createApiClient(config: ApiClientConfig): KyInstance {
  return ky.create({
    prefixUrl: config.apiUrl,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    retry: {
      limit: 2,
      statusCodes: [429, 500, 503],
    },
  })
}
