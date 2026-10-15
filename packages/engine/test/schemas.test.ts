import { describe, expect, it } from 'vitest';
import {
  answerBodySchema,
  childLoginBodySchema,
  createChildBodySchema,
  premiumBodySchema,
  registerParentBodySchema,
  visualSchema,
} from '../src/index.js';

describe('skema kontrak API', () => {
  it('pendaftaran orang tua wajib centang persetujuan dan kata sandi minimal 8', () => {
    const ok = { name: 'Bu Ani', email: ' ANI@Contoh.id ', password: 'rahasia123', consent: true };
    const parsed = registerParentBodySchema.parse(ok);
    expect(parsed.email).toBe('ani@contoh.id');
    expect(registerParentBodySchema.safeParse({ ...ok, consent: false }).success).toBe(false);
    expect(registerParentBodySchema.safeParse({ ...ok, password: 'pendek' }).success).toBe(false);
  });

  it('nama panggilan anak 2 sampai 20 huruf dan warna Momo dari 6 pilihan', () => {
    expect(createChildBodySchema.safeParse({ nickname: 'Ayu', momoColor: 'blue' }).success).toBe(
      true,
    );
    expect(createChildBodySchema.safeParse({ nickname: 'A', momoColor: 'blue' }).success).toBe(
      false,
    );
    expect(createChildBodySchema.safeParse({ nickname: 'Ayu', momoColor: 'purple' }).success).toBe(
      false,
    );
  });

  it('masuk anak butuh 3 gambar', () => {
    expect(
      childLoginBodySchema.safeParse({ childId: 'x', pin: ['apple', 'star', 'fish'] }).success,
    ).toBe(true);
    expect(childLoginBodySchema.safeParse({ childId: 'x', pin: ['apple', 'star'] }).success).toBe(
      false,
    );
  });

  it('jawaban dipangkas dan tidak boleh kosong', () => {
    expect(answerBodySchema.parse({ questionId: 'q', answer: ' 5 ' }).answer).toBe('5');
    expect(answerBodySchema.safeParse({ questionId: 'q', answer: '  ' }).success).toBe(false);
  });

  it('Premium memakai tanggal ISO dan visual boleh kosong', () => {
    expect(premiumBodySchema.safeParse({ until: '2026-12-31T00:00:00.000Z' }).success).toBe(true);
    expect(premiumBodySchema.safeParse({ until: 'besok' }).success).toBe(false);
    expect(visualSchema.safeParse(null).success).toBe(true);
    expect(visualSchema.safeParse({ item: 'robot', count: 3 }).success).toBe(false);
  });
});
