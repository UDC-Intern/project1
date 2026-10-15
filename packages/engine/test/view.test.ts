import { describe, expect, it } from 'vitest';
import {
  childProfileSchema,
  childUpdateSchema,
  durationShort,
  durationWords,
  emailChangeConfirmSchema,
  emailChangeRequestSchema,
  formatAverage,
  formatClock,
  momoHex,
  parentProfileSchema,
  parseMomoLook,
  passwordChangeSchema,
} from '../src/index.js';

describe('format tampilan', () => {
  it('jam, durasi singkat, dan durasi kata', () => {
    expect(formatClock(165_000)).toBe('02:45');
    expect(durationShort(3_900_000)).toBe('1 j 5 mnt');
    expect(durationShort(3_600_000)).toBe('1 j');
    expect(durationShort(720_000)).toBe('12 mnt');
    expect(durationShort(40_000)).toBe('40 dtk');
    expect(durationWords(3_900_000)).toBe('1 jam 5 menit');
    expect(durationWords(3_600_000)).toBe('1 jam');
    expect(durationWords(720_000)).toBe('12 menit');
    expect(durationWords(40_000)).toBe('40 detik');
    expect(formatAverage(86.5)).toBe('86,5');
  });
});

describe('skema formulir', () => {
  it('profil anak: nama, warna, dan tepat 3 gambar sandi', () => {
    const ok = childProfileSchema.safeParse({
      nickname: ' Dodi ',
      momoColor: 'blue',
      pin: ['apple', 'ball', 'star'],
    });
    expect(ok.success && ok.data.nickname).toBe('Dodi');
    expect(
      childProfileSchema.safeParse({ nickname: 'D', momoColor: 'blue', pin: ['apple'] }).success,
    ).toBe(false);
    expect(childUpdateSchema.safeParse({ classCode: null }).success).toBe(true);
    expect(childUpdateSchema.safeParse({ nickname: 'x' }).success).toBe(false);
  });

  it('akun orang tua: nama, email, kode, dan password', () => {
    expect(parentProfileSchema.safeParse({ name: '' }).success).toBe(false);
    expect(
      emailChangeRequestSchema.safeParse({ email: 'baru@contoh.id', currentPassword: 'x' }).success,
    ).toBe(true);
    expect(emailChangeConfirmSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(emailChangeConfirmSchema.safeParse({ code: '12' }).success).toBe(false);
    expect(
      passwordChangeSchema.safeParse({ currentPassword: 'a', password: 'pendek' }).success,
    ).toBe(false);
  });
});

describe('tampilan Momo', () => {
  it('warna palet atau hex, data rusak menjadi polos', () => {
    expect(momoHex('biru')).toBe('#4f8ff7');
    expect(momoHex('#AABBCC')).toBeUndefined();
    expect(momoHex('#aabbcc')).toBe('#aabbcc');
    expect(momoHex(null)).toBeUndefined();
    expect(parseMomoLook(null)).toBeNull();
    expect(parseMomoLook({ model: 'tidak-ada' })).toBeNull();
    expect(parseMomoLook({ model: 'kucing', accessory: 'topi' })?.model).toBe('kucing');
  });
});
