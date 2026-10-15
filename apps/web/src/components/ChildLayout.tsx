import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../auth/store';
import { APP_NAME } from '../config/app';
import { useT } from '../i18n';
import { BookIcon, TrophyIcon, UserIcon } from './Icons';
import { Momo } from './Momo';

/** Bilah atas tipis, konten maksimal 960 px, dan 3 tombol navigasi besar di bawah. */
export function ChildLayout() {
  const t = useT('play');
  const name = useSession((s) => s.session?.name);
  return (
    <div className="uk-child-layout">
      <header className="uk-child-top">
        <Momo size={40} />
        <strong>{name ?? APP_NAME}</strong>
      </header>
      <main className="uk-child-main">
        <Outlet />
      </main>
      <nav className="uk-child-nav" aria-label={APP_NAME}>
        <NavLink to="/play" end>
          <BookIcon size={28} />
          {t('nav.learn')}
        </NavLink>
        <NavLink to="/play/peringkat">
          <TrophyIcon size={28} />
          {t('nav.rank')}
        </NavLink>
        <NavLink to="/play/profil">
          <UserIcon size={28} />
          {t('nav.profile')}
        </NavLink>
      </nav>
    </div>
  );
}
