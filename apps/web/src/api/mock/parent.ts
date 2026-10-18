import {
  accuracy,
  certificateNameSchema,
  createChildBodySchema,
  masteryStatus,
  patchChildBodySchema,
  setPinBodySchema,
  suggestTopics,
  WEEK_MS,
  type ChildReport,
  type CreateChildBody,
  type MomoColor,
  type ParentOverview,
  type ParentPlan,
  type Pin,
} from '@udakids/engine';
import { ApiError } from '../client';
import { parentFromToken } from './accounts';
import { renameCertificates } from './certificate';
import {
  BOOKS,
  newId,
  premiumUntilOf,
  readDb,
  topicId,
  writeDb,
  type MockChild,
  type MockDb,
} from './db';
import { findLevel } from './levels';

const notFound = () => new ApiError(404, { code: 'NOT_FOUND', message: 'Anak tidak ketemu.' });

/** Anak milik orang lain dijawab 404, seolah tidak ada. */
function ownChild(token: string | null, childId: string): { db: MockDb; child: MockChild } {
  const parent = parentFromToken(token);
  const db = readDb();
  const child = db.children.find((c) => c.id === childId && c.parentId === parent.id);
  if (!child) throw notFound();
  return { db, child };
}

function finishedRounds(db: MockDb, childId: string) {
  return Object.values(db.rounds).filter((r) => r.childId === childId && r.result);
}

function summary(db: MockDb, child: MockChild) {
  const best = Object.values(db.best[child.id] ?? {});
  const rounds = finishedRounds(db, child.id);
  const until = premiumUntilOf(db, child.id);
  return {
    id: child.id,
    nickname: child.nickname,
    momoColor: child.momoColor,
    hasPin: child.pin !== null,
    totalScore: best.reduce((a, b) => a + b.score, 0),
    levelsPassed: (db.passedLevels[child.id] ?? []).length,
    rounds: rounds.length,
    minutes: Math.round(rounds.reduce((a, r) => a + r.result!.durationMs, 0) / 60_000),
    premiumUntil: until,
  };
}

export async function overview(token: string | null): Promise<ParentOverview> {
  const parent = parentFromToken(token);
  const db = readDb();
  const kids = db.children.filter((c) => c.parentId === parent.id);
  const since = Date.now() - WEEK_MS;

  const weekRounds = kids.flatMap((c) =>
    finishedRounds(db, c.id).filter((r) => (r.finishedAt ?? 0) >= since),
  );
  const passedLevels = new Set(weekRounds.filter((r) => r.result!.passed).map((r) => r.levelId));
  return {
    familyCode: parent.familyCode,
    week: {
      rounds: weekRounds.length,
      levelsPassed: passedLevels.size,
      minutes: Math.round(weekRounds.reduce((a, r) => a + r.result!.durationMs, 0) / 60_000),
      activeChildren: new Set(weekRounds.map((r) => r.childId)).size,
    },
    children: kids.map((c) => summary(db, c)),
  };
}

export async function createChild(token: string | null, body: CreateChildBody) {
  const parent = parentFromToken(token);
  const parsed = createChildBodySchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, { code: 'VALIDATION', message: 'Nama panggilan 2 sampai 20 huruf.' });
  const db = readDb();
  const mine = db.children.filter((c) => c.parentId === parent.id);
  const maxChildren = db.settings.family.maxChildren;
  if (mine.length >= maxChildren)
    throw new ApiError(409, {
      code: 'CONFLICT',
      message: `Satu keluarga maksimal ${maxChildren} anak.`,
      reason: 'child_limit',
    });
  if (mine.some((c) => c.nickname.toLowerCase() === parsed.data.nickname.toLowerCase()))
    throw new ApiError(409, { code: 'CONFLICT', message: 'Nama panggilan ini sudah dipakai.' });

  const child: MockChild = {
    id: newId('c'),
    parentId: parent.id,
    nickname: parsed.data.nickname,
    momoColor: parsed.data.momoColor,
    pin: null,
    failedAttempts: 0,
    lockCount: 0,
    lockedUntil: null,
  };
  db.children.push(child);
  writeDb(db);
  return { id: child.id, nickname: child.nickname, momoColor: child.momoColor, hasPin: false };
}

export async function updateChild(
  token: string | null,
  childId: string,
  body: { nickname?: string; momoColor?: MomoColor },
) {
  const { db, child } = ownChild(token, childId);
  const parsed = patchChildBodySchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, { code: 'VALIDATION', message: 'Nama panggilan 2 sampai 20 huruf.' });
  const { nickname, momoColor } = parsed.data;
  if (
    nickname &&
    db.children.some(
      (c) =>
        c.parentId === child.parentId &&
        c.id !== child.id &&
        c.nickname.toLowerCase() === nickname.toLowerCase(),
    )
  )
    throw new ApiError(409, { code: 'CONFLICT', message: 'Nama panggilan ini sudah dipakai.' });
  if (nickname) child.nickname = nickname;
  if (momoColor) child.momoColor = momoColor;
  // Sertifikat yang memakai nama panggilan ikut berganti nama.
  if (nickname) renameCertificates(db, child);
  writeDb(db);
  return summary(db, child);
}

