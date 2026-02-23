import { LoopClient } from '@dork-labs/loop-sdk';
import { resolveConfig, type GlobalOptions } from './config.js';

/**
 * Create a configured LoopClient using the resolved url and token.
 * Exits with an error message if url or token are not configured.
 *
 * @param globalOpts - Commander global options (apiUrl, token)
 */
export function createClient(globalOpts?: GlobalOptions): LoopClient {
  const { url, token } = resolveConfig(globalOpts);

  if (!url) {
    console.error('No API URL configured. Run: loop config set url <url>');
    process.exit(1);
  }
  if (!token) {
    console.error('No auth token configured. Run: loop config set token <token>');
    process.exit(1);
  }

  return new LoopClient({ apiKey: token, baseURL: url });
}
