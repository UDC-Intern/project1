import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminNotification } from '../../api/adminTypes';
import { useApiCall } from '../../auth/useApi';
import { t, type MessageKey } from '../../i18n';

const POLL_MS = 30_000;
const seenKey = (userId: string) => `udakids.admin.notif.seen.${userId}`;
const readSeen = (userId: string) => {
  try {
    return localStorage.getItem(seenKey(userId)) ?? '';
  } catch {
    return '';
  }
};

const KIND_LABEL: Record<AdminNotification['kind'], MessageKey> = {
  parent: 'admin.notif.kind.parent',
  child: 'admin.notif.kind.child',
  order_created: 'admin.notif.kind.order_created',
  order_proof: 'admin.notif.kind.order_proof',
  certificate: 'admin.notif.kind.certificate',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor">
      <path d="M12 3a6 6 0 00-6 6v4l-2 3v1h16v-1l-2-3V9a6 6 0 00-6-6zm-2.5 16a2.5 2.5 0 005 0z" />
    </svg>
  );
}

/**
 * Lonceng notifikasi admin: pendaftaran baru, pesanan, bukti transfer, dan sertifikat terbit. Diperbarui tiap
 * 30 detik. "Sudah dibaca" = waktu terakhir panel dibuka, disimpan di perangkat ini per admin.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const call = useApiCall('staff');
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [seen, setSeen] = useState(() => readSeen(userId));
  const [open, setOpen] = useState(false);
  /** Batas "baru" yang disorot selama panel terbuka (nilai `seen` sebelum dibuka). */
  const [highlight, setHighlight] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      call<{ items: AdminNotification[] }>('/admin/notifications')
        .then((r) => alive && setItems(r.items))
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') void load();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [call]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const unread = items.filter((n) => n.at > seen).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items.length > 0) {
      // Membuka panel = semua dibaca; yang baru tetap disorot selama panel terbuka.
      const latest = items[0]!.at;
      setHighlight(seen);
      setSeen(latest);
      try {
        localStorage.setItem(seenKey(userId), latest);
      } catch {
        /* abaikan */
      }
    }
  }

  return (
    <div className="notif" ref={box}>
      <button
        type="button"
        className="notif-btn"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          unread > 0 ? t('admin.notif.labelUnread', { n: unread }) : t('admin.notif.label')
        }
        onClick={toggle}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="notif-count" aria-hidden>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label={t('admin.notif.title')}>
          <header>
            <strong>{t('admin.notif.title')}</strong>
            <small className="ui-muted">{t('admin.notif.sub')}</small>
          </header>
          {items.length === 0 ? (
            <p className="ui-muted notif-empty">{t('admin.notif.empty')}</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.key} className={`is-${n.kind}${n.at > highlight ? ' is-new' : ''}`}>
                  <Link to={n.href} onClick={() => setOpen(false)}>
                    <span className="notif-kind">{t(KIND_LABEL[n.kind])}</span>
                    <strong>{n.title}</strong>
                    <small>
                      {n.detail}
                      {n.amount !== null && ` · Rp${n.amount.toLocaleString('id-ID')}`}
                    </small>
                    <time dateTime={n.at}>{when(n.at)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
