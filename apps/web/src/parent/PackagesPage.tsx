import { formatRupiah, type BillingPackage, type PaymentMethod } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder, methods, packages } from '../api/billing';
import { ApiError } from '../api/client';
import { plan } from '../api/parent';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDate } from '../lib/format';
import { PageHeader } from '../ui/AppShell';
import { ErrorState, LoadingState } from '../ui/states';

function MethodChooser({
  pkg,
  list,
  onCancel,
}: {
  pkg: BillingPackage;
  list: PaymentMethod[];
  onCancel: () => void;
}) {
  const t = useT('parent');
  const navigate = useNavigate();
  const [methodId, setMethodId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!methodId) {
      setError(t('plan.method.noMethod'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder({ packageId: pkg.id, methodId });
      navigate(`/orang-tua/transaksi/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
      setBusy(false);
    }
  }

  const groups: { kind: PaymentMethod['kind']; label: string }[] = [
    { kind: 'bank', label: t('plan.method.bank') },
    { kind: 'ewallet', label: t('plan.method.ewallet') },
  ];

  return (
    <section className="uk-card uk-stack method-chooser" aria-labelledby="method-title">
      <div>
        <h2 id="method-title" style={{ margin: 0 }}>
          {t('plan.method.title')}
        </h2>
        <p style={{ margin: 0 }}>
          {t('plan.method.for', { name: pkg.name, price: formatRupiah(pkg.price) })}
        </p>
      </div>
      <div className="uk-stack" role="radiogroup" aria-labelledby="method-title">
        {groups.map((g) => (
          <div key={g.kind} className="uk-stack">
            {list
              .filter((m) => m.kind === g.kind)
              .map((m) => (
                <label key={m.id} className={`method-option${methodId === m.id ? ' is-on' : ''}`}>
                  <input
                    type="radio"
                    name="method"
                    value={m.id}
                    checked={methodId === m.id}
                    onChange={() => setMethodId(m.id)}
                  />
                  <span className="method-name">
                    <strong>{m.name}</strong>
                    <small>{g.label}</small>
                  </span>
                  <span className="method-detail">
                    <code>{m.number}</code>
                    <small>{t('plan.method.holder', { name: m.holder })}</small>
                  </span>
                </label>
              ))}
          </div>
        ))}
      </div>
      <p style={{ margin: 0 }}>{t('plan.method.unique')}</p>
      {error && (
        <p role="alert" style={{ color: 'var(--bahaya)', margin: 0 }}>
          {error}
        </p>
      )}
      <div className="uk-row">
        <button type="button" className="uk-btn" disabled={busy} onClick={() => void create()}>
          {t('plan.method.create')}
        </button>
        <button type="button" className="uk-btn uk-btn--ghost" onClick={onCancel}>
          {t('plan.method.cancel')}
        </button>
      </div>
    </section>
  );
}

export function PackagesPage() {
  const t = useT('parent');
  const loadPackages = useCallback(() => packages(), []);
  const loadMethods = useCallback(() => methods(), []);
  const loadPlan = useCallback(() => plan(), []);
  const pk = useAsync(loadPackages);
  const me = useAsync(loadMethods);
  const pl = useAsync(loadPlan);
  const [chosen, setChosen] = useState<BillingPackage | null>(null);

  if (pk.loading || me.loading) return <LoadingState />;
  if (pk.error || !pk.data || me.error || !me.data) return <ErrorState onRetry={pk.reload} />;

  const until = pl.data?.children
    .map((c) => c.until)
    .filter((u): u is string => u !== null)
    .sort()
    .at(-1);

  return (
    <div className="uk-stack">
      <PageHeader title={t('plan.title')} subtitle={t('plan.subtitle')} />

      <section className="uk-card uk-stack">
        <h2 style={{ margin: 0 }}>{t('plan.active')}</h2>
        <p style={{ margin: 0 }}>
          {until ? t('plan.activeUntil', { date: formatDate(until) }) : t('plan.none')}
        </p>
      </section>

      {chosen && <MethodChooser pkg={chosen} list={me.data} onCancel={() => setChosen(null)} />}

      <section className="uk-stack" aria-labelledby="choose-title">
        <h2 id="choose-title" style={{ margin: 0 }}>
          {t('plan.choose')}
        </h2>
        <div className="package-grid">
          {pk.data.map((p) => {
            const saved = p.listPrice - p.price;
            return (
              <article key={p.id} className={`package-card${chosen?.id === p.id ? ' is-on' : ''}`}>
                <header>
                  <h3>{p.name}</h3>
                  {saved > 0 && (
                    <span className="save-badge">
                      {t('plan.save', { amount: formatRupiah(saved) })}
                    </span>
                  )}
                </header>
                <dl>
                  <div>
                    <dt>{t('plan.content')}</dt>
                    <dd>{t('plan.content.value')}</dd>
                  </div>
                  <div>
                    <dt>{t('plan.duration')}</dt>
                    <dd>
                      {p.durationDays === null
                        ? t('plan.duration.forever')
                        : t('plan.duration.days', { n: p.durationDays })}
                    </dd>
                  </div>
                </dl>
                <p className="package-price">
                  {saved > 0 && <s>{formatRupiah(p.listPrice)}</s>}
                  <strong>{formatRupiah(p.price)}</strong>
                </p>
                <button type="button" className="uk-btn" onClick={() => setChosen(p)}>
                  {t('plan.buy', { name: p.name })}
                </button>
              </article>
            );
          })}
        </div>
        <p style={{ margin: 0 }}>{t('plan.note')}</p>
      </section>
    </div>
  );
}
