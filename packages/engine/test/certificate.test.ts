import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/rng.js';
import {
  CERTIFICATE_ALPHABET,
  CERTIFICATE_DESIGNS,
  CERTIFICATE_NUMBER,
  certificateNumber,
  certificateStatus,
  levelsPassedIn,
} from '../src/rules/certificate.js';
import { certificateSchema, roundResultSchema } from '../src/schemas/api.js';

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

describe('levelsPassedIn', () => {
  it('hanya menghitung level milik buku itu', () => {
    expect(levelsPassedIn(['a1', 'a2', 'b1'], ['a1', 'x9', 'b1'])).toBe(2);
    expect(levelsPassedIn([], ['a1'])).toBe(0);
  });
});

describe('certificateNumber', () => {
  it('berbentuk CERT- diikuti 6 huruf tanpa I, O, 0, dan 1', () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const n = certificateNumber(rnd);
      expect(n).toMatch(CERTIFICATE_NUMBER);
      expect(n).not.toMatch(/[IO01]/);
    }
  });

  it('seed yang sama memberi nomor yang sama', () => {
    expect(certificateNumber(mulberry32(42))).toBe(certificateNumber(mulberry32(42)));
  });

  it('angka di luar 0 sampai 1 tetap memberi huruf yang sah', () => {
    expect(certificateNumber(() => 1)).toBe(`CERT-${CERTIFICATE_ALPHABET.at(-1)!.repeat(6)}`);
    expect(certificateNumber(() => -3)).toBe(`CERT-${CERTIFICATE_ALPHABET[0]!.repeat(6)}`);
  });
});

describe('skema sertifikat', () => {
  const cert = {
    id: 'CERT-7KQ2MX',
    childId: 'c-ayu',
    childName: 'Ayu',
    bookSlug: 'matematika-kelas-1',
    bookTitle: 'Matematika Kelas 1',
    topics: 10,
    levels: 40,
    design: CERTIFICATE_DESIGNS[0],
    issuedAt: '2026-10-16T08:00:00.000Z',
    source: 'auto',
  };

  it('menerima sertifikat lengkap dan menolak desain yang tidak dikenal', () => {
    expect(certificateSchema.parse(cert)).toEqual(cert);
    expect(certificateSchema.safeParse({ ...cert, design: 'emas' }).success).toBe(false);
  });

  it('hasil ronde boleh tanpa sertifikat', () => {
    const base = {
      roundId: 'r1',
      levelId: 'b:A:1',
      score: 80,
      correct: 8,
      wrong: 2,
      durationMs: 1000,
      passed: true,
      nextLevel: null,
      plant: { topicId: 'b:A', title: 'A', stageBefore: 0, stageAfter: 1 },
    };
    expect(roundResultSchema.safeParse(base).success).toBe(true);
    expect(
      roundResultSchema.safeParse({
        ...base,
        certificate: { id: cert.id, bookSlug: cert.bookSlug, bookTitle: cert.bookTitle },
      }).success,
    ).toBe(true);
  });
});
