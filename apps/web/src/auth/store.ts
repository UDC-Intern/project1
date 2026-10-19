import type { Role } from '@udakids/engine';
import { create } from 'zustand';

export type Session = { token: string; role: Role; name: string; id?: string; familyCode?: string };

const KEY = 'udakids-session-v1';

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

type SessionState = {
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
};

export const useSession = create<SessionState>((set) => ({
  session: load(),
  signIn: (session) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      /* penyimpanan tidak tersedia: sesi hanya hidup selama tab terbuka */
    }
    set({ session });
  },
  signOut: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* diabaikan */
    }
    set({ session: null });
  },
}));

export const HOME_BY_ROLE: Record<Role, string> = {
  child: '/play',
  parent: '/orang-tua',
  admin: '/admin',
};

export const LOGIN_BY_ROLE: Record<Role, string> = {
  child: '/play/masuk',
  parent: '/orang-tua/masuk',
  admin: '/masuk/staf',
};
