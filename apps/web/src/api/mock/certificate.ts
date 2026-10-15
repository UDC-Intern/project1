import { certificateStatus, type Certificate } from '@udakids/engine';
import { ApiError } from '../client';
import { childIdFromToken } from './auth';
import { BOOKS, levelId, readDb } from './db';
import { hasPremium } from './levels';

/** Sertifikat Juara Digital: hanya Premium dan hanya bila semua level di buku itu lulus. */
export async function certificate(token: string | null, bookSlug: string): Promise<Certificate> {
  const childId = childIdFromToken(token);
  const book = BOOKS.find((b) => b.slug === bookSlug);
  if (!book) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Buku tidak ketemu.' });

  const db = readDb();
  const status = certificateStatus({
    bookLevelIds: book.topics.flatMap((t) =>
      t.levels.map((l) => levelId(book.slug, t.code, l.number)),
    ),
    passedLevelIds: db.passedLevels[childId] ?? [],
    hasPremium: hasPremium(childId),
  });
  if (status === 'not_finished')
    throw new ApiError(404, { code: 'NOT_FOUND', message: 'Sertifikat belum tersedia.' });
  if (status === 'premium_required')
    throw new ApiError(403, {
      code: 'PREMIUM_REQUIRED',
      message: 'Sertifikat ini perlu dibuka oleh orang tua.',
    });

  const child = db.children.find((c) => c.id === childId)!;
  return { childName: child.nickname, bookTitle: book.title, issuedAt: new Date().toISOString() };
}
