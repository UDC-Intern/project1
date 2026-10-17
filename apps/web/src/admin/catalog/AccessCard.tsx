import { useEffect, useState } from 'react';
import type { AppSettings } from '@udakids/engine';
import { settingsChanged, useSettings } from '../../api/settings';
import { useApiCall } from '../../auth/useApi';
import { t } from '../../i18n';
import { Stepper, Switch } from '../../ui/controls';
import { Button, Card } from '../../ui/ui';
import { ActionNotice, Icon, useAction } from '../common';
import { SamplePill } from './LevelPills';

const EXAMPLE_LEVELS = [1, 2, 3, 4, 5, 6];

/**
 * Aturan akses berbayar untuk semua topik: kunci berbayar hidup atau mati dan berapa level pertama yang gratis.
 * Disimpan sebagai bagian `billing` Pengaturan (`PUT /admin/settings/billing`); batas bayar pesanan di bagian yang
 * sama tidak disentuh. Pengecualian per level diatur di tiap topik.
 */
export function AccessCard({ onSaved }: { onSaved: () => void }) {
  const billing = useSettings().billing;
  const call = useApiCall('staff');
  const action = useAction();
  const [paywall, setPaywall] = useState(billing.paywall);
  const [freeLevels, setFreeLevels] = useState(billing.freeLevels);

  // Pengaturan baru masuk (mis. selesai disimpan atau dimuat ulang): isian ikut.
  useEffect(() => {
    setPaywall(billing.paywall);
    setFreeLevels(billing.freeLevels);
  }, [billing.paywall, billing.freeLevels]);

  const dirty = paywall !== billing.paywall || freeLevels !== billing.freeLevels;

  async function save() {
    const out = await action.run(
      () =>
        call<AppSettings>('/admin/settings/billing', {
          method: 'PUT',
          body: { ...billing, paywall, freeLevels },
        }),
      t('admin.catalog.access.saved'),
    );
    if (out) {
      settingsChanged(out);
      onSaved();
    }
  }

  return (
    <Card title={t('admin.catalog.access.title')}>
      <p className="ui-muted" style={{ marginBottom: 16 }}>
        {t('admin.catalog.access.subtitle')}
      </p>
      <div className="syl-access">
        <div className="syl-access-controls">
          <Switch
            checked={paywall}
            onChange={setPaywall}
            label={t('admin.catalog.access.paywall')}
            hint={t('admin.catalog.access.paywallHint')}
          />
          <div className="syl-rule">
            <span className="syl-rule-label" id="syl-free-label">
              {t('admin.catalog.access.free')}
            </span>
            <div className="syl-rule-row">
              <Stepper
                value={freeLevels}
                min={1}
                max={12}
                onChange={setFreeLevels}
                label={t('admin.catalog.access.free')}
                disabled={!paywall}
              />
              <small className="ui-hint">{t('admin.catalog.access.freeHint')}</small>
            </div>
          </div>
        </div>
        <div className="syl-example">
          <h3>{t('admin.catalog.access.example')}</h3>
          <span className="syl-pills">
            {EXAMPLE_LEVELS.map((n) => (
              <SamplePill key={n} n={n} free={!paywall || n <= freeLevels} />
            ))}
          </span>
          <p className="syl-example-note">
            {paywall
              ? t('admin.catalog.access.rule', { n: freeLevels })
              : t('admin.catalog.access.allFree')}
          </p>
          <small className="ui-hint">{t('admin.catalog.access.note')}</small>
        </div>
      </div>
      <ActionNotice error={action.error} done={action.done} />
      <div className="syl-access-foot">
        <Button onClick={() => void save()} disabled={!dirty || action.busy}>
          <Icon name="check" />
          {t('admin.catalog.access.save')}
        </Button>
      </div>
    </Card>
  );
}
