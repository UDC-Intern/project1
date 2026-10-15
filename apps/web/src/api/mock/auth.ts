import {
  PIN_MAX_ATTEMPTS,
  pinLockMs,
  samePin,
  type ChildLoginBody,
  type ChildLoginResult,
  type FamilyProfiles,
} from '@udakids/engine';
import { ApiError } from '../client';
import { readDb, writeDb } from './db';

const TOKEN_PREFIX = 'mock-child:';

export const mockTokenFor = (childId: string) => `${TOKEN_PREFIX}${childId}`;

/** Identitas anak selalu dari token, seperti di server. */
export function childIdFromToken(token: string | null | undefined): string {
  if (!token?.startsWith(TOKEN_PREFIX))
    throw new ApiError(401, { code: 'UNAUTHENTICATED', message: 'Silakan masuk dulu.' });
  const id = token.slice(TOKEN_PREFIX.length);
  if (!readDb().children.some((c) => c.id === id))
    throw new ApiError(401, { code: 'UNAUTHENTICATED', message: 'Silakan masuk dulu.' });
  return id;
}

export async function familyProfiles(code: string): Promise<FamilyProfiles> {
  const db = readDb();
  const parent = db.parents.find((p) => p.familyCode === code.trim().toUpperCase());
  if (!parent)
    throw new ApiError(404, { code: 'NOT_FOUND', message: 'Kode keluarga tidak ketemu.' });
  return {
    profiles: db.children
      .filter((c) => c.parentId === parent.id)
      .map((c) => ({
        id: c.id,
        nickname: c.nickname,
        momoColor: c.momoColor,
        hasPin: c.pin !== null,
      })),
  };
}

export async function childLogin(body: ChildLoginBody): Promise<ChildLoginResult> {
  const db = readDb();
  const child = db.children.find((c) => c.id === body.childId);
  if (!child) throw new ApiError(404, { code: 'NOT_FOUND', message: 'Profil tidak ketemu.' });
  if (!child.pin)
    throw new ApiError(403, { code: 'FORBIDDEN', message: 'Sandi gambar belum diatur.' });

  const now = Date.now();
  if (child.lockedUntil && child.lockedUntil > now)
    throw new ApiError(423, {
      code: 'TEMPORARILY_LOCKED',
      message: 'Istirahat sebentar, ya.',
      lockedUntil: new Date(child.lockedUntil).toISOString(),
    });

  if (!samePin(child.pin, body.pin)) {
    child.failedAttempts += 1;
    if (child.failedAttempts >= PIN_MAX_ATTEMPTS) {
      child.lockCount += 1;
      child.failedAttempts = 0;
      child.lockedUntil = now + pinLockMs(child.lockCount);
      writeDb(db);
      throw new ApiError(423, {
        code: 'TEMPORARILY_LOCKED',
        message: 'Istirahat sebentar, ya.',
        lockedUntil: new Date(child.lockedUntil).toISOString(),
      });
    }
    writeDb(db);
    throw new ApiError(401, {
      code: 'WRONG_PIN',
      message: 'Sandi gambarnya belum pas.',
      attemptsLeft: PIN_MAX_ATTEMPTS - child.failedAttempts,
    });
  }

  child.failedAttempts = 0;
  child.lockCount = 0;
  child.lockedUntil = null;
  writeDb(db);
  return {
    token: mockTokenFor(child.id),
    child: { id: child.id, nickname: child.nickname, momoColor: child.momoColor },
  };
}
