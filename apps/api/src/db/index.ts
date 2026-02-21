import * as schema from './schema'
import { env } from '../env'
import type { AnyDb } from '../types'

let db: AnyDb

if (env.NODE_ENV === 'production') {
  const { neon } = await import('@neondatabase/serverless')
  const { drizzle } = await import('drizzle-orm/neon-http')
  const sql = neon(env.DATABASE_URL)
  db = drizzle(sql, { schema }) as unknown as AnyDb
} else {
  const pg = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const pool = new pg.default.Pool({ connectionString: env.DATABASE_URL })
  db = drizzle(pool, { schema }) as unknown as AnyDb
}

export { db }
export type Database = typeof db
