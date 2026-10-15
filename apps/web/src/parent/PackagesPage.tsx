import { formatRupiah, type BillingPackage, type PaymentMethod } from '@udakids/engine';
import { useCallback, useState, type FormEvent, type ReactNode } from 'react';
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
  const common = useT('common');
  const navigate = useNavigate();
  const [methodId, setMethodId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!methodId) {
      setMissing(true);
      return;
    }
    setBusy(true);
    try {
      const order = await createOrder({ packageId: pkg.id, methodId });
      navigate(`/orang-tua/transaksi/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error.generic'));
      setBusy(false);
    }
  }

  return (
    <form className="pa-checkout" onSubmit={(e) => void submit(e)} noValidate>
      {error && (
        <p className="banner banner-warn" role="alert">
          {error}
        </p>
      )}
      <p className="ui-req-note">
        <span className="ui-req" aria-hidden="true">
          *
        </span>{' '}
        {common('required')}
      </p>
      <fieldset
        className="pa-methods"
        aria-describedby={missing ? `pa-method-error-${pkg.id}` : undefined}
      >
        <legend>
          {t('plan.method.title')}{' '}
          <span className="ui-req" aria-hidden="true">
            *
          </span>
        </legend>
        {list.map((m) => (
          <label key={m.id} className={methodId === m.id ? 'pa-method selected' : 'pa-method'}>
            <input
              type="radio"
              name={`method-${pkg.id}`}
              value={m.id}
              required
              checked={methodId === m.id}
              onChange={() => {
                setMethodId(m.id);
                setMissing(false);
              }}
            />
            <span className="pa-method-body">
              <strong>
                {m.name}{' '}
                <span className="pa-method-kind">
                  {m.kind === 'bank' ? t('plan.method.bank') : t('plan.method.ewallet')}
                </span>
              </strong>
              <span className="pa-mono">{m.number}</span>
              <span className="pa-muted">{t('plan.method.holder', { name: m.holder })}</span>
            </span>
          </label>
        ))}
        {missing && (
          <p id={`pa-method-error-${pkg.id}`} className="pa-error" role="alert">
            {t('plan.method.noMethod')}
          </p>
        )}
      </fieldset>
      <p className="pa-muted">{t('plan.method.unique')}</p>
      <div className="uk-row">
        <button type="submit" className="uk-btn" disabled={busy}>
          {t('plan.method.create')}
        </button>
        <button type="button" className="uk-btn uk-btn--ghost" disabled={busy} onClick={onCancel}>
          {t('plan.method.cancel')}
        </button>
      </div>
    </form>
  );
}

/** Kartu paket: saat dipilih melebar satu baris penuh dan tombol beli diganti formulir cara bayar. */
function PackageCard({
  pkg,
  selected,
  onBuy,
  children,
}: {
  pkg: BillingPackage;
  selected: boolean;
  onBuy: () => void;
  children?: ReactNode;
}) {
  const t = useT('parent');
  const saved = pkg.listPrice - pkg.price;
  return (
    <article
      className={selected ? 'package-card is-on' : 'package-card'}
      aria-labelledby={`pkg-${pkg.id}`}
    >
      <header>
        <h3 id={`pkg-${pkg.id}`}>{pkg.name}</h3>
        {saved > 0 && (
          <span className="save-badge">{t('plan.save', { amount: formatRupiah(saved) })}</span>
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
            {pkg.durationDays === null
              ? t('plan.duration.forever')
              : t('plan.duration.days', { n: pkg.durationDays })}
          </dd>
        </div>
      </dl>
      <p className="package-price">
        {saved > 0 && <s>{formatRupiah(pkg.listPrice)}</s>}
        <strong>{formatRupiah(pkg.price)}</strong>
      </p>
      {selected ? (
        children
      ) : (
        <button type="button" className="uk-btn" onClick={onBuy}>
          {t('plan.buy', { name: pkg.name })}
        </button>
      )}
    </article>
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
  const [selected, setSelected] = useState<string | null>(null);

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

      <section className="uk-card uk-stack" aria-labelledby="choose-title">
        <h2 id="choose-title" style={{ margin: 0 }}>
          {t('plan.choose')}
        </h2>
        <div className="package-grid">
          {pk.data.map((p) => (
            <PackageCard
              key={p.id}
              pkg={p}
              selected={selected === p.id}
              onBuy={() => setSelected(p.id)}
            >
              <MethodChooser pkg={p} list={me.data!} onCancel={() => setSelected(null)} />
            </PackageCard>
          ))}
        </div>
        <p className="pa-muted">{t('plan.note')}</p>
      </section>
    </div>
  );
}
