import { PROOF_MAX_BYTES } from '@udakids/engine';
import { fail } from '../common/errors.js';
export function sniffImage(data: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255)
    return 'image/jpeg';
  if (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  return null;
}
export function validateImage(body: unknown, mime: string | undefined) {
  if (!Buffer.isBuffer(body) || !body.length) fail(400, 'VALIDATION', 'Berkas gambar kosong.');
  if (body.length > PROOF_MAX_BYTES) fail(413, 'VALIDATION', 'Gambar maksimal 3 MB.');
  const actual = sniffImage(body);
  if (!actual || actual !== mime?.split(';')[0])
    fail(400, 'VALIDATION', 'Isi gambar harus sesuai jenis PNG, JPG, atau WebP.');
  return { data: body, mime: actual };
}
