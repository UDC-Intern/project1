import {
  changePasswordBodySchema,
  confirmEmailBodySchema,
  requestEmailBodySchema,
  updateNameBodySchema,
  type ChangePasswordBody,
  type ParentAccount,
  type Referral,
  type RequestEmailBody,
} from '@udakids/engine';
import { ApiError } from '../client';
import { parentFromToken } from './accounts';
import { readDb, writeDb } from './db';

/** Kode konfirmasi tetap di mode tiruan; server sungguhan mengirimnya lewat email. */
export const MOCK_EMAIL_CODE = '123456';

const fail = (status: number, code: ApiError['body']['code'], message: string) =>
  new ApiError(status, { code, message });

function view(token: string | null): ParentAccount {
  const p = parentFromToken(token);
  return {
    name: p.name,
    email: p.email,
    familyCode: p.familyCode,
    passwordChangedAt: p.passwordChangedAt ?? null,
    pendingEmail: p.pendingEmail ?? null,
  };
}

export async function account(token: string | null): Promise<ParentAccount> {
  return view(token);
}

export async function updateName(token: string | null, name: string): Promise<ParentAccount> {
  const parsed = updateNameBodySchema.safeParse({ name });
  if (!parsed.success) throw fail(400, 'VALIDATION', 'Nama wajib diisi, maksimal 60 huruf.');
  const parent = parentFromToken(token);
  const db = readDb();
  db.parents.find((p) => p.id === parent.id)!.name = parsed.data.name;
  writeDb(db);
  return view(token);
}

export async function changePassword(
  token: string | null,
  body: ChangePasswordBody,
): Promise<ParentAccount> {
  const parent = parentFromToken(token);
  const parsed = changePasswordBodySchema.safeParse(body);
  if (!parsed.success) throw fail(400, 'VALIDATION', 'Password baru minimal 8 karakter.');
  if (parent.password !== parsed.data.currentPassword)
    throw fail(401, 'INVALID_CREDENTIALS', 'Password saat ini belum benar.');
  const db = readDb();
  const row = db.parents.find((p) => p.id === parent.id)!;
  row.password = parsed.data.newPassword;
  row.passwordChangedAt = new Date().toISOString();
  writeDb(db);
  return view(token);
}

export async function requestEmailChange(
  token: string | null,
  body: RequestEmailBody,
): Promise<ParentAccount> {
  const parent = parentFromToken(token);
  const parsed = requestEmailBodySchema.safeParse(body);
  if (!parsed.success) throw fail(400, 'VALIDATION', 'Isi email baru yang benar.');
  if (parent.password !== parsed.data.currentPassword)
    throw fail(401, 'INVALID_CREDENTIALS', 'Password saat ini belum benar.');
  const db = readDb();
  if (parsed.data.email === parent.email)
    throw fail(409, 'CONFLICT', 'Email baru sama dengan email sekarang.');
  if (db.parents.some((p) => p.email === parsed.data.email))
    throw fail(409, 'CONFLICT', 'Email ini sudah dipakai akun lain.');
  db.parents.find((p) => p.id === parent.id)!.pendingEmail = parsed.data.email;
  writeDb(db);
  return view(token);
}

export async function confirmEmailChange(
  token: string | null,
  code: string,
): Promise<ParentAccount> {
  const parent = parentFromToken(token);
  const parsed = confirmEmailBodySchema.safeParse({ code });
  if (!parsed.success || parsed.data.code !== MOCK_EMAIL_CODE)
    throw fail(400, 'VALIDATION', 'Kode belum cocok. Periksa lagi email Anda.');
  if (!parent.pendingEmail) throw fail(409, 'CONFLICT', 'Tidak ada permintaan ganti email.');
  const db = readDb();
  const row = db.parents.find((p) => p.id === parent.id)!;
  row.email = row.pendingEmail!;
  row.pendingEmail = null;
  writeDb(db);
  return view(token);
}

/** Ringkasan ajakan: berapa orang tua mendaftar lewat kode keluarga ini, dan berapa yang sudah membeli paket. */
export async function referral(token: string | null): Promise<Referral> {
  const parent = parentFromToken(token);
  const db = readDb();
  const referred = db.parents.filter((p) => p.referredBy === parent.familyCode);
  const paid = referred.filter((p) =>
    Object.values(db.orders).some((o) => o.parentId === p.id && o.status === 'paid'),
  );
  return { code: parent.familyCode, registered: referred.length, paid: paid.length };
}
