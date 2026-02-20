import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './db/schema'

/**
 * Driver-agnostic database type shared by routes, middleware, and tests.
 * Works with both Neon HTTP (production) and PGlite (tests).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>

/** Hono environment type with injected database. */
export type AppEnv = {
  Variables: {
    db: AnyDb
  }
}
