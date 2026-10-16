import {
  CERTIFICATE_DESIGNS,
  certificateNumber,
  certificateStatus,
  levelsPassedIn,
  type AdminCertificates,
  type BookContent,
  type Certificate,
  type CertificateBook,
  type CertificateDesign,
  type ChildCertificates,
  type ClaimCertificateBody,
  type ParentCertificates,
} from '@udakids/engine';
import { ApiError } from '../client';
import { parentFromToken } from './accounts';
import { childIdFromToken } from './auth';
import { BOOKS, gradeOf, levelId, premiumUntilOf, readDb, writeDb, type MockDb } from './db';
import { adminFromToken } from './staff';

/**
 * Sertifikat Juara Digital di mode tiruan. Terbit otomatis saat level terakhir sebuah buku lulus dan Premium aktif.
 * Bila tertunda (mis. Premium tidak aktif saat buku tuntas), anak atau orang tua bisa mengambilnya setelah Premium
 * aktif, dan admin bisa menerbitkannya langsung.
 */

const notFound = (message = 'Sertifikat tidak ketemu.') =>
  new ApiError(404, { code: 'NOT_FOUND', message });

const bookLevelIds = (book: BookContent) =>
  book.topics.flatMap((t) => t.levels.map((l) => levelId(book.slug, t.code, l.number)));

function findBook(slug: string): BookContent {
  const book = BOOKS.find((b) => b.slug === slug);
  if (!book) throw notFound('Buku tidak ketemu.');
  return book;
}

export const certificateOf = (db: MockDb, childId: string, bookSlug: string) =>
  Object.values(db.certificates).find((c) => c.childId === childId && c.bookSlug === bookSlug) ??
  null;

/** Kemajuan satu anak menuju sertifikat satu buku. */
export function bookProgress(db: MockDb, childId: string, book: BookContent): CertificateBook {
  const ids = bookLevelIds(book);
  const passed = db.passedLevels[childId] ?? [];
  const certificate = certificateOf(db, childId, book.slug);
  return {
    bookSlug: book.slug,
    bookTitle: book.title,
    subject: book.subject,
    grade: gradeOf(book.slug),
    topicsTotal: book.topics.length,
    levelsPassed: levelsPassedIn(ids, passed),
    levelsTotal: ids.length,
    design: db.certificateDesign,
    status: certificate
      ? 'issued'
      : certificateStatus({
          bookLevelIds: ids,
          passedLevelIds: passed,
          hasPremium: premiumUntilOf(db, childId) !== null,
        }),
    certificate,
  };
}

const progressOf = (db: MockDb, childId: string) => BOOKS.map((b) => bookProgress(db, childId, b));

/** Membuat sertifikat baru dengan nomor unik. Syarat diperiksa pemanggil; db ditulis pemanggil. */
function issue(
  db: MockDb,
  childId: string,
  book: BookContent,
  source: Certificate['source'],
): Certificate {
  const child = db.children.find((c) => c.id === childId)!;
  let id = certificateNumber(Math.random);
  while (db.certificates[id]) id = certificateNumber(Math.random);
  const cert: Certificate = {
    id,
    childId,
    childName: child.nickname,
    bookSlug: book.slug,
    bookTitle: book.title,
    topics: book.topics.length,
    levels: bookLevelIds(book).length,
    design: db.certificateDesign,
    issuedAt: new Date().toISOString(),
    source,
  };
  db.certificates[id] = cert;
  return cert;
}

/**
 * Dipanggil saat ronde lulus: bila buku level itu baru tuntas dan Premium aktif, sertifikat langsung terbit.
 * Mengembalikan sertifikat baru, atau null. Pemanggil yang menulis db.
 */
export function autoIssue(db: MockDb, childId: string, bookSlug: string): Certificate | null {
  const book = BOOKS.find((b) => b.slug === bookSlug);
  if (!book) return null;
  return bookProgress(db, childId, book).status === 'ready'
    ? issue(db, childId, book, 'auto')
    : null;
}

/** Mengambil sertifikat yang tertunda. Yang sudah terbit dikembalikan apa adanya. */
function claimFor(db: MockDb, childId: string, bookSlug: string): Certificate {
  const book = findBook(bookSlug);
  const progress = bookProgress(db, childId, book);
  if (progress.certificate) return progress.certificate;
  if (progress.status === 'premium_required')
    throw new ApiError(403, {
      code: 'PREMIUM_REQUIRED',
      message: 'Sertifikat ini perlu dibuka oleh orang tua.',
    });
  if (progress.status === 'not_finished')
    throw new ApiError(409, {
      code: 'CONFLICT',
      message: 'Selesaikan semua level di buku ini dulu.',
    });
  const cert = issue(db, childId, book, 'claim');
  writeDb(db);
  return cert;
}

// ---- Anak: identitas dari token ----

export async function myCertificates(token: string | null): Promise<ChildCertificates> {
  const childId = childIdFromToken(token);
  const db = readDb();
  return { hasPremium: premiumUntilOf(db, childId) !== null, books: progressOf(db, childId) };
}

export async function myCertificate(
  token: string | null,
  bookSlug: string,
): Promise<CertificateBook> {
  const childId = childIdFromToken(token);
  return bookProgress(readDb(), childId, findBook(bookSlug));
}

