import { useSession } from '../auth/store';
import * as http from './http/leaderboard';
import * as mock from './mock/leaderboard';
import { isMocked } from './mode';

const token = () => useSession.getState().session?.token ?? null;

export const leaderboard = (bookSlug: string | null = null) =>
  isMocked('leaderboard') ? mock.leaderboard(token(), bookSlug) : http.leaderboard(bookSlug);
export const leaderboardTop = () =>
  isMocked('leaderboard') ? mock.leaderboardTop() : http.leaderboardTop();
