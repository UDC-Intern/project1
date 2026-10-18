import '../src/common/env.js';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { DEFAULT_DATABASE_URL } from '../src/common/config.js';
export function pgTool(name: 'pg_dump' | 'pg_restore') {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  if (process.env.PG_BIN) return join(process.env.PG_BIN, exe);
  const base = 'C:\\Program Files\\PostgreSQL';
  if (process.platform === 'win32' && existsSync(base))
    for (const version of readdirSync(base).sort((a, b) => Number(b) - Number(a))) {
      const path = join(base, version, 'bin', exe);
      if (existsSync(path)) return path;
    }
  return exe;
}
export async function runPg(name: 'pg_dump' | 'pg_restore', args: string[]) {
  if (process.env.DATABASE_DRIVER === 'pglite')
    throw new Error('Perintah pg_dump/pg_restore memerlukan DATABASE_DRIVER=postgres.');
  const url = new URL(process.env.DATABASE_URL || DEFAULT_DATABASE_URL);
  const env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    ...(url.searchParams.get('sslmode') && { PGSSLMODE: url.searchParams.get('sslmode')! }),
  };
  await new Promise<void>((resolve, reject) => {
    const child = spawn(pgTool(name), args, { env, stdio: 'inherit', windowsHide: true });
    child.once('error', () =>
      reject(new Error('Perangkat PostgreSQL tidak ditemukan. Isi PG_BIN.')),
    );
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Operasi database belum berhasil.')),
    );
  });
}
