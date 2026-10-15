import {
  loginBodySchema,
  registerParentBodySchema,
  type AuthResult,
  type LoginBody,
  type RegisterParentBody,
} from '@udakids/engine';
import { ApiError } from '../client';
import { newId, readDb, writeDb, type MockParent } from './db';

const PARENT_PREFIX = 'mock-parent:';
export const parentTokenFor = (id: string) => `${PARENT_PREFIX}${id}`;

/** Identitas orang tua selalu dari token, seperti di server. */
export function parentFromToken(token: string | null | undefined): MockParent {
  const id = token?.startsWith(PARENT_PREFIX) ? token.slice(PARENT_PREFIX.length) : null;
  const parent = readDb().parents.find((p) => p.id === id);
  if (!parent) throw new ApiError(401, { code: 'UNAUTHENTICATED', message: 'Silakan masuk dulu.' });
  return parent;
}

// Huruf A sampai Z tanpa I dan O, supaya tidak tertukar dengan angka 1 dan 0.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function newFamilyCode(used: Set<string>): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 6; i++) code += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    if (!used.has(code)) return code;
  }
}

function authResult(parent: MockParent): AuthResult {
  return {
    token: parentTokenFor(parent.id),
    user: { id: parent.id, role: 'parent', name: parent.name, familyCode: parent.familyCode },
  };
}

export async function parentRegister(body: RegisterParentBody): Promise<AuthResult> {
  const parsed = registerParentBodySchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(400, {
      code: 'VALIDATION',
      message: 'Periksa lagi isian dan centang persetujuannya.',
    });
  const db = readDb();
  const { name, email, password } = parsed.data;
  if (db.parents.some((p) => p.email === email))
    throw new ApiError(409, { code: 'CONFLICT', message: 'Email ini sudah terdaftar.' });

  const parent: MockParent = {
    id: newId('p'),
    name,
    email,
    password,
    familyCode: newFamilyCode(new Set(db.parents.map((p) => p.familyCode))),
  };
  db.parents.push(parent);
  writeDb(db);
  return authResult(parent);
}

export async function parentLogin(body: LoginBody): Promise<AuthResult> {
  const parsed = loginBodySchema.safeParse(body);
  const parent = parsed.success
    ? readDb().parents.find(
        (p) => p.email === parsed.data.email && p.password === parsed.data.password,
      )
    : undefined;
  if (!parent)
    throw new ApiError(401, {
      code: 'INVALID_CREDENTIALS',
      message: 'Email atau kata sandi belum cocok.',
    });
  return authResult(parent);
}
