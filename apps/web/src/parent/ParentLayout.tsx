import { useNavigate } from 'react-router-dom';
import { useSession } from '../auth/store';
import { useT } from '../i18n';
import { AdultLayout } from '../ui/AdultLayout';

export function ParentLayout() {
  const t = useT('parent');
  const signOut = useSession((s) => s.signOut);
  const name = useSession((s) => s.session?.name);
  const navigate = useNavigate();
  return (
    <AdultLayout
      title={name ? `${t('area')}: ${name}` : t('area')}
      items={[
        { to: '/orang-tua', label: t('nav.home'), end: true },
        { to: '/orang-tua/paket', label: t('nav.plan') },
      ]}
      footer={
        <button
          type="button"
          className="uk-btn uk-btn--ghost"
          style={{ marginTop: 'auto' }}
          onClick={() => {
            signOut();
            navigate('/orang-tua/masuk');
          }}
        >
          {t('nav.logout')}
        </button>
      }
    />
  );
}
