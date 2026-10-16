import {
  billingSettingsSchema,
  certificateSettingsSchema,
  contactSettingsSchema,
  type AppSettings,
} from '@udakids/engine';
import { ApiError } from '../client';
import { renameCertificates } from './certificate';
import { readDb, writeDb, type MockDb } from './db';
import { adminFromToken } from './staff';

/** Pengaturan yang sedang berlaku (dibaca langsung oleh modul tiruan lain dan oleh tampilan di mode tiruan). */
export const currentSettings = (): AppSettings => readDb().settings;

/** `GET /settings` (publik): tidak ada rahasia di pengaturan ini. */
export async function publicSettings(): Promise<AppSettings> {
  return structuredClone(readDb().settings);
}

export async function adminSettings(token: string | null): Promise<AppSettings> {
  adminFromToken(token);
  return structuredClone(readDb().settings);
}

const SCHEMAS = {
  billing: billingSettingsSchema,
  contact: contactSettingsSchema,
  certificate: certificateSettingsSchema,
} as const;
export type SettingsPart = keyof typeof SCHEMAS;
export const SETTINGS_PARTS = Object.keys(SCHEMAS) as SettingsPart[];

/** `PUT /admin/settings/:part`: satu bagian diganti utuh setelah lolos skema. */
export async function updateSettings(
  token: string | null,
  part: SettingsPart,
  body: unknown,
): Promise<AppSettings> {
  adminFromToken(token);
  const parsed = SCHEMAS[part].safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      400,
      { code: 'VALIDATION', message: 'Periksa lagi isian pengaturan' },
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  const db = readDb();
  const before = db.settings.certificate.useFullName;
  db.settings = { ...db.settings, [part]: parsed.data };
  // Aturan nama berubah: semua sertifikat yang terbit mengikuti aturan baru (nomor dan tanggal tetap).
  if (db.settings.certificate.useFullName !== before)
    for (const child of db.children) renameCertificates(db, child);
  writeDb(db);
  return structuredClone(db.settings);
}

/**
 * Level gratis: kunci berbayar mati, atau pengecualian admin per level, atau nomornya tidak melewati batas level
 * gratis di Pengaturan.
 */
export function isLevelFree(db: MockDb, levelId: string, levelNumber: number): boolean {
  const billing = db.settings.billing;
  if (!billing.paywall) return true;
  const override = db.contentEdits.levels[levelId]?.isFree;
  return override ?? levelNumber <= billing.freeLevels;
}
