import { z } from 'zod';

/**
 * Afiliasi orang tua (D-063): kode referal, bonus ajak teman, komisi langganan 1 tingkat, saldo, dan pencairan.
 * Hanya akun dewasa (orang tua); anak tidak pernah memegang saldo, link, atau rekening. Semua uang = rupiah bulat.
 * Logika murni di sini; penyimpanan, kunci baris, dan alur admin ada di API.
 */

/** Satu akun orang tua maksimal punya 7 anak aktif (D-063). */

/** Huruf kode referal tanpa yang mudah tertukar (0/O, 1/I/L). */
export const REFERRAL_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_LENGTH = 6;
const REFERRAL_RE = new RegExp(`^[${REFERRAL_ALPHABET}]{${REFERRAL_LENGTH}}$`);

/** Rapikan kode yang diketik orang: huruf besar, tanpa spasi/tanda hubung. */
export const normalizeReferralCode = (raw: string) => raw.toUpperCase().replace(/[\s-]+/g, '');
export const isReferralCode = (raw: string) => REFERRAL_RE.test(normalizeReferralCode(raw));

/** Bank & e-wallet tujuan pencairan yang boleh dipilih orang tua (diatur admin). */
export const payoutProviderSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{2,20}$/),
  name: z.string().trim().min(2).max(40),
  kind: z.enum(['bank', 'ewallet']),
});
export type PayoutProvider = z.infer<typeof payoutProviderSchema>;

export const DEFAULT_PAYOUT_PROVIDERS: PayoutProvider[] = [
  { id: 'bca', name: 'BCA', kind: 'bank' },
  { id: 'bri', name: 'BRI', kind: 'bank' },
  { id: 'bni', name: 'BNI', kind: 'bank' },
  { id: 'mandiri', name: 'Mandiri', kind: 'bank' },
  { id: 'bsi', name: 'BSI', kind: 'bank' },
  { id: 'cimb', name: 'CIMB Niaga', kind: 'bank' },
  { id: 'permata', name: 'Permata', kind: 'bank' },
  { id: 'btn', name: 'BTN', kind: 'bank' },
  { id: 'seabank', name: 'SeaBank', kind: 'bank' },
  { id: 'jago', name: 'Bank Jago', kind: 'bank' },
  { id: 'dana', name: 'DANA', kind: 'ewallet' },
  { id: 'gopay', name: 'GoPay', kind: 'ewallet' },
  { id: 'ovo', name: 'OVO', kind: 'ewallet' },
  { id: 'shopeepay', name: 'ShopeePay', kind: 'ewallet' },
];

/** Pengaturan afiliasi (admin). Perubahan hanya berlaku untuk catatan baru; yang lama menyimpan nilainya sendiri. */
export const affiliateSettingsSchema = z
  .strictObject({
    enabled: z.boolean(),
    /** Bonus per teman yang daftar memakai kode dan sudah aktif. */
    signupBonus: z.number().int().min(0).max(1_000_000),
    /** Komisi langganan dalam basis poin (3300 = 33%). */
    commissionBp: z.number().int().min(0).max(9000),
    minPayout: z.number().int().min(1000).max(100_000_000),
    /** Komisi tertahan sekian hari setelah pesanan disetujui. */
    holdDays: z.number().int().min(0).max(60),
    /** Syarat bonus: anak dari teman yang diajak sudah main minimal sekian ronde … */
    qualifyRounds: z.number().int().min(1).max(50),
    /** … dalam sekian hari sejak teman itu daftar; lewat dari itu bonus gugur. */
    qualifyDays: z.number().int().min(1).max(365),
    /** Bonus ajak teman maksimal per bulan per akun (anti akun palsu). 0 = tanpa batas. */
    monthlyBonusCap: z.number().int().min(0).max(10_000),
    /** Pencairan ditahan sekian hari setelah rekening diubah. */
    accountCooldownDays: z.number().int().min(0).max(30),
    providers: z.array(payoutProviderSchema).min(1).max(40),
  })
  .superRefine((s, ctx) => {
    const ids = s.providers.map((p) => p.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'id bank/e-wallet tidak boleh kembar' });
  });
export type AffiliateSettings = z.infer<typeof affiliateSettingsSchema>;

export const DEFAULT_AFFILIATE_SETTINGS: AffiliateSettings = {
  enabled: true,
  signupBonus: 3500,
  commissionBp: 3300,
  minPayout: 15000,
  holdDays: 7,
  qualifyRounds: 3,
  qualifyDays: 30,
  monthlyBonusCap: 20,
  accountCooldownDays: 3,
  providers: DEFAULT_PAYOUT_PROVIDERS,
};

/**
 * Dasar komisi = harga paket yang dibayar, TANPA kode unik transfer (1–499 rupiah yang hanya untuk mencocokkan
 * transfer, D-036).
 */
export const commissionBase = (order: { amount: number; uniqueCode: number }) =>
  Math.max(0, order.amount - order.uniqueCode);

/** Komisi dibulatkan ke bawah ke rupiah penuh. */
export const commissionFor = (base: number, bp: number) =>
  Math.floor((Math.max(0, base) * Math.max(0, bp)) / 10_000);

