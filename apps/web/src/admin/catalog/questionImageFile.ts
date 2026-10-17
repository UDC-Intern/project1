import { VISUAL_IMAGE_MAX } from '@udakids/engine';
import { decodeImage } from '../content/signatureFile';
import { hasTransparency } from '../content/stampFile';

/** Gambar soal yang diunggah admin: diperiksa, dikecilkan, dan dikodekan ulang supaya muat di data soal. */

export const QUESTION_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'];
export const QUESTION_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
/** Sisi terpanjang gambar yang disimpan (px); di layar anak gambar tampil paling tinggi 180 px, jadi ini sudah tajam. */
export const QUESTION_IMAGE_SIDE = 640;
/** Panjang Data URL yang dituju; di bawah batas skema supaya banyak soal bergambar tetap muat di penyimpanan. */
const TARGET = Math.round(VISUAL_IMAGE_MAX * 0.67);

export type QuestionImageProblem = 'type' | 'size' | 'read' | 'canvas' | 'big';
export type QuestionImageResult =
  { ok: true; dataUrl: string } | { ok: false; problem: QuestionImageProblem };

/**
 * Memproses berkas menjadi Data URL siap simpan: tolak yang bukan PNG, JPG, atau WebP atau yang lebih dari 3 MB;
 * kecilkan ke paling besar 640 px pada sisi terpanjang tanpa mengubah perbandingan; kodekan JPEG (gambar tanpa bagian
 * tembus pandang) atau WebP dan PNG (yang tembus pandang), lalu diperkecil bertahap bila masih terlalu besar.
 */
export async function processQuestionImage(file: File): Promise<QuestionImageResult> {
  if (!QUESTION_IMAGE_MIME.includes(file.type)) return { ok: false, problem: 'type' };
  if (file.size > QUESTION_IMAGE_MAX_BYTES) return { ok: false, problem: 'size' };

  const image = await decodeImage(file);
  if (!image) return { ok: false, problem: 'read' };
  try {
    const k = Math.min(1, QUESTION_IMAGE_SIDE / Math.max(image.width, image.height));
    const w = Math.max(1, Math.round(image.width * k));
    const h = Math.max(1, Math.round(image.height * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { ok: false, problem: 'canvas' };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image.source, 0, 0, w, h);
    const opaque = !hasTransparency(ctx.getImageData(0, 0, w, h).data);

    for (const shrink of [1, 0.75, 0.5, 0.35]) {
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(w * shrink));
      out.height = Math.max(1, Math.round(h * shrink));
      const outCtx = out.getContext('2d');
      if (!outCtx) return { ok: false, problem: 'canvas' };
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(canvas, 0, 0, out.width, out.height);
      // Foto penuh lebih kecil sebagai JPEG; gambar tembus pandang tetap tembus pandang sebagai WebP atau PNG.
      const tries = opaque
        ? [out.toDataURL('image/jpeg', 0.85), out.toDataURL('image/jpeg', 0.7)]
        : [out.toDataURL('image/webp', 0.85), out.toDataURL('image/png')];
      const fit = tries.find(
        (u) => u.length <= TARGET && /^data:image\/(png|jpeg|webp);base64,/.test(u),
      );
      if (fit) return { ok: true, dataUrl: fit };
    }
    return { ok: false, problem: 'big' };
  } finally {
    image.close();
  }
}
