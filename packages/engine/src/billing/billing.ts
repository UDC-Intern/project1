import { seedFrom } from '../rng.js';

export const UNIQUE_CODE_MAX = 499;
export const ORDER_TTL_MS = 24 * 60 * 60 * 1000;
/** Tanggal berakhir untuk paket "selamanya". */
export const FOREVER_ISO = '9999-12-31T00:00:00.000Z';

export const ORDER_STATUSES = [
  'awaiting_payment',
  'proof_sent',
  'rejected',
  'paid',
  'expired',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Kode unik 1 sampai 499, stabil untuk satu kunci (mis. id pesanan), supaya transfer mudah dicocokkan. */
export function uniqueCodeFor(key: string): number {
  return (seedFrom(key) % UNIQUE_CODE_MAX) + 1;
}

export type OrderAmounts = {
  listPrice: number;
  discount: number;
  price: number;
  uniqueCode: number;
  total: number;
};

export function orderAmounts(listPrice: number, price: number, uniqueCode: number): OrderAmounts {
  return {
    listPrice,
    discount: Math.max(0, listPrice - price),
    price,
    uniqueCode,
    total: price + uniqueCode,
  };
}

/** "17500" menjadi "Rp17.500". */
export function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

/** Total transfer dipecah supaya 3 digit terakhir (kode unik) bisa disorot: 17593 menjadi ["Rp17.", "593"]. */
export function splitTransfer(total: number): [string, string] {
  const text = formatRupiah(total);
  return [text.slice(0, -3), text.slice(-3)];
}

/**
 * Status yang ditampilkan: pesanan yang menunggu pembayaran dan sudah lewat batas waktu menjadi
 * kedaluwarsa. Status lain tidak berubah oleh waktu.
 */
export function effectiveStatus(
  order: { status: OrderStatus; expiresAt: string },
  nowMs: number,
): OrderStatus {
  if (order.status === 'awaiting_payment' && Date.parse(order.expiresAt) <= nowMs) return 'expired';
  return order.status;
}

/** Pesanan yang masih butuh tindakan orang tua (bayar atau kirim bukti ulang). */
export const needsAction = (status: OrderStatus): boolean =>
  status === 'awaiting_payment' || status === 'rejected';

/**
 * Masa berlaku baru setelah pembayaran disetujui: diperpanjang dari masa yang masih berjalan,
 * atau dari sekarang bila sudah habis. `durationDays` null berarti selamanya.
 */
export function extendPremium(
  currentUntil: string | null,
  durationDays: number | null,
  nowMs: number,
): string {
  if (durationDays === null) return FOREVER_ISO;
  if (currentUntil === FOREVER_ISO) return FOREVER_ISO;
  const base = currentUntil && Date.parse(currentUntil) > nowMs ? Date.parse(currentUntil) : nowMs;
  return new Date(base + durationDays * 24 * 60 * 60 * 1000).toISOString();
}

/** Nomor pesanan seperti UK-260115-A1B2C. Hanya untuk tampilan; kunci tetap id. */
export function orderNumber(createdAtMs: number, key: string): string {
  const d = new Date(createdAtMs);
  const date = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const tail = seedFrom(key).toString(36).toUpperCase().padStart(5, '0').slice(-5);
  return `UK-${date}-${tail}`;
}

export const MAX_PROOF_BYTES = 3 * 1024 * 1024;
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
