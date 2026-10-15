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
