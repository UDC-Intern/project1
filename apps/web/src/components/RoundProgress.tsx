import { useT } from '../i18n';

/** 10 titik indikator: hijau untuk tepat, kuning untuk belum tepat, titik sekarang berwarna kunyit. */
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
  const label = t('round.progress', { n: Math.min(current + 1, total), total });
  return (
    <div>
      <ol className="quiz-dots" role="img" aria-label={label}>
        {Array.from({ length: total }, (_, i) => {
          const state =
            i < results.length
              ? results[i]
                ? ' is-right'
                : ' is-wrong'
              : i === current
                ? ' is-current'
                : '';
          return <li key={i} className={`quiz-dot${state}`} />;
        })}
      </ol>
      <p className="quiz-count" aria-hidden="true">
        {label}
      </p>
    </div>
  );
}
