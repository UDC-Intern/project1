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
