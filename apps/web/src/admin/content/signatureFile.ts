import { SIGNATURE_IMAGE_MAX } from '@udakids/engine';
import { clearPaper, fitSize, inkRatio, judgeInk, padBox } from './signature';

/** Foto atau scan tanda tangan yang diunggah admin: diperiksa, dibersihkan latarnya, dipotong, dan dikecilkan. */

export const SIGNATURE_MIME = ['image/png', 'image/jpeg', 'image/webp'];
export const SIGNATURE_MAX_BYTES = 5 * 1024 * 1024;
/** Sisi terpanjang gambar saat dianalisis; foto kamera yang besar dikecilkan dulu supaya pemeriksaan cepat. */
const ANALYSE_MAX = 1000;

/** Alasan berkas ditolak. `empty` dan `dense` datang dari pemeriksaan tinta. */
export type SignatureProblem = 'type' | 'size' | 'read' | 'empty' | 'dense' | 'canvas' | 'big';
export type SignatureResult =
  { ok: true; dataUrl: string } | { ok: false; problem: SignatureProblem };

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Decoded | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    }
  } catch {
    // Jatuh ke elemen gambar di bawah.
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  const loaded = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (!loaded || img.naturalWidth === 0) {
    URL.revokeObjectURL(url);
    return null;
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => URL.revokeObjectURL(url),
  };
}

/**
 * Memproses berkas menjadi PNG transparan siap simpan: tolak yang bukan gambar, terlalu besar, kosong, atau penuh
 * (bukan tanda tangan); lalu latar kertas dijadikan transparan, gambar dipotong rapat ke goresan, dan dikecilkan
 * sampai muat di 700 × 240 px.
 */
export async function processSignatureFile(file: File): Promise<SignatureResult> {
  if (!SIGNATURE_MIME.includes(file.type)) return { ok: false, problem: 'type' };
  if (file.size > SIGNATURE_MAX_BYTES) return { ok: false, problem: 'size' };

  const image = await decode(file);
  if (!image) return { ok: false, problem: 'read' };
  try {
    const k = Math.min(1, ANALYSE_MAX / Math.max(image.width, image.height));
    const w = Math.max(1, Math.round(image.width * k));
    const h = Math.max(1, Math.round(image.height * k));
    const work = document.createElement('canvas');
    work.width = w;
    work.height = h;
    const ctx = work.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, problem: 'canvas' };
    ctx.drawImage(image.source, 0, 0, w, h);

    const pixels = ctx.getImageData(0, 0, w, h);
    const verdict = judgeInk(inkRatio(pixels.data));
    if (verdict !== 'ok') return { ok: false, problem: verdict };

    const box = clearPaper(pixels.data, w, h);
    if (!box) return { ok: false, problem: 'empty' };
    ctx.putImageData(pixels, 0, 0);

    const crop = padBox(box, w, h);
    // Kalau hasilnya masih terlalu besar untuk disimpan, kecilkan bertahap.
    for (const shrink of [1, 0.75, 0.5]) {
      const size = fitSize(crop.w * shrink, crop.h * shrink);
      const out = document.createElement('canvas');
      out.width = size.w;
      out.height = size.h;
      const outCtx = out.getContext('2d');
      if (!outCtx) return { ok: false, problem: 'canvas' };
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(work, crop.x, crop.y, crop.w, crop.h, 0, 0, size.w, size.h);
      const dataUrl = out.toDataURL('image/png');
      if (dataUrl.length <= SIGNATURE_IMAGE_MAX) return { ok: true, dataUrl };
    }
    return { ok: false, problem: 'big' };
  } finally {
    image.close();
  }
}
