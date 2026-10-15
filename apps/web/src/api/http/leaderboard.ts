import type { Leaderboard, LeaderboardTop } from '@udakids/engine';
import { request } from '../client';

export const leaderboard = (bookSlug: string | null) =>
  request<Leaderboard>(`/leaderboard${bookSlug ? `?book=${encodeURIComponent(bookSlug)}` : ''}`);
export const leaderboardTop = () => request<LeaderboardTop>('/leaderboard/top');
