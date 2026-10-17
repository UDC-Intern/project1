/**
 * Pengolahan gambar tanda tangan unggahan, tanpa DOM: memeriksa apakah gambar benar-benar berisi goresan tinta dan
 * mengubah latar kertas menjadi transparan. Semua fungsi bekerja pada data piksel RGBA (`ImageData.data`), jadi bisa
 * diuji tanpa kanvas.
 */

/** Ukuran gambar tanda tangan yang disimpan (px): dua kali kanvas tulis 350 × 120, supaya tajam di layar dan cetak. */
export const SIGN_W = 700;
export const SIGN_H = 240;

/** Piksel yang lebih terang dari ini dianggap kertas dan dibuat transparan. */
export const PAPER_BRIGHTNESS = 220;
/** Piksel yang lebih gelap dari ini dihitung sebagai tinta; di antara keduanya menjadi tepi yang setengah transparan. */
export const INK_BRIGHTNESS = 170;
/** Rasio tinta di bawah batas ini berarti gambar kosong; di atas batas berikutnya berarti foto penuh, bukan tanda tangan. */
export const INK_MIN_RATIO = 0.005;
export const INK_MAX_RATIO = 0.7;
/** Piksel yang hampir transparan dianggap latar, apa pun warnanya. */
const MIN_ALPHA = 30;
/** Tinta digelapkan sedikit supaya tegas di atas kertas sertifikat. */
const DEEPEN = 0.45;

export type Box = { x: number; y: number; w: number; h: number };
export type InkVerdict = 'ok' | 'empty' | 'dense';

/** Kecerahan 0 sampai 255 menurut bobot persepsi mata. */
export const brightnessOf = (r: number, g: number, b: number) =>
  (r * 299 + g * 587 + b * 114) / 1000;

/** Perbandingan piksel bertinta (gelap dan tidak transparan) dengan seluruh piksel. `data` berisi RGBA. */
export function inkRatio(data: ArrayLike<number>): number {
  const pixels = Math.floor(data.length / 4);
  if (pixels === 0) return 0;
  let ink = 0;
  for (let i = 0; i < pixels * 4; i += 4) {
    if (data[i + 3]! > 128 && brightnessOf(data[i]!, data[i + 1]!, data[i + 2]!) < INK_BRIGHTNESS)
      ink++;
  }
  return ink / pixels;
}

/** `empty`: terlalu sedikit tinta (kertas kosong); `dense`: terlalu banyak (foto penuh atau gambar gelap). */
export function judgeInk(ratio: number): InkVerdict {
  if (ratio < INK_MIN_RATIO) return 'empty';
  if (ratio > INK_MAX_RATIO) return 'dense';
  return 'ok';
}

/**
 * Mengubah latar kertas menjadi transparan langsung di `data`: piksel terang (kecerahan di atas
 * {@link PAPER_BRIGHTNESS}) atau yang sudah hampir transparan menjadi alpha 0, tepi tinta dilunakkan, dan tinta
 * digelapkan. Mengembalikan kotak yang memuat seluruh tinta, atau null bila tidak ada tinta sama sekali.
 */
export function clearPaper(data: Uint8ClampedArray, width: number, height: number): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3]!;
      const brightness = brightnessOf(data[i]!, data[i + 1]!, data[i + 2]!);
      if (alpha < MIN_ALPHA || brightness > PAPER_BRIGHTNESS) {
        data[i + 3] = 0;
        continue;
      }
      const edge =
        brightness > INK_BRIGHTNESS
          ? (PAPER_BRIGHTNESS - brightness) / (PAPER_BRIGHTNESS - INK_BRIGHTNESS)
          : 1;
      data[i] = Math.round(data[i]! * DEEPEN);
      data[i + 1] = Math.round(data[i + 1]! * DEEPEN);
      data[i + 2] = Math.round(data[i + 2]! * DEEPEN);
      data[i + 3] = Math.round(alpha * edge);
      if (data[i + 3]! > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Kotak tinta diberi ruang kosong di sekelilingnya (`margin` dari sisi terpanjang, paling sedikit 4 px) dan dijaga di dalam gambar. */
export function padBox(box: Box, width: number, height: number, margin = 0.06): Box {
  const pad = Math.max(4, Math.round(Math.max(box.w, box.h) * margin));
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  return {
    x,
    y,
    w: Math.min(width, box.x + box.w + pad) - x,
    h: Math.min(height, box.y + box.h + pad) - y,
  };
}

/** Ukuran paling besar yang muat di `maxW` × `maxH` dengan perbandingan tetap; gambar kecil tidak dibesarkan. */
export function fitSize(
  w: number,
  h: number,
  maxW = SIGN_W,
  maxH = SIGN_H,
): { w: number; h: number } {
  const k = Math.min(1, maxW / w, maxH / h);
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
