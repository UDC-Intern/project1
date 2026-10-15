import type { LevelStatus } from '../schemas/domain.js';

export type LevelStatusInput = {
  number: number;
  /** Anak pernah lulus level ini. */
  passed: boolean;
  /** Anak pernah lulus level sebelumnya di topik yang sama (diabaikan bila number = 1). */
  previousPassed: boolean;
  isFree: boolean;
  /** Langganan aktif: dihitung pemanggil dengan waktu yang dioper dari luar. */
  hasPremium: boolean;
  /** Level sudah punya generator soal. */
  hasGenerator: boolean;
};

/**
 * Urutan sengaja begini: level yang belum punya soal tampil `soon`, level yang urutannya belum sampai tampil
 * `locked` (anak tidak disodori Premium dulu), baru Premium. Server hanya mengizinkan ronde untuk `open` dan `passed`.
 */
export function levelStatus(i: LevelStatusInput): LevelStatus {
  if (!i.hasGenerator) return 'soon';
  if (i.number > 1 && !i.previousPassed) return 'locked';
  if (!i.isFree && !i.hasPremium) return 'premium';
  return i.passed ? 'passed' : 'open';
}
