import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatRupiah } from '@udakids/engine';
import { errorMessage } from '../api/client';
import { useSettings } from '../api/settings';
import { useApiCall, useFetch } from '../auth/useApi';
import { t } from '../i18n';
import { Badge, Button, Card, Empty, Notice, PageHeader, RequiredNote, Spinner } from '../ui/ui';
import type { BillingOverview, BillingPackage, Order, PaymentMethod } from './billingTypes';
import { durationText, formatDay, scopeText, useBookTitles } from './billingUi';

function MethodChooser({
  pkg,
  methods,
  expiryHours,
  onCancel,
}: {
  pkg: BillingPackage;
  methods: PaymentMethod[];
  expiryHours: number;
  onCancel: () => void;
}) {
  const call = useApiCall('parent');
  const navigate = useNavigate();
  const [methodId, setMethodId] = useState<string>();
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    if (!methodId) {
      setMissing(true);
      return;
    }
    setBusy(true);
    try {
      const order = await call<Order>('/parent/orders', { body: { packageId: pkg.id, methodId } });
      navigate(`/orang-tua/transaksi/${order.id}`, { state: { created: true } });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (methods.length === 0) {
    return (
      <div className="pa-checkout">
        <Notice tone="info">{t('parent.billing.noMethods')}</Notice>
        <Button variant="ghost" onClick={onCancel}>
          {t('parent.cancel')}
        </Button>
      </div>
    );
  }

  return (
    <form className="pa-checkout" onSubmit={submit} noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <RequiredNote />
      <fieldset
        className="pa-methods"
        aria-describedby={missing ? `pa-method-error-${pkg.id}` : undefined}
      >
        <legend>
          {t('parent.billing.chooseMethod')}{' '}
          <span className="ui-req" aria-hidden>
            *
          </span>
        </legend>
        {methods.map((m) => (
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
                {m.provider}{' '}
                <span className="ui-muted pa-method-kind">
                  {m.kind === 'bank'
                    ? t('parent.billing.kindBank')
                    : t('parent.billing.kindEwallet')}
                </span>
              </strong>
              <span className="pa-mono">{m.accountNumber}</span>
              <span className="ui-muted">
                {t('parent.billing.accountName', { name: m.accountName })}
              </span>
            </span>
          </label>
        ))}
        {missing && (
          <p id={`pa-method-error-${pkg.id}`} className="ui-error" role="alert">
            {t('parent.billing.methodMissing')}
          </p>
        )}
      </fieldset>
      <p className="ui-hint">{t('parent.billing.uniqueExplain', { hours: expiryHours })}</p>
      <div className="ui-row">
        <Button type="submit" disabled={busy}>
          {busy ? t('parent.billing.creating') : t('parent.billing.createOrder')}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {t('parent.cancel')}
        </Button>
      </div>
    </form>
  );
}

function PackageCard({
  pkg,
  title,
  selected,
  onBuy,
  children,
}: {
  pkg: BillingPackage;
  title: (b: { domain: string; grade: string }) => string;
  selected: boolean;
  onBuy: () => void;
  children?: ReactNode;
}) {
  const p = pkg.pricing;
  return (
    <article className={selected ? 'pa-pkg selected' : 'pa-pkg'} aria-labelledby={`pkg-${pkg.id}`}>
      <div className="pa-pkg-head">
        <h3 id={`pkg-${pkg.id}`}>{pkg.name}</h3>
        {p.discountActive && (
          <Badge tone="success">
            {t('parent.billing.save', { amount: formatRupiah(p.discount) })}
          </Badge>
        )}
      </div>
      {pkg.description && <p className="ui-muted">{pkg.description}</p>}
      <dl className="pa-pkg-facts">
        <dt>{t('parent.billing.scope')}</dt>
        <dd>{scopeText(pkg.scope, pkg.books, title)}</dd>
        <dt>{t('parent.billing.duration')}</dt>
        <dd>{durationText(pkg.durationDays)}</dd>
        <dt>{t('parent.billing.certificate')}</dt>
        <dd>
          <Link to="/orang-tua/sertifikat">{t('parent.billing.certificateValue')}</Link>
        </dd>
      </dl>
      <div className="pa-price">
        {p.discountActive && (
          <s className="pa-price-normal">
            <span className="pa-sr">{t('parent.billing.normalPrice')} </span>
            {formatRupiah(p.normal)}
          </s>
        )}
        <span className="pa-price-final">
          <span className="pa-sr">{t('parent.billing.finalPrice')} </span>
          {formatRupiah(p.final)}
        </span>
      </div>
      {p.discountActive && pkg.discountEndsAt && (
        <p className="ui-hint">
          {t('parent.billing.discountUntil', { when: formatDay(pkg.discountEndsAt) })}
        </p>
      )}
      {selected ? (
        children
      ) : (
        <Button onClick={onBuy}>{t('parent.billing.buy', { name: pkg.name })}</Button>
      )}
    </article>
  );
}

/** Paket & pembayaran: level gratis, paket aktif, daftar paket, pilih cara bayar. */
export function PackagesPage() {
  const { data, error, loading, reload } = useFetch<BillingOverview>('parent', '/parent/billing');
  const [selected, setSelected] = useState<string>();
  const needsTitles =
    !!data &&
    [...data.packages, ...data.entitlements].some((x) => x.scope === 'books' && x.books.length);
  const title = useBookTitles(needsTitles);
  const group = useSettings().contact.groupWhatsapp;

  return (
    <>
      <PageHeader
        title={t('parent.billing.title')}
        subtitle={t('parent.billing.subtitle')}
        actions={
          <Link className="ui-btn ui-btn-secondary" to="/orang-tua/transaksi">
            {t('parent.nav.orders')}
          </Link>
        }
      />
      {loading && !data ? (
        <Spinner label={t('parent.loading')} />
      ) : error || !data ? (
        <Notice tone="error">
          {t('parent.billing.loadError')} {errorMessage(error)}{' '}
          <Button variant="ghost" onClick={reload}>
            {t('parent.dash.retry')}
          </Button>
        </Notice>
      ) : (
        <>
          {data.settings.paywall ? (
            <Notice tone="info">{t('parent.billing.free', { n: data.settings.freeLevels })}</Notice>
          ) : (
            <Notice tone="success">{t('parent.billing.allOpen')}</Notice>
          )}
          {group && (
            <Notice tone="info">
              <div className="pa-welcome">
                <span>{t('parent.billing.group')}</span>
                <a
                  className="ui-btn ui-btn-secondary"
                  href={group}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('parent.billing.groupJoin')}
                </a>
              </div>
            </Notice>
          )}

          <Card title={t('parent.billing.mine')}>
            {data.entitlements.length === 0 ? (
              <Empty>{t('parent.billing.mineNone')}</Empty>
            ) : (
              <ul className="pa-ent">
                {data.entitlements.map((e) => {
                  const ended = e.endsAt !== null && Date.parse(e.endsAt) <= Date.now();
                  return (
                    <li key={e.id} className={ended ? 'pa-ent-item ended' : 'pa-ent-item'}>
                      <strong>{e.name}</strong>
                      <span>{scopeText(e.scope, e.books, title)}</span>
                      <Badge tone={ended ? 'muted' : 'success'}>
                        {e.endsAt === null
                          ? t('parent.billing.activeForever')
                          : ended
                            ? t('parent.billing.ended', { when: formatDay(e.endsAt) })
                            : t('parent.billing.activeUntil', { when: formatDay(e.endsAt) })}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title={t('parent.billing.packages')}>
            {data.packages.length === 0 ? (
              <Empty>{t('parent.billing.noPackages')}</Empty>
            ) : (
              <div className="pa-pkgs">
                {data.packages.map((pkg) => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    title={title}
                    selected={selected === pkg.id}
                    onBuy={() => setSelected(pkg.id)}
                  >
                    <MethodChooser
                      pkg={pkg}
                      methods={data.methods}
                      expiryHours={data.settings.orderExpiryHours}
                      onCancel={() => setSelected(undefined)}
                    />
                  </PackageCard>
                ))}
              </div>
            )}
            <p className="ui-hint pa-honest">{t('parent.billing.honest')}</p>
          </Card>
        </>
      )}
    </>
  );
}
