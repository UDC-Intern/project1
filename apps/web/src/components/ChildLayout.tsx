import { Outlet } from 'react-router-dom';

/** Pembungkus area anak. Tiap halaman menaruh kepalanya sendiri (kid-top di beranda, PageHead di halaman lain). */
export function ChildLayout() {
  return (
    <div className="kid-app">
      <Outlet />
    </div>
  );
}
