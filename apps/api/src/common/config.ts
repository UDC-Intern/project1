import { join } from 'node:path';
import { z } from 'zod';

export const DEFAULT_DATABASE_URL = 'postgres://udakids:udakids@localhost:5432/udakids';
const DEV_SECRET = 'dev-only-secret-ganti-di-produksi';

/**
 * Rahasia JWT. Wajib diisi (minimal 32 karakter di produksi) kecuali saat test otomatis. Rahasia bawaan ada di repo,
 * jadi bila dipakai di server siapa pun bisa memalsukan token admin.
 */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret === DEV_SECRET) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) return DEV_SECRET;
    throw new Error(
      'JWT_SECRET wajib diisi di .env (minimal 32 karakter). Buat dengan: openssl rand -base64 48',
    );
  }
  if (secret.length < 32 && process.env.NODE_ENV === 'production')
    throw new Error('JWT_SECRET terlalu pendek: minimal 32 karakter di produksi');
  return secret;
}

/** Folder konten repo (buku, topik, level, paket, rekening) untuk seed database. */
export const contentDir = () =>
  process.env.CONTENT_DIR || join(__dirname, '..', '..', '..', '..', 'content');

/** Masa berlaku sesi. Orang tua 7 hari (perangkat sering dipakai bersama anak); staf dan anak 12 jam. */
export const TOKEN_TTL = { staff: '12h', parent: '7d', child: '12h' } as const;

export function runtimeOptions() {
  const values = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value?.trim()),
  );
  const env = z
    .object({
      API_PORT: z.coerce.number().int().min(1).max(65535).default(7177),
      DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),
      DATABASE_DRIVER: z.enum(['postgres', 'pglite']).default('postgres'),
      EMAIL_VERIFICATION: z.enum(['on', 'off']).default('off'),
      MAIL_WORKER: z.enum(['on', 'off']).default('on'),
      WEB_ORIGIN: z.string().default('http://localhost:6006'),
    })
    .parse(values);
  const origins = env.WEB_ORIGIN.split(',').map((o) => o.trim());
  z.array(z.url().refine((url) => /^https?:\/\//.test(url)))
    .min(1)
    .parse(origins);
  for (const [key, value] of Object.entries(env)) process.env[key] = String(value);
  jwtSecret();
  return { port: env.API_PORT, origins };
}
