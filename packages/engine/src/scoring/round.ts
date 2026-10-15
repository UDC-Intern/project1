export type RoundRules = { passScore: number; maxWrong: number };

export const DEFAULT_RULES: RoundRules = { passScore: 70, maxWrong: 3 };

/** Skor 0 sampai 100 dari jumlah benar. Lulus bila skor mencapai ambang dan keliru tidak melebihi batas. */
export function scoreRound(
  correct: number,
  wrong: number,
  total: number,
  rules: RoundRules = DEFAULT_RULES,
): { score: number; passed: boolean } {
  const score = total <= 0 ? 0 : Math.round((correct / total) * 100);
  const passed = score >= rules.passScore && wrong <= rules.maxWrong;
  return { score, passed };
}
