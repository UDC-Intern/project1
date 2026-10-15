import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/store';
import { useT } from '../i18n';
import { AdultLayout } from '../ui/AdultLayout';

export function AdminLayout() {
  const t = useT('admin');
  const signOut = useSession((s) => s.signOut);
  const navigate = useNavigate();
  return (
    <AdultLayout
      variant="admin"
      title={t('area')}
      items={[
        { to: '/admin', label: t('nav.overview'), end: true },
        { to: '/admin/konten', label: t('nav.content') },
        { to: '/admin/soal', label: t('nav.preview') },
        { to: '/admin/asisten', label: t('nav.assistant') },
        { to: '/admin/pengguna', label: t('nav.users') },
        { to: '/admin/laporan', label: t('nav.reports') },
      ]}
      footer={
        <button
          type="button"
          className="uk-btn uk-btn--ghost"
          style={{ marginTop: 'auto' }}
          onClick={() => {
            signOut();
            navigate('/masuk/staf');
          }}
        >
          {t('nav.logout')}
        </button>
      }
    />
  );
}
