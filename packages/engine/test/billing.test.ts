import { describe, expect, it } from 'vitest';
import {
  FOREVER_ISO,
  billingContentSchema,
  effectiveStatus,
  extendPremium,
  formatRupiah,
  needsAction,
  orderAmounts,
  orderNumber,
  rankByRating,
  ratingScore,
  splitTransfer,
  uniqueCodeFor,
} from '../src/index.js';
import content from '../../../content/billing.json' with { type: 'json' };

const DAY = 24 * 60 * 60 * 1000;

describe('pembayaran', () => {
  it('kode unik 1 sampai 499 dan stabil untuk kunci yang sama', () => {
    for (let i = 0; i < 500; i++) {
      const c = uniqueCodeFor(`pesanan-${i}`);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(499);
    }
    expect(uniqueCodeFor('a')).toBe(uniqueCodeFor('a'));
  });

  it('jumlah transfer = harga + kode unik, dan potongan dihitung dari harga coret', () => {
    expect(orderAmounts(50000, 17500, 93)).toEqual({
      listPrice: 50000,
      discount: 32500,
      price: 17500,
      uniqueCode: 93,
      total: 17593,
    });
    expect(orderAmounts(1000, 2000, 5).discount).toBe(0);
  });

  it('format rupiah dan 3 digit terakhir yang disorot', () => {
    expect(formatRupiah(17500)).toBe('Rp17.500');
    expect(splitTransfer(17593)).toEqual(['Rp17.', '593']);
    expect(splitTransfer(210421)).toEqual(['Rp210.', '421']);
  });

  it('pesanan yang menunggu bayar menjadi kedaluwarsa setelah batas waktu', () => {
    const now = Date.parse('2026-10-15T12:00:00Z');
    const base = { expiresAt: '2026-10-15T11:00:00Z' };
    expect(effectiveStatus({ ...base, status: 'awaiting_payment' }, now)).toBe('expired');
    expect(effectiveStatus({ ...base, status: 'awaiting_review' }, now)).toBe('awaiting_review');
    expect(effectiveStatus({ ...base, status: 'paid' }, now)).toBe('paid');
    expect(
      effectiveStatus({ expiresAt: '2026-10-16T00:00:00Z', status: 'awaiting_payment' }, now),
    ).toBe('awaiting_payment');
  });

  it('hanya menunggu bayar dan bukti ditolak yang butuh tindakan', () => {
    expect(needsAction('awaiting_payment')).toBe(true);
    expect(needsAction('rejected')).toBe(true);
    expect(needsAction('paid')).toBe(false);
    expect(needsAction('expired')).toBe(false);
  });

  it('masa berlaku diperpanjang dari masa berjalan, atau dari sekarang bila habis', () => {
    const now = Date.parse('2026-10-15T00:00:00Z');
    expect(extendPremium(null, 30, now)).toBe(new Date(now + 30 * DAY).toISOString());
    const running = new Date(now + 10 * DAY).toISOString();
    expect(extendPremium(running, 30, now)).toBe(new Date(now + 40 * DAY).toISOString());
    const past = new Date(now - 5 * DAY).toISOString();
    expect(extendPremium(past, 30, now)).toBe(new Date(now + 30 * DAY).toISOString());
    expect(extendPremium(null, null, now)).toBe(FOREVER_ISO);
    expect(extendPremium(FOREVER_ISO, 30, now)).toBe(FOREVER_ISO);
  });

  it('nomor pesanan berformat tetap', () => {
    expect(orderNumber(Date.parse('2026-10-15T00:00:00Z'), 'x')).toMatch(/^UK-261015-[0-9A-Z]{5}$/);
  });

  it('isi content/billing.json lolos skema: 5 paket dan 5 metode', () => {
    const parsed = billingContentSchema.parse(content);
    expect(parsed.packages.map((p) => p.name)).toEqual([
      'Tunas',
      'Kumbang',
      'Tumbuh Bersama',
      'Bintang Kecil',
      'Teman Setia',
    ]);
    expect(parsed.methods.map((m) => m.name)).toEqual([
      'BCA',
      'BNI',
      'CIMB NIAGA',
      'Gopay',
      'ShopeePay',
    ]);
    expect(parsed.packages.every((p) => p.price < p.listPrice)).toBe(true);
    expect(parsed.packages.at(-1)?.durationDays).toBeNull();
  });
});

describe('peringkat tertimbang', () => {
  it('satu ronde sempurna tidak mengalahkan banyak ronde yang konsisten', () => {
    const ranked = rankByRating([
      { id: 'a', nickname: 'Ayu', scoreSum: 100, rounds: 1, timeMs: 1000 },
      { id: 'b', nickname: 'Bima', scoreSum: 90 * 20, rounds: 20, timeMs: 90000 },
      { id: 'c', nickname: 'Citra', scoreSum: 0, rounds: 0, timeMs: 0 },
    ]);
    expect(ranked.map((r) => r.nickname)).toEqual(['Bima', 'Ayu']);
    expect(ranked[0]).toMatchObject({ rank: 1, average: 90 });
    expect(ratingScore(100, 1)).toBeCloseTo(75, 5);
    expect(ratingScore(0, 0)).toBe(0);
  });

  it('seri dipecah rata-rata, lalu waktu, lalu ronde, lalu nama', () => {
    const rows = [
      { id: 'a', nickname: 'Bima', scoreSum: 160, rounds: 2, timeMs: 5000 },
      { id: 'b', nickname: 'Adi', scoreSum: 160, rounds: 2, timeMs: 5000 },
      { id: 'c', nickname: 'Citra', scoreSum: 160, rounds: 2, timeMs: 4000 },
    ];
    expect(rankByRating(rows).map((r) => r.nickname)).toEqual(['Citra', 'Adi', 'Bima']);
  });
});
