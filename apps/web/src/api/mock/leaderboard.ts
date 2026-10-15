import {
  rankEntries,
  type Leaderboard,
  type LeaderboardTop,
  type MomoColor,
} from '@udakids/engine';
import { childIdFromToken } from './auth';
import { readDb } from './db';

// Anak tiruan supaya papan terlihat ramai di mode demo.
const FAKES: { id: string; nickname: string; momoColor: MomoColor; total: number; ms: number }[] = [
  { id: 'f1', nickname: 'Rara', momoColor: 'pink', total: 520, ms: 410_000 },
  { id: 'f2', nickname: 'Dimas', momoColor: 'blue', total: 480, ms: 520_000 },
  { id: 'f3', nickname: 'Siti', momoColor: 'green', total: 450, ms: 380_000 },
  { id: 'f4', nickname: 'Made', momoColor: 'orange', total: 410, ms: 460_000 },
  { id: 'f5', nickname: 'Nia', momoColor: 'teal', total: 380, ms: 300_000 },
  { id: 'f6', nickname: 'Fajar', momoColor: 'yellow', total: 340, ms: 410_000 },
  { id: 'f7', nickname: 'Putri', momoColor: 'pink', total: 300, ms: 350_000 },
  { id: 'f8', nickname: 'Rafi', momoColor: 'blue', total: 260, ms: 290_000 },
  { id: 'f9', nickname: 'Laras', momoColor: 'green', total: 220, ms: 330_000 },
  { id: 'f10', nickname: 'Komang', momoColor: 'orange', total: 180, ms: 270_000 },
  { id: 'f11', nickname: 'Tika', momoColor: 'teal', total: 140, ms: 240_000 },
  { id: 'f12', nickname: 'Yoga', momoColor: 'yellow', total: 90, ms: 180_000 },
];

function entries(bookSlug: string | null) {
  const db = readDb();
  const real = db.children
    .map((c) => {
      const rows = Object.entries(db.best[c.id] ?? {}).filter(
        ([level]) => !bookSlug || level.startsWith(`${bookSlug}:`),
      );
      return {
        id: c.id,
        nickname: c.nickname,
        momoColor: c.momoColor,
        totalScore: rows.reduce((a, [, v]) => a + v.score, 0),
        totalMs: rows.reduce((a, [, v]) => a + v.ms, 0),
        played: rows.length > 0,
      };
    })
    .filter((e) => e.played);
  const fakes = FAKES.map((f) => ({
    id: f.id,
    nickname: f.nickname,
    momoColor: f.momoColor,
    totalScore: bookSlug ? Math.round(f.total / 2) : f.total,
    totalMs: f.ms,
  }));
  return rankEntries([...real, ...fakes]);
}

/** Respons hanya memuat peringkat, nama panggilan, warna Momo, skor, dan penanda "ini kamu". */
export async function leaderboard(
  token: string | null,
  bookSlug: string | null,
): Promise<Leaderboard> {
  const childId = childIdFromToken(token);
  const ranked = entries(bookSlug);
  const me = ranked.find((e) => e.id === childId);
  return {
    entries: ranked.slice(0, 20).map((e) => ({
      rank: e.rank,
      nickname: e.nickname,
      momoColor: e.momoColor,
      score: e.totalScore,
      isMe: e.id === childId,
    })),
    me: me ? { rank: me.rank, score: me.totalScore } : null,
  };
}

export async function leaderboardTop(): Promise<LeaderboardTop> {
  return {
    entries: entries(null)
      .slice(0, 10)
      .map((e) => ({
        rank: e.rank,
        nickname: e.nickname,
        momoColor: e.momoColor,
        score: e.totalScore,
      })),
  };
}
