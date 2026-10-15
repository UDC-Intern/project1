import { useStopwatch } from '../hooks/useStopwatch';
import { formatDuration } from '../lib/format';

export function Stopwatch({ running }: { running: boolean }) {
  const ms = useStopwatch(running);
  return (
    <span className="uk-stopwatch" role="timer" aria-label="Waktu bermain">
      {formatDuration(ms)}
    </span>
  );
}
