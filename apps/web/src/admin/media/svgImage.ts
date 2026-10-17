import { VISUAL_IMAGE_MAX } from '@udakids/engine';

/**
 * SVG di halaman menjadi teks yang berdiri sendiri (untuk diunduh atau dipasang sebagai gambar soal): token warna
 * `var(--…)` dan `currentColor` diganti nilainya, karena di luar halaman keduanya tidak punya nilai. `side` memberi
 * ukuran tetap pada sisi terpanjang (mengikuti `viewBox`) supaya gambar punya ukuran bawaan saat dipasang di `<img>`.
 */
export function svgMarkup(svg: SVGSVGElement, side?: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (side) {
    const [, , w, h] = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
    if (w && h) {
      const k = side / Math.max(w, h);
      clone.setAttribute('width', String(Math.round(w * k)));
      clone.setAttribute('height', String(Math.round(h * k)));
    }
  }
  const page = getComputedStyle(document.documentElement);
  const ink = getComputedStyle(svg).color;
  return clone.outerHTML
    .replace(/var\((--[\w-]+)\)/g, (m, name: string) => page.getPropertyValue(name).trim() || m)
    .replace(/currentColor/g, ink || 'currentColor');
}

/** Teks (UTF-8) menjadi Data URL SVG berkode base64. */
export function svgDataUrl(markup: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(markup)) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

/** Gambar soal dari SVG di halaman; null bila hasilnya lebih besar dari batas simpan gambar soal. */
export function svgToQuestionImage(svg: SVGSVGElement, side = 320): string | null {
  const url = svgDataUrl(svgMarkup(svg, side));
  return url.length <= VISUAL_IMAGE_MAX ? url : null;
}
