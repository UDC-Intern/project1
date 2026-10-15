import { request } from './client';
import { handle } from './mock/ref';
import { isMocked } from './mode';

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
};

/**
 * Panggilan data area orang tua. Di mode tiruan dijawab dari penyimpanan peramban,
 * selain itu diteruskan ke server lewat `request`.
 */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? 'GET' : 'POST');
  if (isMocked('parent')) {
    return handle<T>(
      path,
      method,
      opts.body as Record<string, unknown> | undefined,
      opts.token ?? null,
    );
  }
  return request<T>(path, { method, body: opts.body, token: opts.token ?? null });
}
