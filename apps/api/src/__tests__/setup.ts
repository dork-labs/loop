import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { Hono } from 'hono'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach } from 'vitest'
import * as schema from '../db/schema'

// Set the API key env var so auth middleware passes in all tests.
// This mirrors the LOOP_API_KEY secret used in production.
process.env.LOOP_API_KEY = process.env.LOOP_API_KEY ?? 'loop_test-api-key'

import type { AppEnv } from '../types'

/**
 * Drizzle database instance type used throughout the API.
 * Typed against the full schema for relational query support.
 */
export type DbType = ReturnType<typeof drizzle<typeof schema>>

/** @deprecated Use `AppEnv` from `../types` directly. Kept for test compatibility. */
export type TestAppEnv = AppEnv

/** Shared database variable reset before each test by `withTestDb`. */
let db: DbType

/**
 * Returns the current test database instance.
 * Must be called within a test — initialised by `beforeEach` in `withTestDb`.
 */
export function getTestDb(): DbType {
  return db
}

/**
 * Creates an isolated in-memory PGlite database with the full schema applied
 * via Drizzle migrations.
 *
 * @returns A Drizzle `PgliteDatabase` instance backed by in-memory PGlite.
 */
async function createIsolatedDb(): Promise<DbType> {
  const client = new PGlite()
  const instance = drizzle(client, { schema })

  // Apply all pending migrations so the schema matches production.
  // Run `npm run db:generate` to regenerate migrations after schema changes.
  // Resolve relative to this file so the path works regardless of cwd.
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const migrationsFolder = path.resolve(__dirname, '../../drizzle/migrations')
  await migrate(instance, { migrationsFolder })

  return instance
}

/**
 * Creates a minimal Hono app with the test database injected into context
 * via `c.get('db')`, matching the production context variable convention.
 *
 * Routes registered on the returned app share the isolated test database,
 * enabling full integration tests without a running PostgreSQL server.
 *
 * @param testDb - The PGlite Drizzle instance to inject. Defaults to the
 *   database initialised by the most recent `withTestDb` `beforeEach` hook.
 * @returns A typed Hono app instance configured for testing.
 *
 * @example
 * ```ts
 * describe('projects API', () => {
 *   withTestDb()
 *
 *   it('lists projects', async () => {
 *     const app = createTestApp()
 *     app.get('/projects', projectsHandler)
 *
 *     const res = await app.request('/projects', {
 *       headers: { 'x-api-key': process.env.LOOP_API_KEY },
 *     })
 *     expect(res.status).toBe(200)
 *   })
 * })
 * ```
 */
export function createTestApp(testDb?: DbType): Hono<TestAppEnv> {
  const instance = testDb ?? db
  const app = new Hono<TestAppEnv>()

  // Inject the test database into every request context so handlers that call
  // `c.get('db')` receive the in-memory PGlite instance instead of the real pool.
  app.use('*', async (c, next) => {
    c.set('db', instance)
    await next()
  })

  return app
}

/**
 * Registers `beforeEach`/`afterEach` hooks that spin up and tear down an
 * isolated in-memory database for each test.
 *
 * Call this at the top of any describe block that needs database access.
 *
 * @example
 * ```ts
 * describe('projects API', () => {
 *   withTestDb()
 *   // ...tests
 * })
 * ```
 */
export function withTestDb(): void {
  beforeEach(async () => {
    // A fresh PGlite instance per test ensures complete isolation.
    db = await createIsolatedDb()
  })

  // PGlite in-memory databases are automatically garbage-collected; no teardown
  // is required. The afterEach is reserved for future cleanup hooks.
  afterEach(() => {
    // no-op — GC handles in-memory cleanup
  })
}
