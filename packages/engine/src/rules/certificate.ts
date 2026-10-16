export type CertificateCheck = {
  /** Semua id level di satu buku */
  bookLevelIds: readonly string[];
  /** Id level yang pernah lulus */
  passedLevelIds: readonly string[];
  hasPremium: boolean;
};

export type CertificateStatus = 'ready' | 'premium_required' | 'not_finished';

/**
 * Sertifikat Juara Digital: eksklusif Premium, terbit bila semua level di satu buku pernah lulus.
 * Buku tanpa level tidak menghasilkan sertifikat.
 */
export function certificateStatus(c: CertificateCheck): CertificateStatus {
  const passed = new Set(c.passedLevelIds);
  const finished = c.bookLevelIds.length > 0 && c.bookLevelIds.every((id) => passed.has(id));
  if (!finished) return 'not_finished';
  return c.hasPremium ? 'ready' : 'premium_required';
}

/** Jumlah level buku yang sudah lulus (level di luar buku tidak dihitung). */
export function levelsPassedIn(
  bookLevelIds: readonly string[],
  passedLevelIds: readonly string[],
): number {
  const passed = new Set(passedLevelIds);
  return bookLevelIds.filter((id) => passed.has(id)).length;
}

/** Desain bingkai sertifikat. Admin memilih satu sebagai desain yang dipakai saat sertifikat terbit. */
export const CERTIFICATE_DESIGNS = ['klasik', 'gonjong', 'sawah'] as const;
export type CertificateDesign = (typeof CERTIFICATE_DESIGNS)[number];

/** Huruf nomor sertifikat: tanpa I, O, 0, dan 1 supaya tidak tertukar saat dibaca atau diketik. */
export const CERTIFICATE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CERTIFICATE_NUMBER = /^CERT-[A-HJ-NP-Z2-9]{6}$/;

/**
 * Nomor sertifikat "CERT-XXXXXX". `random` mengembalikan angka 0 sampai kurang dari 1: server memakai sumber acak
 * kriptografis, mode tiruan memakai Math.random, test memakai RNG ber-seed. Keunikan diperiksa pemanggil.
 */
export function certificateNumber(random: () => number): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const r = Math.min(Math.max(random(), 0), 0.999999);
    code += CERTIFICATE_ALPHABET[Math.floor(r * CERTIFICATE_ALPHABET.length)];
  }
  return `CERT-${code}`;
}
