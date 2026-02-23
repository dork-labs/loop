/**
 * OpenAPI registry entrypoint for the Loop API.
 *
 * Re-exports the populated registry from `openapi-schemas.ts` and provides
 * the canonical `generateOpenAPISpec()` function consumed by:
 * - `scripts/export-openapi.ts` (build-time JSON export)
 * - `apps/api/src/app.ts` (`GET /api/openapi.json` runtime endpoint)
 * - `apps/api/src/__tests__/openapi-registry.test.ts` (registry tests)
 */
export { registry } from './openapi-schemas';
import { generateOpenApiDocument } from './openapi-schemas';

/**
 * Generate the complete OpenAPI 3.1 document from the registry.
 *
 * This is the canonical export used by downstream consumers. Internally
 * delegates to `generateOpenApiDocument()` in `openapi-schemas.ts`.
 *
 * @returns OpenAPI 3.1 document object ready for serialization to JSON or YAML.
 */
export function generateOpenAPISpec() {
  return generateOpenApiDocument();
}
