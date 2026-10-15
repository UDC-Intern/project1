import { useT } from '../i18n';

/** 10 titik indikator: hijau untuk tepat, kuning untuk belum tepat, cincin untuk soal sekarang. */
export function RoundProgress({
  total,
  current,
  results,
}: {
  total: number;
  current: number;
  results: boolean[];
}) {
  const t = useT('play');
  return (
    <div>
      <p style={{ margin: 0, fontWeight: 700 }}>
        {t('round.progress', { n: Math.min(current + 1, total), total })}
      </p>
      <ol className="uk-dots" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const state =
            i < results.length
              ? results[i]
                ? 'correct'
                : 'retry'
              : i === current
                ? 'current'
                : 'todo';
          return <li key={i} className="uk-dot" data-state={state} />;
        })}
      </ol>
    </div>
  );
}