export async function claimCertificate(
  token: string | null,
  bookSlug: string,
): Promise<CertificateBook> {
  const childId = childIdFromToken(token);
  const db = readDb();
  claimFor(db, childId, bookSlug);
  return bookProgress(db, childId, findBook(bookSlug));
}

// ---- Orang tua: hanya anak sendiri ----

export async function parentCertificates(token: string | null): Promise<ParentCertificates> {
  const me = parentFromToken(token);
  const db = readDb();
  return {
    children: db.children
      .filter((c) => c.parentId === me.id)
      .map((c) => ({
        id: c.id,
        nickname: c.nickname,
        momoColor: c.momoColor,
        hasPremium: premiumUntilOf(db, c.id) !== null,
        books: progressOf(db, c.id),
      })),
  };
}

export async function parentCertificate(token: string | null, id: string): Promise<Certificate> {
  const me = parentFromToken(token);
  const db = readDb();
  const cert = db.certificates[id];
  if (!cert || !db.children.some((c) => c.id === cert.childId && c.parentId === me.id))
    throw notFound();
  return cert;
}

export async function parentClaim(
  token: string | null,
  body: ClaimCertificateBody,
): Promise<Certificate> {
  const me = parentFromToken(token);
  const db = readDb();
  if (!db.children.some((c) => c.id === body.childId && c.parentId === me.id))
    throw notFound('Anak tidak ketemu.');
  return claimFor(db, body.childId, body.bookSlug);
}

// ---- Admin ----

/** Waktu ronde lulus terakhir di buku itu: perkiraan kapan buku tuntas. */
function completedAt(db: MockDb, childId: string, bookSlug: string): string | null {
  const last = Object.values(db.rounds)
    .filter(
      (r) =>
        r.childId === childId &&
        r.result?.passed &&
        r.finishedAt &&
        r.levelId.startsWith(`${bookSlug}:`),
    )
    .sort((a, b) => b.finishedAt! - a.finishedAt!)[0];
  return last ? new Date(last.finishedAt!).toISOString() : null;
}

export async function adminCertificates(token: string | null): Promise<AdminCertificates> {
  adminFromToken(token);
  const db = readDb();
  const parentOf = (childId: string) => {
    const child = db.children.find((c) => c.id === childId);
    return db.parents.find((p) => p.id === child?.parentId);
  };
  const candidates: AdminCertificates['candidates'] = [];
  for (const child of db.children) {
    for (const book of BOOKS) {
      const progress = bookProgress(db, child.id, book);
      if (progress.status !== 'ready' && progress.status !== 'premium_required') continue;
      candidates.push({
        childId: child.id,
        childName: child.nickname,
        parentName: parentOf(child.id)?.name ?? '-',
        bookSlug: book.slug,
        bookTitle: book.title,
        hasPremium: progress.status === 'ready',
        completedAt: completedAt(db, child.id, book.slug),
      });
    }
  }
  return {
    design: db.certificateDesign,
    certificates: Object.values(db.certificates)
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      .map((c) => {
        const p = parentOf(c.childId);
        return { ...c, parentName: p?.name ?? '-', parentEmail: p?.email ?? '-' };
      }),
    candidates,
  };
}

/** Admin menerbitkan sertifikat untuk anak yang lulus semua level, walau Premium-nya sedang tidak aktif. */
export async function adminIssue(
  token: string | null,
  body: ClaimCertificateBody,
): Promise<Certificate> {
  adminFromToken(token);
  const db = readDb();
  if (!db.children.some((c) => c.id === body.childId)) throw notFound('Anak tidak ketemu.');
  const book = findBook(body.bookSlug);
  const progress = bookProgress(db, body.childId, book);
  if (progress.certificate)
    throw new ApiError(409, { code: 'CONFLICT', message: 'Sertifikat buku ini sudah terbit.' });
  if (progress.status === 'not_finished')
    throw new ApiError(409, {
      code: 'CONFLICT',
      message: 'Anak ini belum lulus semua level di buku ini.',
    });
  const cert = issue(db, body.childId, book, 'admin');
  writeDb(db);
  return cert;
}

/** Memakai nama panggilan anak saat ini dan desain yang sedang dipakai. Nomor dan tanggal terbit tetap. */
export async function adminRefresh(token: string | null, id: string): Promise<Certificate> {
  adminFromToken(token);
  const db = readDb();
  const cert = db.certificates[id];
  if (!cert) throw notFound();
  const child = db.children.find((c) => c.id === cert.childId);
  if (child) cert.childName = child.nickname;
  cert.design = db.certificateDesign;
  writeDb(db);
  return cert;
}

/** Menghapus sertifikat. Anak yang tetap lulus semua level kembali menjadi kandidat. */
export async function adminDelete(token: string | null, id: string): Promise<void> {
  adminFromToken(token);
  const db = readDb();
  if (!db.certificates[id]) throw notFound();
  delete db.certificates[id];
  writeDb(db);
}

export async function setDesign(
  token: string | null,
  design: CertificateDesign,
): Promise<{ design: CertificateDesign }> {
  adminFromToken(token);
  if (!(CERTIFICATE_DESIGNS as readonly string[]).includes(design))
    throw new ApiError(400, { code: 'VALIDATION', message: 'Desain tidak dikenal.' });
  const db = readDb();
  db.certificateDesign = design;
  writeDb(db);
  return { design };
}
