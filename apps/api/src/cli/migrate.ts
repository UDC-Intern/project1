import '../common/env.js';
import { join } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DEFAULT_DATABASE_URL } from '../common/config.js';

export async function runMigrations() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL });
  const connection = await pool.connect();
  try {
    await connection.query('select pg_advisory_lock(7177000)');
    await migrate(drizzle(connection), { migrationsFolder: join(__dirname, '../../drizzle') });
  } finally {
    await connection.query('select pg_advisory_unlock(7177000)');
    connection.release();
    await pool.end();
  }
}
if (require.main === module)
  void runMigrations().catch(() => {
    console.error('Migrasi belum berhasil. Periksa database.');
    process.exitCode = 1;
  });
