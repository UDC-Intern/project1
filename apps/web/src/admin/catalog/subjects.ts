import { SUBJECT_PRESETS, subjectCodeOf, subjectNameOf, subjectSlugOf } from '@udakids/engine';

export type SubjectOption = { value: string; label: string };

/** Nilai pilihan "tambah mata pelajaran lainnya" di dropdown mapel. */
export const CUSTOM_SUBJECT = '__custom__';

/**
 * Pilihan mapel untuk formulir tambah buku: mapel standar lebih dulu, lalu mapel lain yang sudah punya buku (tanpa
 * duplikat, urut nama). Mapel yang baru ditambahkan admin ikut muncul di sini begitu bukunya ada di katalog, jadi
 * buku berikutnya cukup memilihnya.
 */
export function subjectOptions(books: readonly { subject: string }[]): SubjectOption[] {
  const out = new Map<string, SubjectOption>();
  const option = (stored: string): [string, SubjectOption] => [
    subjectSlugOf(stored),
    { value: subjectCodeOf(stored), label: subjectNameOf(stored) },
  ];

  for (const preset of SUBJECT_PRESETS) {
    const [slug, o] = option(preset);
    out.set(slug, o);
  }

  const extra = new Map<string, SubjectOption>();
  for (const b of books) {
    const [slug, o] = option(b.subject);
    if (slug && !out.has(slug) && !extra.has(slug)) extra.set(slug, o);
  }
  for (const o of [...extra.values()].sort((a, b) => a.label.localeCompare(b.label, 'id')))
    out.set(subjectSlugOf(o.value), o);

  return [...out.values()];
}
