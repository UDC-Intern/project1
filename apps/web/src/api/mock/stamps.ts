import { STAMP_LIBRARY_MAX, stampInputSchema, type Stamp } from '@udakids/engine';
import { ApiError } from '../client';
import { newId, readDb, writeDb } from './db';
import { adminFromToken } from './staff';

/**
 * Riwayat stempel sertifikat di mode tiruan: stempel yang pernah diunggah admin, disimpan di data tiruan supaya
 * bisa dipilih lagi oleh admin mana pun di sesi berikutnya. Stempel yang sedang dipakai lembar ada di pengaturan
 * \`certificate.stampImage\`, bukan di sini; riwayat hanya daftar pilihan.
 */

/** \`GET /admin/stamps\`: riwayat stempel, yang terbaru di depan. */
export async function list(token: string | null): Promise<Stamp[]> {
  adminFromToken(token);
  return readDb().stamps ?? [];
}

/**
 * \`POST /admin/stamps\`: simpan stempel ke riwayat. Gambar yang sama dengan yang sudah ada tidak disimpan dua kali
 * (stempel lama dipindah ke depan dan namanya diperbarui). 409 bila riwayat penuh.
 */
export async function add(token: string | null, body: unknown): Promise<Stamp[]> {
  adminFromToken(token);
  const parsed = stampInputSchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      400,
      { code: 'VALIDATION', message: parsed.error.issues[0]?.message ?? 'Periksa lagi isian.' },
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  const db = readDb();
  const all = db.stamps ?? [];
  const same = all.find((x) => x.image === parsed.data.image);
  if (!same && all.length >= STAMP_LIBRARY_MAX)
    throw new ApiError(409, {
      code: 'CONFLICT',
      message: `Riwayat stempel penuh (${STAMP_LIBRARY_MAX}). Hapus stempel yang tidak dipakai dulu.`,
    });
  const entry: Stamp = {
    id: same?.id ?? newId('stamp'),
    name: parsed.data.name,
    image: parsed.data.image,
    createdAt: new Date().toISOString(),
  };
  db.stamps = [entry, ...all.filter((x) => x.id !== entry.id)];
  writeDb(db);
  return db.stamps;
}

/** \`DELETE /admin/stamps/:id\`: hapus dari riwayat. Lembar yang sedang memakainya tidak berubah. */
export async function remove(token: string | null, id: string): Promise<Stamp[]> {
  adminFromToken(token);
  const db = readDb();
  const all = db.stamps ?? [];
  if (!all.some((x) => x.id === id))
    throw new ApiError(404, { code: 'NOT_FOUND', message: 'Stempel tidak ketemu di riwayat.' });
  db.stamps = all.filter((x) => x.id !== id);
  writeDb(db);
  return db.stamps;
}
