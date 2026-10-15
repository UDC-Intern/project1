import { apiErrorSchema, type ApiErrorBody } from '@udakids/engine';
import { API_URL } from '../config/app';

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody['error'];

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

type Options = { method?: string; body?: unknown; token?: string | null };

/** Satu-satunya tempat fetch dipanggil. Halaman memakai fungsi di src/api/<modul>.ts. */
export async function request<T>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
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
    );
  }
  return json as T;
}
