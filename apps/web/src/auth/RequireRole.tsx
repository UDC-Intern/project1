import type { Role } from '@udakids/engine';
import { Navigate, Outlet } from 'react-router-dom';
import { HOME_BY_ROLE, LOGIN_BY_ROLE, useSession } from './store';

/** Penjagaan untuk kenyamanan saja: yang menentukan tetap API. */
export function RequireRole({ role }: { role: Role }) {
  const session = useSession((s) => s.session);
  if (!session) return <Navigate to={LOGIN_BY_ROLE[role]} replace />;
  if (session.role !== role) return <Navigate to={HOME_BY_ROLE[session.role]} replace />;
  return <Outlet />;
}
