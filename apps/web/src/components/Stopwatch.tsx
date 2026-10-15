import { useStopwatch } from '../hooks/useStopwatch';
import { formatDuration } from '../lib/format';
import { ClockIcon } from './Icons';

/** Stopwatch tanpa batas waktu: hanya menunjukkan berapa lama anak bermain. */
export function Stopwatch({ running }: { running: boolean }) {
  const ms = useStopwatch(running);
  return (
    <span className="stopwatch" role="timer" aria-label="Waktu bermain">
      <ClockIcon size={22} />
      {formatDuration(ms)}
    </span>
  );
}
