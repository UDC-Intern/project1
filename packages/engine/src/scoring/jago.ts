import type { MasteryStatus, Stage } from '../schemas/domain.js';

export type MasteryState = {
  /** 0 sampai 100 */
  score: number;
  /** Tahap tanaman yang terlihat anak. Tidak pernah turun. */
  visibleStage: Stage;
  /** Jawaban tepat beruntun di mode tantangan (skor ≥ 90), maksimal 3 */
  challengeCorrect: number;
};

export const initialMastery = (): MasteryState => ({
  score: 0,
  visibleStage: 0,
  challengeCorrect: 0,
});

export const CHALLENGE_SCORE = 90;
export const CHALLENGE_NEEDED = 3;

/** Benih (<30), tunas (30 sampai 59), pohon (60 sampai 99), berbuah (100). */
export function stageOf(score: number): Stage {
  if (score >= 100) return 3;
  if (score >= 60) return 2;
  if (score >= 30) return 1;
  return 0;
}

const STAGE_FLOOR: Record<Stage, number> = { 0: 0, 1: 30, 2: 60, 3: 100 };

/**
 * Memperbarui penguasaan topik setelah satu jawaban. Tidak menghukum: tahap yang sudah terlihat tidak turun,
 * dan kekeliruan di mode tantangan tidak mengubah apa pun.
 */
export function updateMastery(state: MasteryState, isCorrect: boolean): MasteryState {
  let { score, challengeCorrect } = state;

  if (score >= 100) {
    // Sudah berbuah: tidak ada yang berubah.
  } else if (score >= CHALLENGE_SCORE) {
    if (isCorrect) {
      challengeCorrect += 1;
      if (challengeCorrect >= CHALLENGE_NEEDED) {
        score = 100;
        challengeCorrect = 0;
      }
    }
  } else if (isCorrect) {
    const gain = score < 40 ? 12 : score < 70 ? 8 : 5;
    score = Math.min(CHALLENGE_SCORE, score + gain);
  } else {
    const floor = Math.max(0, STAGE_FLOOR[state.visibleStage] - 10);
    score = Math.max(score - 4, Math.min(score, floor), 0);
  }

  const visibleStage = Math.max(state.visibleStage, stageOf(score)) as Stage;
  return { score, visibleStage, challengeCorrect };
}

/** Status untuk orang tua dan admin: Belajar (<80), Bisa (80 sampai 99), Jago (100). */
export function masteryStatus(score: number): MasteryStatus {
  if (score >= 100) return 'mastered';
  if (score >= 80) return 'proficient';
  return 'learning';
}
