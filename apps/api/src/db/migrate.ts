import 'dotenv/config'
import { env } from '../env'

if (env.NODE_ENV === 'production') {
  const { neon } = await import('@neondatabase/serverless')
  const { drizzle } = await import('drizzle-orm/neon-http')
  const { migrate } = await import('drizzle-orm/neon-http/migrator')
  const sql = neon(env.DATABASE_URL)
  const db = drizzle(sql)
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
} else {
  const pg = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { migrate } = await import('drizzle-orm/node-postgres/migrator')
  const pool = new pg.default.Pool({ connectionString: env.DATABASE_URL })
  const db = drizzle(pool)
  await migrate(db, { migrationsFolder: './drizzle/migrations' })
  await pool.end()
}

console.log('Migrations complete')
process.exit(0)
