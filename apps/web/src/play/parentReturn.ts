import { getSession, setSession, type Session } from '../auth/session';

const KEY = 'udakids:child-from-parent';

export function setParentReturn(value: boolean) {
  try {
    if (value) {
      const parent = getSession('parent');
      if (parent) sessionStorage.setItem(KEY, JSON.stringify(parent));
    } else sessionStorage.removeItem(KEY);
  } catch {
    // Navigasi tetap dapat digunakan ketika penyimpanan browser dibatasi.
  }
}

export function parentReturn(): boolean {
  try {
    const parent = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Session | null;
    return parent?.user.role === 'parent' && !!parent.token;
  } catch {
    return false;
  }
}

/** Pulihkan sesi orang tua di tab yang sama setelah anak selesai atau menekan Back. */
export function restoreParent(): boolean {
  if (!parentReturn()) return false;
  try {
    const parent = JSON.parse(sessionStorage.getItem(KEY)!) as Session;
    setParentReturn(false);
    setSession('parent', parent);
    return true;
  } catch {
    setParentReturn(false);
    return false;
  }
}
