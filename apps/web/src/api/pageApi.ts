import { request } from './client';
import * as adminRoutes from './mock/adminRoutes';
import * as parentRoutes from './mock/parentRoutes';
import { isMocked } from './mode';

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

/**
 * Panggilan data halaman area orang tua dan panel admin. Di mode tiruan dijawab dari penyimpanan peramban
 * (alamat `/admin/...` oleh modul admin, selain itu oleh modul orang tua), selain itu diteruskan ke server.
 */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  const body = opts.body as Record<string, unknown> | undefined;
  const token = opts.token ?? null;
  if (path.startsWith('/admin/') ? isMocked('admin') : isMocked('parent')) {
    const routes = path.startsWith('/admin/') ? adminRoutes : parentRoutes;
    return routes.handle<T>(path, method, body, token);
  }
  return request<T>(path, { method, body: opts.body, token });
}
