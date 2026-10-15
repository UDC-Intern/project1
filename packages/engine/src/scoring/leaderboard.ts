export type LeaderboardInput = {
  id: string;
  nickname: string;
  totalScore: number;
  totalMs: number;
};

export type Ranked<T extends LeaderboardInput> = T & { rank: number };

/** Total skor menurun, lalu total waktu lebih cepat, lalu nama panggilan menaik. Peringkat berurutan 1, 2, 3. */
export function rankEntries<T extends LeaderboardInput>(entries: readonly T[]): Ranked<T>[] {
  return [...entries]
    .sort(
      (a, b) =>
        b.totalScore - a.totalScore ||
        a.totalMs - b.totalMs ||
        a.nickname.localeCompare(b.nickname, 'id'),
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/** Banyak ronde "bayangan" pada nilai peringkat tertimbang, dan nilainya (batas lulus). */
export const RATING_PRIOR_ROUNDS = 5;
export const RATING_PRIOR_SCORE = 70;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rata-rata skor ronde dengan dua desimal; 0 bila belum ada ronde. */
export const averageScore = (scoreSum: number, rounds: number): number =>
  rounds > 0 ? round2(scoreSum / rounds) : 0;

/**
 * Nilai peringkat tertimbang: setiap anak dianggap sudah punya beberapa ronde bayangan bernilai batas lulus,
 * jadi satu ronde sempurna tidak otomatis mengalahkan puluhan ronde yang konsisten.
 */
export const ratingScore = (scoreSum: number, rounds: number): number =>
  rounds > 0
    ? round2((scoreSum + RATING_PRIOR_ROUNDS * RATING_PRIOR_SCORE) / (rounds + RATING_PRIOR_ROUNDS))
    : 0;

export type RatingInput = {
  id: string;
  nickname: string;
  scoreSum: number;
  rounds: number;
  timeMs: number;
};

/** Urut: nilai peringkat, rata-rata asli, waktu lebih cepat, ronde lebih banyak. Hanya yang sudah bermain. */
export function rankByRating<T extends RatingInput>(
  rows: readonly T[],
): (T & { average: number; rating: number; rank: number })[] {
  return rows
    .filter((r) => r.rounds > 0)
    .map((r) => ({
      ...r,
      average: averageScore(r.scoreSum, r.rounds),
      rating: ratingScore(r.scoreSum, r.rounds),
    }))
    .sort(
      (a, b) =>
        b.rating - a.rating ||
        b.average - a.average ||
        a.timeMs - b.timeMs ||
        b.rounds - a.rounds ||
        a.nickname.localeCompare(b.nickname, 'id'),
    )
    .map((r, i) => ({ ...r, rank: i + 1 }));
}
