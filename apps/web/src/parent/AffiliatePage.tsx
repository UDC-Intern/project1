import { useCallback, useState } from 'react';
import { referral } from '../api/account';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { PageHeader } from '../ui/AppShell';
import { ErrorState, LoadingState } from '../ui/states';

export function AffiliatePage() {
  const t = useT('parent');
  const load = useCallback(() => referral(), []);
  const { data, error, loading, reload } = useAsync(load);
  const [copied, setCopied] = useState(false);

  if (loading) return <LoadingState />;
  if (error || !data) return <ErrorState onRetry={reload} />;

  const link = `${window.location.origin}/orang-tua/daftar?ref=${data.code}`;

  return (
    <div className="uk-stack">
      <PageHeader title={t('affiliate.title')} subtitle={t('affiliate.subtitle')} />
      <section className="uk-card uk-stack" aria-labelledby="aff-link">
        <h2 id="aff-link" style={{ margin: 0 }}>
          {t('affiliate.link')}
        </h2>
        <p className="method-number" style={{ overflowWrap: 'anywhere' }}>
          {link}
        </p>
        <div>
          <button
            type="button"
            className="uk-btn"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? t('order.copied') : t('affiliate.copy')}
          </button>
        </div>
      </section>
      <div className="uk-row">
        <div className="uk-card" style={{ flex: 1 }}>
          <p style={{ margin: 0 }}>{t('affiliate.registered')}</p>
          <p className="stat-number">{data.registered}</p>
        </div>
        <div className="uk-card" style={{ flex: 1 }}>
          <p style={{ margin: 0 }}>{t('affiliate.paid')}</p>
          <p className="stat-number">{data.paid}</p>
        </div>
      </div>
    </div>
  );
}
