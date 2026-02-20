import ky from 'ky'
import { resolveConfig, type GlobalOptions } from './config.js'

/**
 * Create a configured ky instance for API calls.
 * Exits with error if url or token are not configured.
 */
export function createApiClient(globalOpts?: GlobalOptions): typeof ky {
  const { url, token } = resolveConfig(globalOpts)

  if (!url) {
    console.error('No API URL configured. Run: looped config set url <url>')
    process.exit(1)
  }
  if (!token) {
    console.error('No auth token configured. Run: looped config set token <token>')
    process.exit(1)
  }

  return ky.create({
    prefixUrl: url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    retry: {
      limit: 2,
      statusCodes: [429, 500, 503],
    },
  })
}
