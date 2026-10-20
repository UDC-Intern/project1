import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { errorMessage } from '../api/client';
import { t } from '../i18n';
import { Badge, Button, Dialog as UiDialog, formatDate, Notice, Spinner } from '../ui/ui';

/** Nilai yang baru berubah setelah `ms` tanpa perubahan (untuk pencarian sambil mengetik). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return out;
}

/** Jalankan aksi API dengan status sibuk serta pesan galat atau berhasil. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<unknown>();
  const [done, setDone] = useState<string>();
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
      if (busyRef.current) return undefined;
      busyRef.current = true;
      setBusy(true);
      setError(undefined);
      setDone(undefined);
      try {
        const out = await fn();
        if (success) setDone(success);
        return out;
      } catch (err) {
        setError(err);
        return undefined;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [],
  );
  return { busy, error, done, run };
}

export function ActionNotice({ error, done }: { error?: unknown; done?: string }) {
  if (error) return <Notice tone="error">{errorMessage(error)}</Notice>;
  if (done) return <Notice tone="success">{done}</Notice>;
  return null;
}

/** Keadaan muat standar untuk useFetch. */
export function Loadable({
  loading,
  error,
  hasData,
  children,
}: {
  loading: boolean;
  error: unknown;
  hasData: boolean;
  children: () => ReactNode;
}) {
  if (error) return <Notice tone="error">{errorMessage(error)}</Notice>;
  if (!hasData && loading) return <Spinner label={t('admin.loading')} />;
  if (!hasData) return null;
  return <>{children()}</>;
}

export type ChipTone = 'neutral' | 'warning' | 'success' | 'danger' | 'info' | 'muted';

/**
 * Chip saring status dengan jumlah berbentuk kapsul. `tone` memberi warna status yang lembut (sama dengan badge di
 * daftarnya); tanpa `tone`, chip aktif memakai warna utama.
 */
export function FilterChips<K extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  items: readonly { key: K; label: string; count?: number; tone?: ChipTone }[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div
      className={`dir-tabs${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={label}
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={value === it.key}
          className={`ins-chip${it.tone ? ` ins-chip--${it.tone}` : ''}${value === it.key ? ' is-on' : ''}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
          {/* Spasi supaya pembaca layar menyebut "Disetujui 18", bukan "Disetujui18". */}
          {it.count !== undefined && (
            <>
              {' '}
              <span className="dir-count">{it.count.toLocaleString('id-ID')}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Tombol aksi di satu baris tabel atau kartu. Tiap tombol menempati "slot" selebar angka di `slots` (piksel),
 * jadi tombol yang sama selalu jatuh di kolom yang sama di setiap baris, apa pun panjang tulisannya. Slot yang
 * tidak dipakai di satu baris diisi `<RowGap />` supaya tombol sesudahnya tidak bergeser.
 */
export function RowActions({
  slots,
  children,
  label,
}: {
  slots: readonly number[];
  children: ReactNode;
  /** Nama kelompok untuk pembaca layar, mis. "Aksi untuk Ayu". */
  label?: string;
}) {
  return (
    <div
      className="adm-row-actions"
      role={label ? 'group' : undefined}
      aria-label={label}
      style={{ '--slots': slots.map((w) => `${w}px`).join(' ') } as CSSProperties}
    >
      {children}
    </div>
  );
}

/** Slot kosong di `RowActions`. */
export const RowGap = () => <span className="adm-row-gap" aria-hidden />;

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success">{t('admin.user.active')}</Badge>
  ) : (
    <Badge tone="muted">{t('admin.user.inactive')}</Badge>
  );
}

/** Titik warna Momo milik anak. */
export function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="adm-dot"
      style={{ background: `var(--uk-momo-${color}, var(--garis-tegas))` }}
      aria-hidden
    />
  );
}

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  back: 'M15 18l-6-6 6-6',
  check: 'M5 12l5 5 9-10',
  chevron: 'M9 6l6 6-6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z',
} as const;

/** Ikon garis sederhana (tanpa emoji). */
export function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export const childReportPath = (id: string) => `/admin/laporan/anak/${encodeURIComponent(id)}`;

/**
 * Konfirmasi bergaya (pop-up, bukan kotak bawaan peramban) sebelum menghapus atau mengosongkan sesuatu.
 * Dua pilihan jelas (ya atau tidak); tombol "ya" berwarna merah lembut. Esc, ketuk di luar kotak, atau tombol
 * "tidak" menutup tanpa melakukan apa-apa.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <UiDialog
      open={open}
      title={title}
      tone="warning"
      onClose={onCancel}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel ?? t('admin.cancel')}
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </UiDialog>
  );
}

export type AskOptions = {
  title: string;
  message: ReactNode;
  /** Teks tombol "ya"; bawaannya "Ya, lanjutkan". */
  confirmLabel?: string;
  /** Teks tombol "tidak"; bawaannya "Tidak". */
  cancelLabel?: string;
};

/**
 * Tanya dulu sebelum aksi yang tidak bisa dibatalkan, lewat pop-up bergaya aplikasi (bukan `window.confirm`):
 * `if (!(await ask({ title, message }))) return;`. Render `dialog` sekali di komponen. Pertanyaan baru menutup
 * yang masih terbuka (dijawab "tidak"), begitu pula saat komponen dilepas.
 */
export function useConfirm() {
  const [pending, setPending] = useState<AskOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setPending(null);
    resolve?.(ok);
  }, []);

  const ask = useCallback(
    (options: AskOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setPending(options);
      }),
    [],
  );

  useEffect(
    () => () => {
      resolver.current?.(false);
      resolver.current = null;
    },
    [],
  );

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ''}
      message={pending?.message}
      confirmLabel={pending?.confirmLabel ?? t('admin.confirmYes')}
      cancelLabel={pending?.cancelLabel ?? t('admin.confirmNo')}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );
  return { ask, dialog };
}

export const percent = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${Math.round(v)}%`;

export const lastSeen = (v: string | null) =>
  v ? t('admin.family.lastActive', { date: formatDate(v) }) : t('admin.dir.neverPlayed');

/** Pesanan berubah (disetujui atau ditolak): lencana jumlah menunggu di menu dimuat ulang. */
export const ORDERS_CHANGED = 'udakids:admin-orders-changed';
export const notifyOrdersChanged = () => {
  try {
    window.dispatchEvent(new Event(ORDERS_CHANGED));
  } catch {
    /* tanpa window */
  }
};
