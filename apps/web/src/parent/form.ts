import { ApiError } from '../api/client';

type Issue = { path: PropertyKey[] | string; message: string };

const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** Kumpulkan pesan pertama per field dari issue Zod (klien) atau ApiError (server). */
export function fieldErrors(issues: readonly Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = Array.isArray(issue.path)
      ? String(issue.path[0] ?? '')
      : String(issue.path).split('.')[0]!;
    if (!(key in out)) out[key] = capitalize(issue.message);
  }
  return out;
}

export function serverFieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError ? fieldErrors(err.issues) : {};
}
