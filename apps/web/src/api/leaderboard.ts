import type { LeaderboardMode } from '@udakids/engine';
import { useSession } from '../auth/store';
import * as http from './http/leaderboard';
import * as mock from './mock/leaderboard';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;

export const leaderboard = (bookSlug: string | null = null, mode: LeaderboardMode = 'average') =>
  isMocked('leaderboard')
    ? mock.leaderboard(token(), bookSlug, mode)
    : http.leaderboard(bookSlug, mode);
export const leaderboardTop = (mode: 'average' | 'total' = 'total') =>
  isMocked('leaderboard') ? mock.leaderboardTop(mode) : http.leaderboardTop(mode);
