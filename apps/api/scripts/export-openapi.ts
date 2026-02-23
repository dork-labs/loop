/**
 * Export the OpenAPI 3.1 document to docs/api/openapi.json.
 *
 * Run with: npx tsx apps/api/scripts/export-openapi.ts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOpenApiDocument } from '../src/lib/openapi-schemas';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve output path relative to the repo root (three levels up from apps/api/scripts/)
const repoRoot = resolve(__dirname, '..', '..', '..');
const outputPath = resolve(repoRoot, 'docs', 'api', 'openapi.json');

const document = generateOpenApiDocument();
const pathCount = Object.keys(document.paths ?? {}).length;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf-8');

console.log(`OpenAPI document written to ${outputPath}`);
console.log(`  ${pathCount} paths exported`);
