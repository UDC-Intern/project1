import { loginBodySchema, type AuthResult, type LoginBody } from '@udakids/engine';
import { ApiError } from '../client';
import { readDb, type MockAdmin } from './db';

const ADMIN_PREFIX = 'mock-admin:';

/** Hanya admin yang boleh. Token peran lain dijawab 403, tanpa token 401. */
export function adminFromToken(token: string | null | undefined): MockAdmin {
  if (!token) throw new ApiError(401, { code: 'UNAUTHENTICATED', message: 'Silakan masuk dulu.' });
  if (!token.startsWith(ADMIN_PREFIX))
    throw new ApiError(403, { code: 'FORBIDDEN', message: 'Halaman ini untuk admin.' });
  const admin = readDb().admins.find((a) => a.id === token.slice(ADMIN_PREFIX.length));
  if (!admin) throw new ApiError(401, { code: 'UNAUTHENTICATED', message: 'Silakan masuk dulu.' });
  return admin;
}

/** Akun orang tua ditolak di sini, sama seperti di server. */
export async function staffLogin(body: LoginBody): Promise<AuthResult> {
  const parsed = loginBodySchema.safeParse(body);
  const admin = parsed.success
    ? readDb().admins.find(
        (a) => a.email === parsed.data.email && a.password === parsed.data.password,
      )
    : undefined;
  if (!admin)
    throw new ApiError(401, {
      code: 'INVALID_CREDENTIALS',
      message: 'Email atau kata sandi belum cocok.',
    });
  return {
    token: `${ADMIN_PREFIX}${admin.id}`,
    user: { id: admin.id, role: 'admin', name: admin.name, familyCode: null },
  };
}
