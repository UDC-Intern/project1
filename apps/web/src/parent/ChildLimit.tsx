import { useNavigate } from 'react-router-dom';
import { MAX_CHILDREN_PER_PARENT } from '@udakids/engine';
import { ApiError } from '../api/client';
import { setSession } from '../auth/session';
import { t } from '../i18n';
import { Button, Dialog } from '../ui/ui';

/** Server menolak karena akun sudah mencapai batas anak aktif: `{ reason: 'child_limit' }`. */
export const isChildLimitError = (err: unknown) =>
  err instanceof ApiError && err.body.reason === 'child_limit';

export const atChildLimit = (count: number) => count >= MAX_CHILDREN_PER_PARENT;

/** "2 dari 3 anak terdaftar" — info batas yang selalu terlihat di dasbor. */
export function ChildCount({ count, className }: { count: number; className?: string }) {
  const n = MAX_CHILDREN_PER_PARENT;
  return (
    <p className={className ?? 'ui-muted'} data-testid="child-count">
      {t(atChildLimit(count) ? 'parent.limit.countFull' : 'parent.limit.count', { count, n })}
    </p>
  );
}

/**
 * Pop-up saat akun sudah mencapai batas anak: anak berikutnya tidak bisa ditambahkan/ditautkan, jadi orang tua diarahkan
 * membuat akun orang tua terpisah (email lain). Tombol utama keluar dari sesi orang tua lalu membuka daftar.
 */
export function ChildLimitDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const n = MAX_CHILDREN_PER_PARENT;
  return (
    <Dialog
      open={open}
      tone="warning"
      onClose={onClose}
      title={t('parent.limit.title', { n })}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('parent.limit.ok')}
          </Button>
          <Button
            onClick={() => {
              // Hanya sesi orang tua; sesi anak dan kode keluarga di perangkat ini tetap.
              setSession('parent', null);
              navigate('/orang-tua/daftar', { replace: true });
            }}
          >
            {t('parent.limit.newAccount')}
          </Button>
        </>
      }
    >
      <p>{t('parent.limit.body', { n, next: n + 1 })}</p>
      <p>{t('parent.limit.how', { n })}</p>
    </Dialog>
  );
}
