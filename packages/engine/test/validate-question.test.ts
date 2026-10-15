import { describe, expect, it } from 'vitest';
import { validateQuestion, type QuestionDraft } from '../src/content/validate-question.js';

const choice: QuestionDraft = {
  type: 'choice',
  prompt: 'Ada 3 apel merah dan 2 apel hijau. Berapa semua apelnya?',
  visual: { item: 'apple', groups: [3, 2] },
  options: ['4', '5', '6', '1'],
  answer: '5',
  explanation: 'Hitung semua apel dari satu sampai lima.',
};

describe('validateQuestion', () => {
  it('menerima soal pilihan ganda yang benar', () => {
    expect(validateQuestion(choice)).toEqual({ ok: true, issues: [] });
  });

  it('menerima isian angka dan benar/belum tepat yang sah', () => {
    expect(
      validateQuestion({
        type: 'number',
        prompt: '15 - 6 = ...',
        answer: '9',
        explanation: 'Ambil 5 dulu.',
      }).ok,
    ).toBe(true);
    expect(
      validateQuestion({
        type: 'true_false',
        prompt: 'Ikan hidup di air.',
        options: ['Benar', 'Belum tepat'],
        answer: 'Benar',
        explanation: 'Ikan bernapas dengan insang.',
      }).ok,
    ).toBe(true);
  });

  it('menolak kata salah dan gagal tetapi bukan kata yang hanya mengandung huruf itu', () => {
    const bad = validateQuestion({ ...choice, explanation: 'Jawabanmu salah.' });
    expect(bad.ok).toBe(false);
    expect(validateQuestion({ ...choice, prompt: 'Berapa jumlah kesalahan? Hitung ya.' }).ok).toBe(
      true,
    );
    expect(validateQuestion({ ...choice, options: ['4', 'gagal', '6', '1'] }).ok).toBe(false);
  });

  it('menolak opsi kembar, opsi tanpa jawaban, dan jumlah opsi keliru', () => {
    expect(validateQuestion({ ...choice, options: ['4', '4', '6', '1'] }).ok).toBe(false);
    expect(validateQuestion({ ...choice, options: ['1', '2', '3', '4'] }).ok).toBe(false);
    expect(validateQuestion({ ...choice, options: ['4', '5', '6'] }).ok).toBe(false);
  });

  it('menolak kalimat lebih dari 15 kata dan lebih dari 200 karakter', () => {
    const long =
      'Ayu membeli banyak sekali apel merah di pasar pagi tadi bersama ibunya yang baik hati sekali.';
    expect(validateQuestion({ ...choice, prompt: long }).ok).toBe(false);
    expect(validateQuestion({ ...choice, prompt: 'a. '.repeat(100) }).ok).toBe(false);
    expect(validateQuestion({ ...choice, prompt: '  ' }).ok).toBe(false);
  });

  it('memeriksa isian angka dan benar/belum tepat', () => {
    expect(
      validateQuestion({ type: 'number', prompt: '2 + 2 = ...', answer: 'empat', explanation: 'x' })
        .ok,
    ).toBe(false);
    expect(
      validateQuestion({
        type: 'number',
        prompt: '2 + 2 = ...',
        options: ['4'],
        answer: '4',
        explanation: 'x',
      }).ok,
    ).toBe(false);
    expect(
      validateQuestion({
        type: 'true_false',
        prompt: 'Api itu dingin.',
        options: ['Benar', 'Salah'],
        answer: 'Salah',
        explanation: 'Api itu panas.',
      }).ok,
    ).toBe(false);
  });

  it('meminta petunjuk dan jawaban', () => {
    expect(validateQuestion({ ...choice, explanation: '' }).ok).toBe(false);
    expect(validateQuestion({ ...choice, explanation: null }).ok).toBe(false);
    expect(validateQuestion({ ...choice, answer: ' ' }).ok).toBe(false);
  });

  it('membatasi jumlah objek bergambar', () => {
    expect(validateQuestion({ ...choice, visual: { item: 'apple', count: 7 } }).ok).toBe(true);
    expect(validateQuestion({ ...choice, visual: { item: 'apple', groups: [12, 12] } }).ok).toBe(
      false,
    );
    expect(validateQuestion({ ...choice, visual: { item: 'apple' } }).ok).toBe(false);
  });
});