/**
 * Nama lengkap khusus sertifikat (opsional). Mengisi pertama kali butuh persetujuan orang tua; string kosong
 * menghapus nama dan persetujuannya. Sertifikat yang sudah terbit ikut memakai nama terbaru.
 */
export async function setCertificateName(
  token: string | null,
  childId: string,
  name: string,
  consent: boolean,
): Promise<void> {
  const { db, child } = ownChild(token, childId);
  if (name.trim() === '') {
    child.certificateName = null;
    child.certificateConsentAt = null;
  } else {
    const parsed = certificateNameSchema.safeParse(name);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Nama belum sesuai.';
      throw new ApiError(400, { code: 'VALIDATION', message }, [
        { path: 'certificateName', message },
      ]);
    }
    if (!consent && !child.certificateConsentAt) {
      const message = 'Centang persetujuan menyimpan nama lengkap untuk sertifikat.';
      throw new ApiError(400, { code: 'VALIDATION', message }, [
        { path: 'certificateConsent', message },
      ]);
    }
    child.certificateName = parsed.data;
    child.certificateConsentAt ??= new Date().toISOString();
  }
  renameCertificates(db, child);
  writeDb(db);
}

export async function setPin(token: string | null, childId: string, pin: Pin): Promise<void> {
  const { db, child } = ownChild(token, childId);
  const parsed = setPinBodySchema.safeParse({ pin });
  if (!parsed.success) throw new ApiError(400, { code: 'VALIDATION', message: 'Pilih 3 gambar.' });
  child.pin = parsed.data.pin;
  child.failedAttempts = 0;
  child.lockCount = 0;
  child.lockedUntil = null;
  writeDb(db);
}

export async function deleteChild(token: string | null, childId: string): Promise<void> {
  const { db, child } = ownChild(token, childId);
  db.children = db.children.filter((c) => c.id !== child.id);
  delete db.passedLevels[child.id];
  delete db.mastery[child.id];
  delete db.best[child.id];
  delete db.premiumUntil[child.id];
  delete db.lastLevel[child.id];
  for (const [id, r] of Object.entries(db.rounds)) if (r.childId === child.id) delete db.rounds[id];
  for (const [id, c] of Object.entries(db.certificates))
    if (c.childId === child.id) delete db.certificates[id];
  writeDb(db);
}

/** Laporan satu anak. Dipakai juga oleh admin (laporan yang sama). */
export function buildReport(db: MockDb, child: MockChild): ChildReport {
  // Hanya topik yang sudah pernah dimainkan anak ini.
  const topics = BOOKS.flatMap((b) =>
    b.topics
      .filter((t) => db.mastery[child.id]?.[topicId(b.slug, t.code)] !== undefined)
      .map((t) => {
        const id = topicId(b.slug, t.code);
        const m = db.mastery[child.id]?.[id];
        return {
          topicId: id,
          title: t.title,
          bookTitle: b.title,
          mastery: m?.score ?? 0,
          status: masteryStatus(m?.score ?? 0),
          stage: m?.visibleStage ?? 0,
        };
      }),
  );
  const rounds = finishedRounds(db, child.id).sort(
    (a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0),
  );
  const since = Date.now() - WEEK_MS;
  const weekAnswers = rounds
    .filter((r) => (r.finishedAt ?? 0) >= since)
    .flatMap((r) => Object.values(r.answers));

  return {
    child: { id: child.id, nickname: child.nickname, momoColor: child.momoColor },
    topics,
    weekAccuracy: accuracy(weekAnswers.filter((a) => a.isCorrect).length, weekAnswers.length),
    recentRounds: rounds.slice(0, 5).map((r) => ({
      roundId: r.id,
      levelTitle: findLevel(r.levelId)?.level.title ?? r.levelId,
      score: r.result!.score,
      passed: r.result!.passed,
      finishedAt: new Date(r.finishedAt!).toISOString(),
      durationMs: r.result!.durationMs,
    })),
    suggestions: suggestTopics(
      topics.map((t) => ({ topicId: t.topicId, title: t.title, score: t.mastery })),
    ).map((t) => ({ topicId: t.topicId, title: t.title })),
  };
}

export async function report(token: string | null, childId: string): Promise<ChildReport> {
  const { db, child } = ownChild(token, childId);
  return buildReport(db, child);
}

export async function plan(token: string | null): Promise<ParentPlan> {
  const parent = parentFromToken(token);
  const db = readDb();
  return {
    adminWhatsapp: db.settings.contact.adminWhatsapp,
    children: db.children
      .filter((c) => c.parentId === parent.id)
      .map((c) => {
        const until = premiumUntilOf(db, c.id);
        const active = until !== null;
        return {
          id: c.id,
          nickname: c.nickname,
          plan: active ? ('premium' as const) : ('free' as const),
          until: active ? until! : null,
        };
      }),
  };
}
