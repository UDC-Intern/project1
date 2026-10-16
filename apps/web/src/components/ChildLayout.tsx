import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { profile } from '../api/catalog';
import { useSession } from '../auth/store';
import { OwnMomoLook } from './Momo';
import { useOwnMomo } from '../play/momoStore';
import { TapVoice } from '../play/TapVoice';

/**
 * Pembungkus area anak. Tiap halaman menaruh kepalanya sendiri (kid-top di beranda, PageHead di halaman lain).
 * Tampilan Momo milik anak dimuat sekali di sini dan dipakai oleh `<Momo own />`.
 */
export function ChildLayout() {
  const token = useSession((s) => s.session?.token);
  const look = useOwnMomo((s) => s.look);
  const setOwn = useOwnMomo((s) => s.set);

  useEffect(() => {
    let alive = true;
    profile().then(
      (p) => alive && setOwn(p.momoColor, p.momoLook ?? null),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [token, setOwn]);

  return (
    <OwnMomoLook look={look}>
      <div className="kid-app">
        <TapVoice />
        <Outlet />
      </div>
    </OwnMomoLook>
  );
}
