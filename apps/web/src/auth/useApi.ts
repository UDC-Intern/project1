import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { api } from '../api/pageApi';
import { getSession, setSession, type SessionKind } from './session';

/** Panggil API dengan token sesi; 401 → sesi dihapus (kembali ke halaman masuk). */
export function useApiCall(kind: SessionKind) {
  return useCallback(
    async <T>(path: string, opts: Parameters<typeof api>[1] = {}): Promise<T> => {
      try {
        return await api<T>(path, { ...opts, token: getSession(kind)?.token ?? null });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setSession(kind, null);
        throw err;
      }
    },
    [kind],
  );
}

/** Ambil data sekali (dan saat `reload()` dipanggil). */
export function useFetch<T>(kind: SessionKind, path: string | null) {
  const call = useApiCall(kind);
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (path === null) return;
    const ctrl = new AbortController();
    setLoading(true);
    call<T>(path, { signal: ctrl.signal })
      .then((d) => {
        setData(d);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setError(e);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [call, path, tick]);
  return { data, error, loading, reload: () => setTick((x) => x + 1), setData };
}
