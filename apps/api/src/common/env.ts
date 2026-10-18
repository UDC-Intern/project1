import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Muat `.env` di akar repo (bila ada) ke `process.env`. Variabel yang SUDAH diset (mis. dari systemd, CI, atau
 * hosting) tidak ditimpa. Dipanggil paling awal oleh API, seed, dan skrip database. `.env` tidak masuk git
 * (berisi rahasia); salin dari `.env.example`.
 */
export function loadRootEnv(start = __dirname): string | undefined {
  for (let dir = start; ; dir = dirname(dir)) {
    const file = join(dir, '.env');
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      if (!existsSync(file)) return undefined;
      const before = { ...process.env };
      process.loadEnvFile(file);
      for (const [k, v] of Object.entries(before)) process.env[k] = v; // nilai yang sudah ada menang
      return file;
    }
    if (dirname(dir) === dir) return undefined;
  }
}

loadRootEnv();
