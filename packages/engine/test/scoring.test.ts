import { describe, expect, it } from 'vitest';
import {
  initialMastery,
  masteryStatus,
  rankEntries,
  scoreRound,
  stageOf,
  updateMastery,
  type MasteryState,
} from '../src/index.js';

describe('scoreRound', () => {
  it('10 soal: 10 benar 100 lulus, 8 benar 80 lulus, 7 benar 70 lulus, 6 benar 60 tidak lulus', () => {
    expect(scoreRound(10, 0, 10)).toEqual({ score: 100, passed: true });
    expect(scoreRound(8, 2, 10)).toEqual({ score: 80, passed: true });
    expect(scoreRound(7, 3, 10)).toEqual({ score: 70, passed: true });
    expect(scoreRound(6, 4, 10)).toEqual({ score: 60, passed: false });
  });

  it('batas keliru berlaku walau skor cukup, dan skor dibulatkan', () => {
    expect(scoreRound(7, 4, 10).passed).toBe(false);
    expect(scoreRound(2, 1, 3).score).toBe(67);
    expect(scoreRound(0, 0, 0)).toEqual({ score: 0, passed: false });
  });

  it('aturan level bisa diubah', () => {
    expect(scoreRound(5, 0, 5, { passScore: 80, maxWrong: 1 }).passed).toBe(true);
    expect(scoreRound(3, 2, 5, { passScore: 80, maxWrong: 1 }).passed).toBe(false);
  });
});

describe('Skor Jago', () => {
  it('tahap tanaman mengikuti skor', () => {
    expect([0, 29, 30, 59, 60, 99, 100].map(stageOf)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('jawaban tepat menaikkan skor makin pelan dan berhenti di 90 sebelum tantangan', () => {
    let s = initialMastery();
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) {
      s = updateMastery(s, true);
      seen.push(s.score);
      if (s.score >= 90) break;
    }
    expect(seen.slice(0, 4)).toEqual([12, 24, 36, 48]);
    expect(Math.max(...seen)).toBe(90);
  });

  it('tahap yang sudah terlihat tidak pernah turun dan skor tidak di bawah batas bawah', () => {
    let s: MasteryState = { score: 35, visibleStage: 1, challengeCorrect: 0 };
    for (let i = 0; i < 30; i++) s = updateMastery(s, false);
    expect(s.score).toBe(20);
    expect(s.visibleStage).toBe(1);
  });

  it('skor tidak turun di bawah 0', () => {
    let s = initialMastery();
    for (let i = 0; i < 5; i++) s = updateMastery(s, false);
    expect(s.score).toBe(0);
  });

  it('mode tantangan: keliru tidak mengubah apa pun, 3 tepat menjadi 100', () => {
    let s: MasteryState = { score: 90, visibleStage: 2, challengeCorrect: 0 };
    s = updateMastery(s, true);
    s = updateMastery(s, false);
    expect(s).toEqual({ score: 90, visibleStage: 2, challengeCorrect: 1 });
    s = updateMastery(s, true);
    s = updateMastery(s, true);
    expect(s).toEqual({ score: 100, visibleStage: 3, challengeCorrect: 0 });
    expect(updateMastery(s, false)).toEqual(s);
    expect(updateMastery(s, true)).toEqual(s);
  });

  it('status untuk orang tua', () => {
    expect([0, 79, 80, 99, 100].map(masteryStatus)).toEqual([
      'learning',
      'learning',
      'proficient',
      'proficient',
      'mastered',
    ]);
  });
});

describe('rankEntries', () => {
  it('skor tertinggi dulu, seri dipecah waktu lalu nama', () => {
    const ranked = rankEntries([
      { id: 'a', nickname: 'Bima', totalScore: 200, totalMs: 9000 },
      { id: 'b', nickname: 'Ayu', totalScore: 300, totalMs: 20000 },
      { id: 'c', nickname: 'Citra', totalScore: 200, totalMs: 8000 },
      { id: 'd', nickname: 'Adi', totalScore: 200, totalMs: 8000 },
    ]);
    expect(ranked.map((r) => [r.nickname, r.rank])).toEqual([
      ['Ayu', 1],
      ['Adi', 2],
      ['Citra', 3],
      ['Bima', 4],
    ]);
  });
});
