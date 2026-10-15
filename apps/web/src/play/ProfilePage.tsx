import { MOMO_COLORS, type ChildProfile, type MomoColor } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { profile, setMomo } from '../api/catalog';
import { Momo } from '../components/Momo';
import { Plant } from '../components/Plant';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';

export function ProfilePage() {
  const t = useT('play');
  const load = useCallback(() => profile(), []);
  const { data, error, loading, reload } = useAsync(load);
  const [color, setColor] = useState<MomoColor | null>(null);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const current: MomoColor = color ?? data.momoColor;
  const history: ChildProfile['history'] = data.history;

  async function pick(next: MomoColor) {
    setColor(next);
    await setMomo(next);
  }

  return (
    <div className="uk-stack">
      <div className="uk-row">
        <Momo color={current} mood="happy" size={96} />
        <h1 style={{ margin: 0 }}>{data.nickname}</h1>
      </div>

      <section className="uk-stack">
        <h2>{t('profile.color')}</h2>
        <div className="uk-swatches">
          {MOMO_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="uk-swatch-btn"
              aria-label={t(`color.${c}`)}
              aria-pressed={current === c}
              onClick={() => void pick(c)}
            >
              <Momo color={c} size={44} />
            </button>
          ))}
        </div>
      </section>

      <section className="uk-stack">
        <h2>{t('profile.plants')}</h2>
        <div className="uk-grid">
          {data.plants.map((p) => (
            <div key={p.topicId} className="uk-card">
              <Plant stage={p.stage} size={72} />
              <p style={{ margin: 0 }}>{p.title}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="uk-stack">
        <h2>{t('profile.history')}</h2>
        {history.length === 0 ? (
          <p>{t('profile.noHistory')}</p>
        ) : (
          <ul className="uk-rank-list">
            {history.map((h) => (
              <li key={h.roundId} className="uk-rank-row">
                <strong style={{ flex: 1 }}>{h.levelTitle}</strong>
                <span>{h.score}</span>
                <span className="uk-badge">
                  {h.passed ? t('history.passed') : t('history.retry')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
