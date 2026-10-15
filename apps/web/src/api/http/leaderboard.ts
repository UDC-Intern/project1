import type { Leaderboard, LeaderboardMode, LeaderboardTop } from '@udakids/engine';
import { request } from '../client';

export const leaderboard = (bookSlug: string | null, mode: LeaderboardMode) => {
  const query = new URLSearchParams({ mode });
  if (bookSlug) query.set('book', bookSlug);
  return request<Leaderboard>(`/leaderboard?${query.toString()}`);
};
export const leaderboardTop = (mode: 'average' | 'total') =>
  request<LeaderboardTop>(`/leaderboard/top?mode=${mode}`);
