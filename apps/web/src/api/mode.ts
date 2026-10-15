import { MOCK_MODULES } from '../config/app';

export type ApiModule =
  'auth' | 'catalog' | 'practice' | 'parent' | 'leaderboard' | 'admin' | 'billing';

/** Modul memakai data tiruan bila VITE_MOCK_MODULES berisi "*" atau nama modulnya. */
export function isMocked(module: ApiModule, setting: string = MOCK_MODULES): boolean {
  const list = setting
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.includes('*') || list.includes(module);
}
