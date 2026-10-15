import { MOMO_COLORS, type MomoColor } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { home, profile, setMomo } from '../api/catalog';
import { certificate } from '../api/certificate';
import { Momo } from '../components/Momo';
import { PageHead } from '../components/PageHead';
import { Plant } from '../components/Plant';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDateTime } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';

export function ProfilePage() {
  const t = useT('play');
  const load = useCallback(() => profile(), []);
  const { data, error, loading, reload } = useAsync(load);
  const [color, setColor] = useState<MomoColor | null>(null);

  const loadCerts = useCallback(async () => {
    const { books } = await home();
    const found = await Promise.all(
      books.map((b) =>
        certificate(b.slug).then(
          () => b,
          () => null,
        ),
      ),
    );
    return found.filter((b) => b !== null);
  }, []);
  const certs = useAsync(loadCerts);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const current: MomoColor = color ?? data.momoColor;

  async function pick(next: MomoColor) {
    setColor(next);
    await setMomo(next);
  }

  return (
    <main className="library profile-page">
      <PageHead title={t('profile.title')} />

      <section className="profile-hero">
        <Momo color={current} mood="happy" size={132} />
        <div className="profile-id">
          <h1>{data.nickname}</h1>
          <div className="profile-actions">
            <Link className="kid-btn" to="/play/peringkat">
              {t('profile.board')}
            </Link>
          </div>
        </div>
      </section>

      <div className="profile-stats">
        <div className="profile-stat is-points">
          <span className="profile-value">{data.totalScore}</span>
          <span className="profile-label">{t('profile.stat.points')}</span>
        </div>
        <div className="profile-stat is-passed">
          <span className="profile-value">{data.levelsPassed}</span>
          <span className="profile-label">{t('profile.stat.passed')}</span>
        </div>
        <div className="profile-stat">
          <span className="profile-value">{data.rounds}</span>
          <span className="profile-label">{t('profile.stat.rounds')}</span>
        </div>
      </div>

      {certs.data && certs.data.length > 0 && (
        <section className="certs">
          <h2>{t('profile.certs')}</h2>
          <div className="kid-row">
            {certs.data.map((b) => (
              <Link key={b.slug} className="kid-btn big-play" to={`/play/sertifikat/${b.slug}`}>
                {t('cert.link', { book: b.title })}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="plants">
        <h2>{t('profile.plants')}</h2>
        <div className="plant-grid">
          {data.plants.map((p) => (
            <div key={p.topicId} className="plant-card">
              <Plant stage={p.stage} size={72} />
              <span>{p.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="swatches-box">
        <h2>{t('profile.color')}</h2>
        <div className="swatch-row">
          {MOMO_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="swatch-btn"
              aria-label={t(`color.${c}`)}
              aria-pressed={current === c}
              onClick={() => void pick(c)}
            >
              <Momo color={c} size={44} />
            </button>
          ))}
        </div>
      </section>

      <section className="history">
        <h2>{t('profile.history')}</h2>
        {data.history.length === 0 ? (
          <p className="kid-note">{t('profile.noHistory')}</p>
        ) : (
          <ol className="history-list">
            {data.history.map((h) => (
              <li key={h.roundId} className={`history-row ${h.passed ? 'is-passed' : 'is-failed'}`}>
                <span className="history-score">{h.score}</span>
                <span className="history-main">
                  <strong>{h.levelTitle}</strong>
                  <small>{formatDateTime(h.finishedAt)}</small>
                </span>
                <span className="history-badge">
                  {h.passed ? t('history.passed') : t('history.retry')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
