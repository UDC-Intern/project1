import { describe, expect, it } from 'vitest';
import {
  affiliateSettingsSchema,
  commissionBase,
  commissionFor,
  DEFAULT_AFFILIATE_SETTINGS,
  formatPercentBp,
  isReferralCode,
  maskAffiliateName,
  memberStatus,
  normalizeReferralCode,
  payoutAccountInputSchema,
  payoutBlock,
  payoutNameMatches,
  REFERRAL_ALPHABET,
  referralInputSchema,
  summarizeLedger,
} from '../src/index.js';

describe('afiliasi: kode referal', () => {
  it('huruf yang mudah tertukar tidak dipakai; kode diketik bebas lalu dirapikan', () => {
    for (const ch of '01OIL') expect(REFERRAL_ALPHABET).not.toContain(ch);
    expect(normalizeReferralCode(' rzk-7qm ')).toBe('RZK7QM');
    expect(isReferralCode('rzk7qm')).toBe(true);
    expect(isReferralCode('RZK0QM')).toBe(false);
    expect(isReferralCode('RZK7Q')).toBe(false);
    expect(referralInputSchema.parse('')).toBe('');
    expect(referralInputSchema.parse('rzk 7qm')).toBe('RZK7QM');
    expect(referralInputSchema.safeParse('salah!').success).toBe(false);
  });
});

describe('afiliasi: komisi', () => {
  it('33% dari harga paket TANPA kode unik transfer, dibulatkan ke bawah', () => {
    // Paket Rp10.000 + kode unik 111 → transfer Rp10.111; komisi tetap dari Rp10.000.
    expect(commissionBase({ amount: 10_111, uniqueCode: 111 })).toBe(10_000);
    expect(commissionFor(10_000, 3300)).toBe(3300);
    expect(commissionFor(35_000, 3300)).toBe(11_550);
    expect(commissionFor(9_999, 3300)).toBe(3299);
    expect(commissionFor(10_000, 0)).toBe(0);
    expect(formatPercentBp(3300)).toBe('33%');
    expect(formatPercentBp(1250)).toBe('12,5%');
  });

  it('pengaturan bawaan sesuai permintaan: bonus 3.500, komisi 33%, minimal cair 15.000', () => {
    expect(affiliateSettingsSchema.parse(DEFAULT_AFFILIATE_SETTINGS)).toMatchObject({
      signupBonus: 3500,
      commissionBp: 3300,
      minPayout: 15_000,
    });
    expect(
      affiliateSettingsSchema.safeParse({
        ...DEFAULT_AFFILIATE_SETTINGS,
        providers: [
          DEFAULT_AFFILIATE_SETTINGS.providers[0],
          DEFAULT_AFFILIATE_SETTINGS.providers[0],
        ],
      }).success,
    ).toBe(false);
  });
});

describe('afiliasi: privasi & rekening', () => {
  it('nama anggota disamarkan', () => {
    expect(maskAffiliateName('Rizki Syaputra')).toBe('Ri*** Sy***');
    expect(maskAffiliateName('Ani')).toBe('An***');
    expect(maskAffiliateName('A')).toBe('A***');
    expect(maskAffiliateName('  ')).toBe('***');
  });

  it('nama rekening harus cocok dengan nama akun (gelar & tanda baca diabaikan)', () => {
    expect(payoutNameMatches('Rizki Syaputra', 'RIZKI SYAPUTRA')).toBe(true);
    expect(payoutNameMatches('Bapak Rizki Syaputra', 'rizki syaputra')).toBe(true);
    expect(payoutNameMatches('Rizki Syaputra', 'Muhammad Rizki Syaputra')).toBe(true);
    expect(payoutNameMatches('Rizki Syaputra', 'Budi Santoso')).toBe(false);
    // Satu kata saja tidak cukup untuk menganggap cocok sebagian.
    expect(payoutNameMatches('Rizki', 'Rizki Budi')).toBe(false);
    expect(payoutNameMatches('Rizki', 'RIZKI')).toBe(true);
  });

  it('nomor rekening hanya angka 6–20 digit; kode verifikasi wajib', () => {
    const ok = payoutAccountInputSchema.parse({
      providerId: 'bca',
      accountNumber: '123-456 7890',
      holderName: 'Rizki Syaputra',
      code: '123456',
    });
    expect(ok.accountNumber).toBe('1234567890');
    expect(payoutAccountInputSchema.safeParse({ ...ok, accountNumber: '12ab' }).success).toBe(
      false,
    );
    expect(payoutAccountInputSchema.safeParse({ ...ok, code: '12' }).success).toBe(false);
  });
});

describe('afiliasi: pencairan', () => {
  const now = new Date('2026-10-10T00:00:00Z');
  const base = {
    settings: DEFAULT_AFFILIATE_SETTINGS,
    available: 20_000,
    amount: 15_000,
    account: { verified: true, changedAt: new Date('2026-10-01T00:00:00Z') },
    openRequest: false,
    now,
  };

  it('aturan berurutan: rekening → terverifikasi → jeda ganti rekening → satu pengajuan → minimal → saldo', () => {
    expect(payoutBlock(base)).toBeNull();
    expect(payoutBlock({ ...base, settings: { ...base.settings, enabled: false } })).toBe(
      'disabled',
    );
    expect(payoutBlock({ ...base, account: null })).toBe('no_account');
    expect(payoutBlock({ ...base, account: { ...base.account, verified: false } })).toBe(
      'account_unverified',
    );
    expect(
      payoutBlock({
        ...base,
        account: { verified: true, changedAt: new Date('2026-10-09T00:00:00Z') },
      }),
    ).toBe('cooldown');
    expect(payoutBlock({ ...base, openRequest: true })).toBe('open_request');
    expect(payoutBlock({ ...base, amount: 14_999 })).toBe('below_minimum');
    expect(payoutBlock({ ...base, amount: 20_001 })).toBe('over_balance');
    expect(payoutBlock({ ...base, amount: 15_000.5 })).toBe('below_minimum');
  });

  it('ringkasan saldo dari buku besar: tertahan tidak bisa dicairkan, gugur tidak dihitung', () => {
    const s = summarizeLedger([
      { type: 'signup_bonus', amount: 3500, state: 'available' },
      { type: 'signup_bonus', amount: 3500, state: 'pending' },
      { type: 'signup_bonus', amount: 3500, state: 'void' },
      { type: 'commission', amount: 11_550, state: 'available' },
      { type: 'commission', amount: 3300, state: 'pending' },
      { type: 'payout', amount: -15_000, state: 'available' },
      { type: 'payout_return', amount: 15_000, state: 'available' },
      { type: 'payout', amount: -15_000, state: 'available' },
      { type: 'adjustment', amount: -50, state: 'available' },
    ]);
    expect(s).toEqual({ available: 0, pending: 6800, earned: 21_850, withdrawn: 15_000 });
  });

  it('status anggota', () => {
    expect(memberStatus({ emailVerified: false, qualified: false, paidOrders: 0 })).toBe(
      'unverified',
    );
    expect(memberStatus({ emailVerified: true, qualified: false, paidOrders: 0 })).toBe('joined');
    expect(memberStatus({ emailVerified: true, qualified: true, paidOrders: 0 })).toBe('active');
    expect(memberStatus({ emailVerified: true, qualified: true, paidOrders: 2 })).toBe(
      'subscribed',
    );
  });
});
