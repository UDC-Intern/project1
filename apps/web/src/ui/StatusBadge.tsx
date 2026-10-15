import type { OrderStatus } from '@udakids/engine';

/** Lencana status pesanan: abu-abu untuk kedaluwarsa dan batal, kuning untuk menunggu, biru untuk diperiksa, hijau selesai. */
export function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return <span className={`status-badge is-${status}`}>{label}</span>;
}
