import { apiErrorSchema, type ApiErrorBody } from '@udakids/engine';
import { useSession } from '../auth/store';
import { API_URL } from '../config/app';
import { t } from '../i18n';

export type ApiIssue = { path: string; message: string };

const codeFor = (status: number): ApiErrorBody['error']['code'] =>
  status === 401
    ? 'UNAUTHENTICATED'
    : status === 403
      ? 'FORBIDDEN'
      : status === 404
        ? 'NOT_FOUND'
        : status === 409
          ? 'CONFLICT'
          : status === 0 || status === 429
            ? 'RATE_LIMITED'
            : 'VALIDATION';

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody['error'] & { reason?: string };
  readonly issues: ApiIssue[];

  constructor(
    status: number,
    body: (ApiErrorBody['error'] & { reason?: string }) | string,
    issues: ApiIssue[] = [],
    extra: { reason?: string } = {},
  ) {
    const resolved =
      typeof body === 'string' ? { code: codeFor(status), message: body, ...extra } : body;
    super(resolved.message);
    this.status = status;
    this.body = resolved;
    this.issues = issues;
  }
}

/** Pesan ramah untuk orang dewasa; isian yang bermasalah ikut disebut bila ada. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return t('common.error.offline');
    if (err.issues.length)
      return `${err.message}: ${err.issues.map((i) => (i.path ? `${i.path} — ${i.message}` : i.message)).join('; ')}`;
    return err.message;
  }
  return t('common.error.generic');
}

type Options = { method?: string; body?: unknown; token?: string | null; signal?: AbortSignal };

/** Satu-satunya tempat fetch dipanggil. Halaman memakai fungsi di src/api/<modul>.ts. */
export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = options.token !== undefined ? options.token : useSession.getState().session?.token;
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      signal: options.signal,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ApiError(0, {
      code: 'RATE_LIMITED',
      message: 'Belum bisa terhubung. Coba lagi, ya.',
    });
  }

  if (res.status === 204) return undefined as T;
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = apiErrorSchema.safeParse(json);
    throw new ApiError(
      res.status,
      parsed.success
        ? parsed.data.error
        : { code: 'VALIDATION', message: 'Ada yang belum berjalan. Coba lagi, ya.' },
      parsed.success ? (parsed.data.issues ?? []) : [],
    );
  }
  return json as T;
}
