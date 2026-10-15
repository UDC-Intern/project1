import { useCallback } from 'react';
import { plan } from '../api/parent';
import { useSession } from '../auth/store';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDate } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';

export function PlanPage() {
  const t = useT('parent');
  const parentName = useSession((s) => s.session?.name ?? '');
  const load = useCallback(() => plan(), []);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const whatsapp = (child: string) =>
    `https://wa.me/${data.adminWhatsapp}?text=${encodeURIComponent(
      t('plan.whatsapp', { parent: parentName, child }),
    )}`;

  return (
    <div className="uk-stack">
      <h1>{t('plan.title')}</h1>
      <p style={{ margin: 0 }}>{t('plan.hint')}</p>
      <div className="uk-grid">
        {data.children.map((c) => (
          <article key={c.id} className="uk-card uk-stack">
            <strong>{c.nickname}</strong>
            <span className="uk-badge">
              {c.plan === 'premium' && c.until
                ? t('plan.premium', { date: formatDate(c.until) })
                : t('plan.free')}
            </span>
            {c.plan === 'free' && (
              <a
                className="uk-btn"
                href={whatsapp(c.nickname)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('plan.contact')}
              </a>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
