import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { overview } from '../api/parent';
import { Momo } from '../components/Momo';
import { TOTAL_LEVELS } from '../content/books';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDate } from '../lib/format';
import { PageHeader } from '../ui/AppShell';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';

const MAX_CHILDREN = 3;

export function ParentHome() {
  const t = useT('parent');
  const load = useCallback(() => overview(), []);
  const { data, error, loading, reload } = useAsync(load);
  const [copied, setCopied] = useState(false);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  async function copy() {
    try {
      await navigator.clipboard.writeText(data!.familyCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const full = data.children.length >= MAX_CHILDREN;
  const premium = data.children.some((c) => c.premiumUntil !== null);

  return (
    <div className="uk-stack">
      <PageHeader
        title={t('home.title')}
        actions={
          <span className={`uk-badge${premium ? ' is-premium' : ''}`}>
            {t('home.plan')}: {premium ? t('home.plan.premium') : t('home.plan.free')}
          </span>
        }
      />

      <section className="uk-card code-card">
        <div>
          <p style={{ margin: 0 }}>{t('home.familyCode')}</p>
          <span className="uk-code" aria-label={data.familyCode.split('').join(' ')}>
            {data.familyCode}
          </span>
          <p style={{ margin: 0 }}>{t('home.familyCodeHint')}</p>
        </div>
        <button type="button" className="uk-btn uk-btn--ghost" onClick={() => void copy()}>
          {copied ? t('home.copied') : t('home.copy')}
        </button>
      </section>

      <section className="uk-stack">
        <h2>{t('home.week')}</h2>
        <div className="uk-stats">
          <div className="uk-stat">
            <strong>{data.week.rounds}</strong>
            {t('home.week.rounds')}
          </div>
          <div className="uk-stat">
            <strong>{data.week.levelsPassed}</strong>
            {t('home.week.levels')}
          </div>
          <div className="uk-stat">
            <strong>{data.week.minutes}</strong>
            {t('home.week.minutes')}
          </div>
          <div className="uk-stat">
            <strong>{data.week.activeChildren}</strong>
            {t('home.week.active')}
          </div>
        </div>
      </section>

      <section className="uk-stack">
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h2 style={{ margin: 0 }}>{t('home.children')}</h2>
          {full ? (
            <span>{t('home.maxChildren')}</span>
          ) : (
            <Link className="uk-btn" to="/orang-tua/anak/baru">
              + {t('home.addChild')}
            </Link>
          )}
        </div>

        {data.children.length === 0 ? (
          <EmptyState title={t('home.children')} hint={t('home.noChildren')} />
        ) : (
          <div className="uk-grid child-grid">
            {data.children.map((c) => {
              const pct = Math.min(100, Math.round((c.levelsPassed / TOTAL_LEVELS) * 100));
              return (
                <article key={c.id} className="uk-card uk-stack">
                  <div className="uk-row">
                    <Momo color={c.momoColor} size={56} />
                    <strong style={{ fontSize: '1.15rem' }}>{c.nickname}</strong>
                  </div>
                  <div>
                    <div
                      className="progress"
                      role="img"
                      aria-label={`${t('home.progress')} ${pct}%`}
                    >
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <small>
                      {t('home.progress.value', { passed: c.levelsPassed, total: TOTAL_LEVELS })}
                    </small>
                  </div>
                  <p style={{ margin: 0 }}>
                    {t('child.stats', {
                      rounds: c.rounds,
                      levels: c.levelsPassed,
                      score: c.totalScore,
                    })}
                  </p>
                  {c.premiumUntil && (
                    <span className="uk-badge is-premium">
                      {t('child.premium', { date: formatDate(c.premiumUntil) })}
                    </span>
                  )}
                  <span role="status">{c.hasPin ? t('home.pinSet') : t('child.noPin')}</span>
                  <div className="uk-row">
                    <Link className="uk-btn" to={`/orang-tua/anak/${c.id}`}>
                      {t('child.report')}
                    </Link>
                    <Link className="uk-btn uk-btn--ghost" to={`/orang-tua/anak/${c.id}/ubah`}>
                      {t('child.edit')}
                    </Link>
                    <Link className="uk-btn uk-btn--ghost" to={`/orang-tua/anak/${c.id}/sandi`}>
                      {t('child.pin')}
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
