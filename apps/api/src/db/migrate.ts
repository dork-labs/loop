import 'dotenv/config';

// migrate.ts is run directly via `node --experimental-strip-types` which uses
// Node.js ESM resolution (requires .ts extensions), incompatible with our
// moduleResolution: "bundler" tsconfig. Use process.env directly instead of env.ts.
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required. Copy apps/api/.env.example to apps/api/.env');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  const { migrate } = await import('drizzle-orm/neon-http/migrator');
  const sql = neon(DATABASE_URL);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
} else {
  const pg = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');
  const { migrate } = await import('drizzle-orm/node-postgres/migrator');
  const pool = new pg.default.Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  await pool.end();
}

console.log('Migrations complete');
process.exit(0);
