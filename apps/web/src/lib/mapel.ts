import { subjectSlugOf } from '@udakids/engine';

/**
 * Warna mapel di area anak, lewat atribut `data-mapel`: Matematika merah, Sains hijau, mapel lain (Bahasa Inggris,
 * Coding, dan seterusnya) biru. Tiap nilai punya token warna di `styles/uk-tokens.css`.
 */
export type Mapel = 'matematika' | 'sains' | 'umum';

/** Dari nilai `subject` sebuah buku. Belum ada buku (masih memuat) dianggap Matematika. */
export function mapelOf(subject: string | undefined): Mapel {
  if (!subject) return 'matematika';
  const slug = subjectSlugOf(subject);
  return slug === 'matematika' ? 'matematika' : slug === 'sains' ? 'sains' : 'umum';
}

/** Dari alamat buku ("sains-kelas-1") atau id topik/level yang diawali alamat buku. */
export function mapelOfSlug(bookSlug: string): Mapel {
  if (bookSlug.startsWith('matematika-')) return 'matematika';
  if (bookSlug.startsWith('sains-')) return 'sains';
  return 'umum';
}
