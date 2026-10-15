/** 83000 ms menjadi "1:23". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Tanggal ISO menjadi "31 Desember 2026" (zona waktu perangkat). */
export function formatDate(iso: string): string {
  if (new Date(iso).getUTCFullYear() >= 9999) return 'selamanya';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Tanggal dan jam singkat, mis. "15 Okt 2026 14.05". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
