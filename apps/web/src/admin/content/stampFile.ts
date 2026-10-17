import { SIGNATURE_IMAGE_MAX } from '@udakids/engine';
import { SIGNATURE_MAX_BYTES, SIGNATURE_MIME, decodeImage } from './signatureFile';

/** Gambar stempel yang diunggah admin: diperiksa, dikecilkan, dan dikodekan ulang supaya muat di pengaturan. */

export const STAMP_MIME = SIGNATURE_MIME;
export const STAMP_MAX_BYTES = SIGNATURE_MAX_BYTES;
/** Sisi terpanjang gambar stempel yang disimpan (px); lembar hanya memakainya sekitar 130 px, jadi ini sudah tajam. */
export const STAMP_SIDE = 480;
/** Gambar yang hampir seluruhnya kosong (transparan atau putih polos) ditolak. */
export const STAMP_MIN_VISIBLE = 0.005;

export type StampProblem = 'type' | 'size' | 'read' | 'empty' | 'canvas' | 'big';
export type StampResult = { ok: true; dataUrl: string } | { ok: false; problem: StampProblem };

/** Bagian piksel yang terlihat: tidak transparan dan tidak putih polos. `data` berisi RGBA. */
export function visibleShare(data: ArrayLike<number>): number {
  const pixels = Math.floor(data.length / 4);
  if (pixels === 0) return 0;
  let seen = 0;
  for (let i = 0; i < pixels * 4; i += 4) {
    if (data[i + 3]! < 30) continue;
    if (data[i]! > 245 && data[i + 1]! > 245 && data[i + 2]! > 245) continue;
    seen++;
  }
  return seen / pixels;
}

/** Ada piksel yang tembus pandang? Bila tidak, gambar boleh dikodekan JPEG yang lebih kecil. */
export function hasTransparency(data: ArrayLike<number>): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) return true;
  return false;
}

/**
 * Memproses berkas menjadi Data URL siap simpan: tolak yang bukan gambar, terlalu besar, atau kosong; kecilkan ke
 * paling besar 480 px pada sisi terpanjang tanpa mengubah perbandingan; kodekan PNG (transparan tetap transparan),
 * atau JPEG/WebP bila PNG terlalu besar.
 */
export async function processStampFile(file: File): Promise<StampResult> {
  if (!STAMP_MIME.includes(file.type)) return { ok: false, problem: 'type' };
  if (file.size > STAMP_MAX_BYTES) return { ok: false, problem: 'size' };

  const image = await decodeImage(file);
  if (!image) return { ok: false, problem: 'read' };
  try {
    const k = Math.min(1, STAMP_SIDE / Math.max(image.width, image.height));
    const w = Math.max(1, Math.round(image.width * k));
    const h = Math.max(1, Math.round(image.height * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, problem: 'canvas' };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image.source, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h).data;
    if (visibleShare(pixels) < STAMP_MIN_VISIBLE) return { ok: false, problem: 'empty' };
    const opaque = !hasTransparency(pixels);

    // Dikecilkan bertahap bila hasilnya masih lebih besar dari batas simpan.
    for (const shrink of [1, 0.75, 0.5]) {
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(w * shrink));
      out.height = Math.max(1, Math.round(h * shrink));
      const outCtx = out.getContext('2d');
      if (!outCtx) return { ok: false, problem: 'canvas' };
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(canvas, 0, 0, out.width, out.height);
      const tries = [
        out.toDataURL('image/png'),
        out.toDataURL(opaque ? 'image/jpeg' : 'image/webp', 0.9),
      ];
      const fit = tries.find(
        (u) => u.length <= SIGNATURE_IMAGE_MAX && /^data:image\/(png|jpeg|webp);/.test(u),
      );
      if (fit) return { ok: true, dataUrl: fit };
    }
    return { ok: false, problem: 'big' };
  } finally {
    image.close();
  }
}
