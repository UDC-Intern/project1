import { describe, expect, it } from 'vitest';
import { certificateStatus } from '../src/rules/certificate.js';

describe('certificateStatus', () => {
  const book = ['a1', 'a2', 'b1'];

  it('siap bila semua level lulus dan Premium aktif', () => {
    expect(certificateStatus({ bookLevelIds: book, passedLevelIds: book, hasPremium: true })).toBe(
      'ready',
    );
  });

  it('butuh Premium bila semua lulus tetapi tidak berlangganan', () => {
    expect(certificateStatus({ bookLevelIds: book, passedLevelIds: book, hasPremium: false })).toBe(
      'premium_required',
    );
  });

  it('belum selesai bila ada level yang belum lulus, walau Premium', () => {
    expect(
      certificateStatus({ bookLevelIds: book, passedLevelIds: ['a1', 'a2'], hasPremium: true }),
    ).toBe('not_finished');
  });

  it('buku kosong tidak menghasilkan sertifikat', () => {
    expect(certificateStatus({ bookLevelIds: [], passedLevelIds: [], hasPremium: true })).toBe(
      'not_finished',
    );
  });
});
