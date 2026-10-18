import { API_URL } from '../config/app';
import { getSession } from '../auth/session';
export const assetUrl = (path: string) =>
  path.startsWith('/api/') ? `${API_URL}${path.slice(4)}` : path;
/** Ilustrasi yang belum disetujui tetap memerlukan sesi staf, termasuk pratinjaunya. */
export async function illustrationBlob(path: string, signal?: AbortSignal): Promise<Blob> {
  const headers: Record<string, string> = {};
  if (path.startsWith('/api/admin/')) {
    const token = getSession('staff')?.token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(assetUrl(path), { headers, signal });
  if (!res.ok) throw new Error('Gambar belum tersedia.');
  return res.blob();
}
