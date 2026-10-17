/**
 * Teks yang dibacakan untuk anak. Mesin suara peramban (dan nanti layanan suara di server) sering melewatkan simbol
 * matematika, jadi simbol diganti kata bahasa Indonesia sebelum dibacakan: "5 > 3" dibaca "5 lebih dari 3".
 * Teks di layar tidak berubah; hanya bacaannya.
 */

const COMPARE: readonly [RegExp, string][] = [
  [/≥|>=/g, ' lebih dari atau sama dengan '],
  [/≤|<=/g, ' kurang dari atau sama dengan '],
  [/≠|!=/g, ' tidak sama dengan '],
  [/>/g, ' lebih dari '],
  [/</g, ' kurang dari '],
  [/=/g, ' sama dengan '],
];

const NUMBER = String.raw`\d+(?:[.,]\d+)?`;
/** Dua bilangan dengan satu tanda hubung di antaranya ("7-2", "7 - 2"); rantai seperti tanggal "2026-10-17" tidak cocok. */
const MINUS_BETWEEN = new RegExp(String.raw`${NUMBER}(?:\s*-\s*${NUMBER})+`, 'g');

/** Mengganti simbol matematika dengan kata bahasa Indonesia, lalu merapikan spasi. */
export function speakableText(text: string): string {
  let s = text;
  for (const [pattern, words] of COMPARE) s = s.replace(pattern, words);
  s = s
    .replace(/\+/g, ' tambah ')
    .replace(/[×*]/g, ' kali ')
    .replace(/(\d)\s*x\s*(?=\d)/gi, '$1 kali ')
    .replace(/÷/g, ' bagi ')
    .replace(/(\d)\s+[:/]\s+(?=\d)/g, '$1 bagi ')
    .replace(/−/g, ' kurang ')
    // Tanda kurang di antara dua bilangan; kata bertanda hubung ("pra-sekolah") dan tanggal dibiarkan.
    .replace(MINUS_BETWEEN, (m) => (m.split('-').length === 2 ? m.replace('-', ' kurang ') : m))
    .replace(/\s-\s/g, ' kurang ');
  return s.replace(/\s+/g, ' ').trim();
}
