import { describe, expect, it } from 'vitest';
import { speakableText } from '../src/index.js';

describe('bacaan simbol matematika', () => {
  it('tanda banding dibaca dengan kata bahasa Indonesia', () => {
    expect(speakableText('5 > 3')).toBe('5 lebih dari 3');
    expect(speakableText('2 < 9')).toBe('2 kurang dari 9');
    expect(speakableText('4 = 4')).toBe('4 sama dengan 4');
    expect(speakableText('6 ≠ 7')).toBe('6 tidak sama dengan 7');
    expect(speakableText('6 != 7')).toBe('6 tidak sama dengan 7');
  });

  it('tanda dua huruf didahulukan: >= dan <= tidak pecah menjadi dua kata', () => {
    expect(speakableText('x >= 3')).toBe('x lebih dari atau sama dengan 3');
    expect(speakableText('x ≥ 3')).toBe('x lebih dari atau sama dengan 3');
    expect(speakableText('x <= 3')).toBe('x kurang dari atau sama dengan 3');
    expect(speakableText('x ≤ 3')).toBe('x kurang dari atau sama dengan 3');
  });

  it('simbol operasi: tambah, kurang, kali, bagi', () => {
    expect(speakableText('2 + 3 = 5')).toBe('2 tambah 3 sama dengan 5');
    expect(speakableText('7 - 2')).toBe('7 kurang 2');
    expect(speakableText('7-2')).toBe('7 kurang 2');
    expect(speakableText('7 − 2')).toBe('7 kurang 2');
    expect(speakableText('3 × 4')).toBe('3 kali 4');
    expect(speakableText('3 * 4')).toBe('3 kali 4');
    expect(speakableText('3 x 4')).toBe('3 kali 4');
    expect(speakableText('12 ÷ 4')).toBe('12 bagi 4');
    expect(speakableText('12 : 4')).toBe('12 bagi 4');
    expect(speakableText('12 / 4')).toBe('12 bagi 4');
    expect(speakableText('1,5 + 2,5')).toBe('1,5 tambah 2,5');
  });

  it('soal lengkap dan tanda tanya tetap utuh', () => {
    expect(speakableText('Berapa 15 - 7 = ?')).toBe('Berapa 15 kurang 7 sama dengan ?');
    expect(speakableText('Mana yang benar: 8 > 5 atau 8 < 5?')).toBe(
      'Mana yang benar: 8 lebih dari 5 atau 8 kurang dari 5?',
    );
  });

  it('tanda hubung di kata, tanggal, dan rentang tidak dianggap tanda kurang', () => {
    expect(speakableText('pra-sekolah')).toBe('pra-sekolah');
    expect(speakableText('Kata-kata')).toBe('Kata-kata');
    expect(speakableText('17-10-2026')).toBe('17-10-2026');
    expect(speakableText('1 : 2')).toBe('1 bagi 2');
    expect(speakableText('1/2')).toBe('1/2');
    expect(speakableText('Pukul 10:30')).toBe('Pukul 10:30');
    expect(speakableText('kotak dan x ini')).toBe('kotak dan x ini');
  });

  it('tanpa simbol, teks hanya dirapikan spasinya', () => {
    expect(speakableText('  Halo   Momo  ')).toBe('Halo Momo');
    expect(speakableText('')).toBe('');
    expect(speakableText('Ayo hitung 3 apel')).toBe('Ayo hitung 3 apel');
  });
});
