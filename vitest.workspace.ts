import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/api',
  'apps/app',
  'apps/cli',
  'apps/web',
  'packages/mcp',
  'packages/loop-skill',
]);
