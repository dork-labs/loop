import 'dotenv/config'
import { z } from 'zod'

export const apiEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  LOOP_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(5667),
  LOOP_URL: z.string().url().default('http://localhost:5667'),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_CLIENT_SECRET: z.string().optional(),
  POSTHOG_WEBHOOK_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof apiEnvSchema>

const ENV_HINTS: Record<string, string> = {
  LOOP_API_KEY: [
    'Generate one with:',
    '  node -e "console.log(\'loop_\' + require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    'Or run: npm run setup',
  ].join('\n'),
  DATABASE_URL: 'Run: npm run db:dev:up (starts local PostgreSQL)',
}

// Tests use PGlite and inject the db directly — env vars are not needed.
// Provide safe defaults so module imports don't crash the test runner.
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

let env: Env

if (isTest) {
  env = {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    LOOP_API_KEY: 'loop_test-api-key',
    NODE_ENV: 'test',
    PORT: 5667,
    LOOP_URL: 'http://localhost:5667',
    GITHUB_WEBHOOK_SECRET: undefined,
    SENTRY_CLIENT_SECRET: undefined,
    POSTHOG_WEBHOOK_SECRET: undefined,
  }
} else {
  const result = apiEnvSchema.safeParse(process.env)

  if (!result.success) {
    console.error('\n  Missing or invalid environment variables:\n')
    result.error.issues.forEach((i) =>
      console.error(`  - ${i.path.join('.')}: ${i.message}`)
    )
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      if (typeof key === 'string' && ENV_HINTS[key]) {
        console.error(`\n  Hint for ${key}:\n  ${ENV_HINTS[key]}`)
      }
    }
    console.error('\n  Copy apps/api/.env.example to apps/api/.env\n')
    process.exit(1)
  }

  env = result.data
}

export { env }
