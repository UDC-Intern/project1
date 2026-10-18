import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { DEFAULT_DATABASE_URL } from '../common/config.js';
import { contentDir } from '../common/config.js';
import { join, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as localDrizzle } from 'drizzle-orm/pglite';
import { migrate as localMigrate } from 'drizzle-orm/pglite/migrator';

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');
export const LOCAL_DB = Symbol('LOCAL_DB');
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Executor = Pick<Db, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

@Global()
@Module({
  providers: [
    {
      provide: LOCAL_DB,
      useFactory: async () => {
        if (process.env.DATABASE_DRIVER !== 'pglite') return null;
        if (process.env.NODE_ENV === 'production')
          throw new Error('Produksi wajib memakai PostgreSQL.');
        const folder =
          process.env.PGLITE_PATH || join(dirname(contentDir()), '.data', 'development');
        if (folder !== ':memory:') await mkdir(folder, { recursive: true });
        const client = folder === ':memory:' ? new PGlite() : new PGlite(folder);
        const db = localDrizzle(client, { schema });
        try {
          await localMigrate(db, { migrationsFolder: join(__dirname, '../../drizzle') });
          const { seed } = await import('../cli/seed.js');
          await seed(db);
          return { db, close: () => client.close() };
        } catch (error) {
          await client.close();
          throw error;
        }
      },
    },
    {
      provide: PG_POOL,
      useFactory: () => {
        const pool = new Pool({
          connectionString: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
          max: Number(process.env.DB_POOL_MAX ?? 20),
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
          options: '-c statement_timeout=15000 -c idle_in_transaction_session_timeout=30000',
        });
        pool.on('error', () => console.error('Sambungan database terputus.'));
        return pool;
      },
    },
    {
      provide: DB,
      inject: [PG_POOL, LOCAL_DB],
      useFactory: (pool: Pool, local: { db: Db } | null): Db =>
        local?.db ?? drizzle(pool, { schema }),
    },
  ],
  exports: [DB, PG_POOL],
})
export class DbModule implements OnApplicationShutdown {
  constructor(
    @Inject(PG_POOL) private pool: Pool,
    @Inject(LOCAL_DB) private local: { close: () => Promise<void> } | null,
  ) {}
  async onApplicationShutdown() {
    await this.local?.close();
    await this.pool.end();
  }
}
