import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

/**
 * Fumadocs source loader for documentation pages.
 *
 * Reads MDX content from the root-level docs/ directory (configured in source.config.ts)
 * and makes it available at the /docs base URL.
 */
export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});
