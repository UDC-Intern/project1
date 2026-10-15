import { useEffect, useRef, useState } from 'react';

/** Stopwatch tanpa batas waktu. Berhenti saat `running` bernilai false dan melanjutkan dari waktu terakhir. */
export function useStopwatch(running: boolean) {
  const [ms, setMs] = useState(0);
  const elapsed = useRef(0);
  elapsed.current = ms;

  useEffect(() => {
    if (!running) return;
    const startedAt = Date.now() - elapsed.current;
    const id = window.setInterval(() => setMs(Date.now() - startedAt), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  return ms;
}