/** "33%" / "12,5%" dari basis poin. */
export const formatPercentBp = (bp: number) =>
  `${(bp / 100).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;

/** Nama anggota untuk orang lain: "Rizki Syaputra" → "Ri*** Sy***" (UU PDP: tidak ditampilkan utuh). */
export function maskAffiliateName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (words.length === 0) return '***';
  return words
    .map((w) => `${[...w].slice(0, Math.min(2, [...w].length - 1) || 1).join('')}***`)
    .join(' ');
}

const TITLES = new Set([
  'bapak',
  'bpk',
  'pak',
  'ibu',
  'bu',
  'sdr',
  'sdri',
  'tn',
  'ny',
  'nn',
  'mr',
  'mrs',
  'ms',
  'dr',
  'drs',
  'ir',
  'h',
  'hj',
]);
/** Huruf kecil, tanpa tanda baca, gelar, atau spasi ganda. */
export function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !TITLES.has(w))
    .join(' ');
}

/**
 * Nama pemilik rekening cocok dengan nama akun? Sama persis setelah dirapikan, atau semua kata nama akun ada di
 * nama rekening (rekening sering memuat nama lengkap). Tidak cocok → admin wajib memverifikasi manual.
 */
export function payoutNameMatches(accountName: string, holderName: string): boolean {
  const a = normalizePersonName(accountName);
  const h = normalizePersonName(holderName);
  if (!a || !h) return false;
  if (a === h) return true;
  const hw = new Set(h.split(' '));
  const aw = a.split(' ');
  return aw.length >= 2 && aw.every((w) => hw.has(w));
}

/** Nomor rekening/e-wallet: hanya angka, 6–20 digit. */
export const normalizeAccountNumber = (raw: string) => raw.replace(/[\s.-]+/g, '');
export const isAccountNumber = (raw: string) => /^\d{6,20}$/.test(normalizeAccountNumber(raw));
export const maskAccountNumber = (last4: string) => `•••• ${last4}`;

export type PayoutBlock =
  | 'disabled'
  | 'no_account'
  | 'account_unverified'
  | 'cooldown'
  | 'open_request'
  | 'below_minimum'
  | 'over_balance';

/** Boleh mengajukan pencairan sebesar `amount`? Mengembalikan alasan pertama yang menghalangi, atau null. */
export function payoutBlock(input: {
  settings: Pick<AffiliateSettings, 'enabled' | 'minPayout' | 'accountCooldownDays'>;
  available: number;
  amount: number;
  account: { verified: boolean; changedAt: Date } | null;
  openRequest: boolean;
  now: Date;
}): PayoutBlock | null {
  const { settings: s, account } = input;
  if (!s.enabled) return 'disabled';
  if (!account) return 'no_account';
  if (!account.verified) return 'account_unverified';
  if (input.now.getTime() - account.changedAt.getTime() < s.accountCooldownDays * 86_400_000)
    return 'cooldown';
  if (input.openRequest) return 'open_request';
  if (!Number.isInteger(input.amount) || input.amount < s.minPayout) return 'below_minimum';
  if (input.amount > input.available) return 'over_balance';
  return null;
}

/** Jenis catatan di buku besar afiliasi. Jumlah bertanda: + masuk saldo, − keluar. */
export const LEDGER_TYPES = [
  'signup_bonus',
  'commission',
  'payout',
  'payout_return',
  'adjustment',
] as const;
export type LedgerType = (typeof LEDGER_TYPES)[number];
/** pending = tertahan (belum bisa dicairkan); available = masuk saldo; void = gugur/dibatalkan. */
export type LedgerState = 'pending' | 'available' | 'void';

/** Ringkasan saldo dari catatan buku besar. */
export function summarizeLedger(
  entries: readonly { type: string; amount: number; state: string }[],
) {
  let available = 0;
  let pending = 0;
  let earned = 0;
  /** Sudah ditarik: pencairan yang diajukan/dibayar dikurangi yang dikembalikan. */
  let withdrawn = 0;
  for (const e of entries) {
    if (e.state === 'available') available += e.amount;
    if (e.state === 'pending') pending += e.amount;
    if (e.state !== 'void' && (e.type === 'signup_bonus' || e.type === 'commission'))
      earned += e.amount;
    if (e.state === 'available' && (e.type === 'payout' || e.type === 'payout_return'))
      withdrawn -= e.amount;
  }
  return { available, pending, earned, withdrawn };
}

/** Status anggota (teman yang diajak) untuk ditampilkan ke yang mengajak. */
export type MemberStatus = 'unverified' | 'joined' | 'active' | 'subscribed';
export function memberStatus(m: {
  emailVerified: boolean;
  qualified: boolean;
  paidOrders: number;
}): MemberStatus {
  if (m.paidOrders > 0) return 'subscribed';
  if (!m.emailVerified) return 'unverified';
  return m.qualified ? 'active' : 'joined';
}

export const referralInputSchema = z
  .string()
  .trim()
  .max(20)
  .transform(normalizeReferralCode)
  .refine((v) => v === '' || REFERRAL_RE.test(v), 'Kode referal tidak dikenal');

export const payoutAccountInputSchema = z.strictObject({
  providerId: z.string().regex(/^[a-z0-9-]{2,20}$/),
  accountNumber: z
    .string()
    .trim()
    .max(30)
    .transform(normalizeAccountNumber)
    .refine((v) => /^\d{6,20}$/.test(v), 'Nomor rekening/e-wallet harus 6–20 angka'),
  holderName: z.string().trim().min(3).max(80),
  code: z.string().regex(/^\d{6}$/, 'Kode verifikasi 6 angka'),
});
export type PayoutAccountInput = z.infer<typeof payoutAccountInputSchema>;

export const payoutRequestSchema = z.strictObject({
  amount: z.number().int().min(1000).max(100_000_000),
});
