import { useCallback, useEffect, useState } from 'react';

type State<T> = { data: T | null; error: Error | null; loading: boolean };

/** Memuat data satu kali per perubahan `load`. Bungkus `load` dengan useCallback di pemanggil. */
export function useAsync<T>(load: () => Promise<T>) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error: unknown) =>
        !cancelled &&
        setState({
          data: null,
          error: error instanceof Error ? error : new Error('Ada yang belum berjalan.'),
          loading: false,
        }),
    );
    return () => {
      cancelled = true;
    };
  }, [load, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}
