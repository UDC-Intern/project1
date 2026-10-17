import {
  rankByRating,
  rankEntries,
  type Leaderboard,
  type LeaderboardEntry,
  type LeaderboardMode,
  type LeaderboardTop,
  type MomoColor,
} from '@udakids/engine';
import { childIdFromToken } from './auth';
import { readDb } from './db';

export const BOARD_SIZE = 25;
/** Mulai jumlah anak ini, papan hanya berisi anak sungguhan (mis. data contoh sudah dimuat). */
const MIN_REAL = 10;

/** Anak tiruan supaya papan tidak sepi saat data masih sedikit (tanpa data contoh). */
const FAKES: {
  id: string;
  nickname: string;
  momoColor: MomoColor;
  points: number;
  rounds: number;
  average: number;
  timeMs: number;
}[] = [
  {
    id: 'f1',
    nickname: 'Rara',
    momoColor: 'pink',
    points: 520,
    rounds: 22,
    average: 92,
    timeMs: 1_850_000,
  },
  {
    id: 'f2',
    nickname: 'Dimas',
    momoColor: 'blue',
    points: 480,
    rounds: 20,
    average: 90,
    timeMs: 1_720_000,
  },
  {
    id: 'f3',
    nickname: 'Siti',
    momoColor: 'green',
    points: 450,
    rounds: 18,
    average: 91,
    timeMs: 1_390_000,
  },
  {
    id: 'f4',
    nickname: 'Made',
    momoColor: 'orange',
    points: 410,
    rounds: 17,
    average: 86,
    timeMs: 1_510_000,
  },
  {
    id: 'f5',
    nickname: 'Nia',
    momoColor: 'teal',
    points: 380,
    rounds: 14,
    average: 88,
    timeMs: 1_040_000,
  },
  {
    id: 'f6',
    nickname: 'Fajar',
    momoColor: 'yellow',
    points: 340,
    rounds: 13,
    average: 82,
    timeMs: 1_120_000,
  },
  {
    id: 'f7',
    nickname: 'Putri',
    momoColor: 'pink',
    points: 300,
    rounds: 11,
    average: 85,
    timeMs: 930_000,
  },
  {
    id: 'f8',
    nickname: 'Rafi',
    momoColor: 'blue',
    points: 260,
    rounds: 9,
    average: 80,
    timeMs: 760_000,
  },
  {
    id: 'f9',
    nickname: 'Laras',
    momoColor: 'green',
    points: 220,
    rounds: 8,
    average: 78,
    timeMs: 700_000,
  },
  {
    id: 'f10',
    nickname: 'Komang',
    momoColor: 'orange',
    points: 180,
    rounds: 6,
    average: 74,
    timeMs: 520_000,
  },
  {
    id: 'f11',
    nickname: 'Tika',
    momoColor: 'teal',
    points: 140,
    rounds: 5,
    average: 72,
    timeMs: 410_000,
  },
  {
    id: 'f12',
    nickname: 'Yoga',
    momoColor: 'yellow',
    points: 90,
    rounds: 3,
    average: 70,
    timeMs: 260_000,
  },
];

type Row = {
  id: string;
  nickname: string;
  momoColor: MomoColor;
  points: number;
  rounds: number;
  scoreSum: number;
  timeMs: number;
  bestMs: number;
};

function rows(bookSlug: string | null): Row[] {
  const db = readDb();
  const real: Row[] = db.children.map((c) => {
    const rounds = Object.values(db.rounds).filter(
      (r) => r.childId === c.id && r.result && (!bookSlug || r.levelId.startsWith(`${bookSlug}:`)),
    );
    const best = Object.entries(db.best[c.id] ?? {}).filter(
      ([level]) => !bookSlug || level.startsWith(`${bookSlug}:`),
    );
    return {
      id: c.id,
      nickname: c.nickname,
      momoColor: c.momoColor,
      points: best.reduce((a, [, v]) => a + v.score, 0),
      rounds: rounds.length,
      scoreSum: rounds.reduce((a, r) => a + r.result!.score, 0),
      timeMs: rounds.reduce((a, r) => a + r.result!.durationMs, 0),
      bestMs: best.reduce((a, [, v]) => a + v.ms, 0),
    };
  });
  const factor = bookSlug ? 0.5 : 1;
  const fakes: Row[] = FAKES.map((f) => {
    const rounds = Math.max(1, Math.round(f.rounds * factor));
    return {
      id: f.id,
      nickname: f.nickname,
      momoColor: f.momoColor,
      points: Math.round(f.points * factor),
      rounds,
      scoreSum: f.average * rounds,
      timeMs: Math.round(f.timeMs * factor),
      bestMs: Math.round(f.timeMs * factor * 0.4),
    };
  });
  const played = real.filter((r) => r.rounds > 0);
  return played.length >= MIN_REAL ? played : [...played, ...fakes];
}

function build(mode: Exclude<LeaderboardMode, 'mock'>, bookSlug: string | null) {
  const data = rows(bookSlug);
  if (mode === 'average') {
    return rankByRating(data.map((r) => ({ ...r, timeMs: r.timeMs }))).map((r) => ({
      id: r.id,
      rank: r.rank,
      nickname: r.nickname,
      momoColor: r.momoColor,
      score: r.rating,
      points: r.points,
      average: r.average,
      rounds: r.rounds,
      questions: r.rounds * 10,
      timeMs: r.timeMs,
    }));
  }
  return rankEntries(data.map((r) => ({ ...r, totalScore: r.points, totalMs: r.bestMs }))).map(
    (r) => ({
      id: r.id,
      rank: r.rank,
      nickname: r.nickname,
      momoColor: r.momoColor,
      score: r.points,
      points: r.points,
      average: r.rounds > 0 ? Math.round((r.scoreSum / r.rounds) * 100) / 100 : 0,
      rounds: r.rounds,
      questions: r.rounds * 10,
      timeMs: r.bestMs,
    }),
  );
}

const strip = (
  { id: _id, ...rest }: ReturnType<typeof build>[number],
  isMe: boolean,
): LeaderboardEntry => ({
  ...rest,
  isMe,
});

/** Respons hanya memuat peringkat, nama panggilan, warna Momo, angka, dan penanda "ini kamu". Tanpa id. */
export async function leaderboard(
  token: string | null,
  bookSlug: string | null,
  mode: LeaderboardMode = 'average',
): Promise<Leaderboard> {
  const childId = childIdFromToken(token);
  if (mode === 'mock') return { mode, total: 0, entries: [], me: null };
  const ranked = build(mode, bookSlug);
  const me = ranked.find((e) => e.id === childId);
  return {
    mode,
    total: ranked.length,
    entries: ranked.slice(0, BOARD_SIZE).map((e) => strip(e, e.id === childId)),
    me: me ? strip(me, true) : null,
  };
}

export async function leaderboardTop(mode: 'average' | 'total' = 'total'): Promise<LeaderboardTop> {
  return {
    entries: build(mode, null)
      .slice(0, 10)
      .map((e) => strip(e, false)),
  };
}
