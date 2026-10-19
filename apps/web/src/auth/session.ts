import type { Role } from '@udakids/engine';
import { useMemo } from 'react';
import { useSession as useStore, type Session as StoredSession } from './store';

/**
 * Sesi per jenis akun, dibaca dari penyimpanan sesi aplikasi. Halaman area orang tua memakai
 * bentuk ini: token, pengguna, dan kode keluarga yang diingat perangkat.
 */
export type SessionKind = 'staff' | 'parent' | 'child';
export type Session = {
  token: string;
  user: { id: string; role: Role; name: string };
  familyCode?: string;
};

const ROLE: Record<SessionKind, Role> = { staff: 'admin', parent: 'parent', child: 'child' };

const FAMILY_KEY = 'udakids.familyCode';

/** Kode keluarga diingat perangkat agar anak tidak perlu mengetik. */
export function rememberedFamilyCode(): string | null {
  try {
    return localStorage.getItem(FAMILY_KEY);
  } catch {
    return null;
  }
}
export function rememberFamilyCode(code: string | null) {
  try {
    if (code) localStorage.setItem(FAMILY_KEY, code);
    else localStorage.removeItem(FAMILY_KEY);
  } catch {
    /* abaikan */
  }
}

function build(kind: SessionKind, stored: StoredSession | null): Session | null {
  if (!stored || stored.role !== ROLE[kind]) return null;
  const idx = stored.token.indexOf(':');
  const familyCode = kind === 'parent' ? stored.familyCode : undefined;
  return {
    token: stored.token,
    user: {
      id: stored.id ?? (idx >= 0 ? stored.token.slice(idx + 1) : ''),
      role: stored.role,
      name: stored.name,
    },
    ...(familyCode && { familyCode }),
  };
}

export function getSession(kind: SessionKind): Session | null {
  return build(kind, useStore.getState().session);
}

export function setSession(kind: SessionKind, session: Session | null) {
  const store = useStore.getState();
  if (session) {
    store.signIn({
      token: session.token,
      role: ROLE[kind],
      name: session.user.name,
      id: session.user.id,
      ...(kind === 'parent' && session.familyCode ? { familyCode: session.familyCode } : {}),
    });
    if (session.familyCode) rememberFamilyCode(session.familyCode);
  } else if (store.session?.role === ROLE[kind]) {
    store.signOut();
  }
}

export function useSession(kind: SessionKind): Session | null {
  const stored = useStore((s) => s.session);
  return useMemo(() => build(kind, stored), [kind, stored]);
}
