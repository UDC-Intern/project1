import {
  CERTIFICATE_DESIGNS,
  type AdminCertificate,
  type CertificateCandidate,
  type CertificateDesign,
} from '@udakids/engine';
import { useCallback, useState } from 'react';
import {
  certificates,
  deleteCertificate,
  issueCertificate,
  refreshCertificate,
  setCertificateDesign,
} from '../../api/admin';
import { errorMessage } from '../../api/client';
import { useSettings } from '../../api/settings';
import { CertificatePrint, CertificateSheet } from '../../components/certificate/CertificateSheet';
import {
  downloadCertificateImage,
  printCertificate,
  sheetDataOf,
  verifyUrlOf,
} from '../../components/certificate/sheet';
import { useAsync } from '../../hooks/useAsync';
import { t, type MessageKey } from '../../i18n';
import { formatDateTime, formatShortDate } from '../../lib/format';
import { ShellIconSvg } from '../../ui/AppShell';
import { CountUp, Kpi } from '../../ui/charts';
import { Dialog } from '../../ui/Dialog';
import { ListPager, usePaged } from '../../ui/Pager';
import { ErrorState, LoadingState } from '../../ui/states';
import { Badge, Button, Card, Empty, Notice, PageHeader, TextField } from '../../ui/ui';
import { RowActions } from '../common';
import { CertificateSheetDialog } from './CertificateSheetDialog';

const SAMPLE_NUMBER = 'CERT-7KQ2MX';

const thisMonth = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/** Nama di lembar berbeda dari nama panggilan: orang tua mengisi nama lengkap. */
const usesFullName = (c: AdminCertificate & { nickname?: string }) =>
  !!c.nickname && c.childName !== c.nickname;

/**
 * Sertifikat Juara: lembar yang berlaku (isinya diatur lewat dialog "Atur isi lembar"), desain, anak yang menunggu,
 * dan semua sertifikat yang terbit (lihat, unduh, cek keaslian, perbarui, hapus).
 */
export function CertificatesPage() {
  const load = useCallback(() => certificates(), []);
  const { data, error, loading, reload } = useAsync(load);
  const settings = useSettings().certificate;
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const [viewing, setViewing] = useState<AdminCertificate>();
  const [removing, setRemoving] = useState<AdminCertificate>();
  const [confirm, setConfirm] = useState('');
  const [downloadError, setDownloadError] = useState(false);
  const [editing, setEditing] = useState(false);

  const q = query.trim().toLowerCase();
  const list = (data?.certificates ?? []).filter(
    (c) =>
      !q ||
      [c.id, c.childName, c.parentName, c.parentEmail, c.bookTitle].some((v) =>
        v.toLowerCase().includes(q),
      ),
  );
  const waiting = usePaged(data?.candidates ?? []);
  const issued = usePaged(list);

  async function run(action: () => Promise<string>) {
    setMessage(undefined);
    try {
      setMessage({ tone: 'success', text: await action() });
      reload();
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    }
  }
  const issue = (c: CertificateCandidate) =>
    run(async () => {
      const cert = await issueCertificate({ childId: c.childId, bookSlug: c.bookSlug });
      return t('admin.certs.issued', { number: cert.id, name: cert.childName });
    });
  const refresh = (c: AdminCertificate) =>
    run(async () => {
      await refreshCertificate(c.id);
      return t('admin.certs.refreshed', { number: c.id });
    });
  const chooseDesign = (design: CertificateDesign) =>
    run(async () => {
      await setCertificateDesign(design);
      return t('admin.certs.designSaved', {
        name: t(`admin.certs.design.${design}` as MessageKey),
      });
    });
  const remove = () => {
    const target = removing;
    if (!target) return;
    setRemoving(undefined);
    setConfirm('');
    void run(async () => {
      await deleteCertificate(target.id);
      return t('admin.certs.deleted', { number: target.id });
    });
  };

  const editSheet = (size: 'md' | 'sm') => (
    <Button
      variant="secondary"
      size={size}
      aria-haspopup="dialog"
      disabled={!data}
      onClick={() => setEditing(true)}
    >
      <ShellIconSvg name="gear" size={size === 'sm' ? 16 : 18} />
      {t('admin.certs.editSheet')}
    </Button>
  );

  const header = (
    <PageHeader
      title={t('admin.certs.title')}
      subtitle={t('admin.certs.subtitle')}
      actions={
        <>
          {editSheet('md')}
          <a
            className="ui-btn ui-btn-ghost"
            href="/sertifikat/cek"
            target="_blank"
            rel="noreferrer"
          >
            {t('admin.certs.verifyPage')}
          </a>
        </>
      }
    />
  );
  if (loading && !data)
    return (
      <>
        {header}
        <LoadingState />
      </>
    );
  if (error || !data)
    return (
      <>
        {header}
        <ErrorState onRetry={reload} />
      </>
    );

  const fullNames = data.certificates.filter(usesFullName).length;
  const viewingSheet = viewing ? sheetDataOf(viewing, settings) : null;
  const yes = (on: boolean) => (on ? t('admin.certs.on') : t('admin.certs.off'));

  return (
    <>
      {header}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="ins-kpis">
        <Kpi
          i={0}
          tone="leaf"
          icon={<ShellIconSvg name="award" />}
          label={t('admin.certs.kIssued')}
          value={<CountUp value={data.certificates.length} />}
          hint={t('admin.certs.kMonth', {
            n: data.certificates.filter((c) => thisMonth(c.issuedAt)).length,
          })}
        />
        <Kpi
          i={1}
          tone="sun"
          icon={<ShellIconSvg name="flag" />}
          label={t('admin.certs.kWaiting')}
          value={<CountUp value={data.candidates.length} />}
          hint={t('admin.certs.kWaitingHint')}
        />
        <Kpi
          i={2}
          tone="sky"
          icon={<ShellIconSvg name="users" />}
          label={t('admin.certs.kFullName')}
          value={<CountUp value={fullNames} />}
          hint={settings.useFullName ? t('admin.certs.kFullNameOn') : t('admin.certs.kFullNameOff')}
        />
        <Kpi
          i={3}
          tone="grape"
          icon={<ShellIconSvg name="search" />}
          label={t('admin.certs.kQr')}
          value={yes(settings.showQr)}
          hint={t('admin.certs.kQrHint')}
        />
      </div>

      <Card title={t('admin.certs.sheetTitle')} actions={editSheet('sm')}>
        <div className="certs-sheet">
          <div>
            <p className="ui-muted">{t('admin.certs.sheetHint')}</p>
            <dl className="certs-facts">
              <dt>{t('admin.certSettings.issuer')}</dt>
              <dd>{settings.issuer}</dd>
              <dt>{t('admin.certSettings.title')}</dt>
              <dd>{[settings.title, settings.subtitle].filter(Boolean).join(' · ')}</dd>
              <dt>{t('admin.certs.signers')}</dt>
              <dd>
                {settings.signer2Name} ({settings.signer2Role || '—'})
              </dd>
              <dt>{t('admin.certs.signature')}</dt>
              <dd>{t(`admin.certs.signature.${settings.signatureType}` as MessageKey)}</dd>
              <dt>{t('admin.certs.stamp')}</dt>
              <dd>{yes(settings.showStamp)}</dd>
              <dt>{t('admin.certSettings.curriculum')}</dt>
              <dd>{settings.curriculum || '—'}</dd>
              <dt>{t('admin.certs.showScore')}</dt>
              <dd>{yes(settings.showScore)}</dd>
              <dt>{t('admin.certs.showQr')}</dt>
              <dd>{yes(settings.showQr)}</dd>
              <dt>{t('admin.certs.fullName')}</dt>
              <dd>{yes(settings.useFullName)}</dd>
              <dt>{t('admin.certs.activeDesign')}</dt>
              <dd>{t(`admin.certs.design.${data.design}` as MessageKey)}</dd>
            </dl>
          </div>
          <CertificateSheet
            data={{
              childName: t('admin.certSettings.sampleName'),
              bookTitle: t('admin.certSettings.sampleBook'),
              levels: 40,
              topics: 10,
              design: data.design,
              number: SAMPLE_NUMBER,
              issuedAt: new Date().toISOString(),
              averageScore: 92,
              settings,
              verifyUrl: settings.showQr ? verifyUrlOf(SAMPLE_NUMBER) : null,
            }}
          />
        </div>
      </Card>

      <Card title={t('admin.certs.designTitle')}>
        <ul className="cert-admin-designs">
          {CERTIFICATE_DESIGNS.map((d) => (
            <li key={d} className={`cert-admin-design${data.design === d ? ' is-on' : ''}`}>
              <CertificateSheet
                data={{
                  childName: t('admin.certSettings.sampleName'),
                  bookTitle: t('admin.certSettings.sampleBook'),
                  levels: 40,
                  topics: 10,
                  design: d,
                  number: null,
                  issuedAt: null,
                  settings,
                }}
              />
              <div className="cert-admin-design-row">
                <strong>{t(`admin.certs.design.${d}` as MessageKey)}</strong>
                {data.design === d ? (
                  <Badge tone="success">{t('admin.certs.designActive')}</Badge>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => void chooseDesign(d)}>
                    {t('admin.certs.designUse')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <section className="ui-card" aria-labelledby="certs-waiting">
        <header className="ui-card-head">
          <h2 id="certs-waiting">{t('admin.certs.waitingTitle')}</h2>
        </header>
        <p className="ui-muted">{t('admin.certs.waitingHint')}</p>
        {data.candidates.length === 0 ? (
          <Empty>{t('admin.certs.waitingNone')}</Empty>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th scope="col">{t('admin.certs.col.child')}</th>
                  <th scope="col">{t('admin.certs.col.parent')}</th>
                  <th scope="col">{t('admin.certs.col.book')}</th>
                  <th scope="col">{t('admin.certs.col.completed')}</th>
                  <th scope="col">{t('admin.certs.col.premium')}</th>
                  <th scope="col">{t('admin.certs.col.action')}</th>
                </tr>
              </thead>
              <tbody>
                {waiting.items.map((c) => (
                  <tr key={`${c.childId}:${c.bookSlug}`}>
                    <td>{c.childName}</td>
                    <td>{c.parentName}</td>
                    <td>{c.bookTitle}</td>
                    <td>{c.completedAt ? formatDateTime(c.completedAt) : '—'}</td>
                    <td>
                      <Badge tone={c.hasPremium ? 'success' : 'warning'}>
                        {c.hasPremium ? t('admin.certs.premiumOn') : t('admin.certs.premiumOff')}
                      </Badge>
                    </td>
                    <td>
                      <RowActions slots={[96]}>
                        <Button size="sm" onClick={() => void issue(c)}>
                          {t('admin.certs.issue')}
                        </Button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ListPager paged={waiting} />
      </section>

      <section className="ui-card" aria-labelledby="certs-list">
        <header className="ui-card-head">
          <h2 id="certs-list">{t('admin.certs.listTitle')}</h2>
        </header>
        <div className="certs-search">
          <TextField
            label={t('admin.certs.search')}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {data.certificates.length === 0 ? (
          <Empty>{t('admin.certs.none')}</Empty>
        ) : list.length === 0 ? (
          <Empty>{t('admin.certs.noMatch')}</Empty>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th scope="col">{t('admin.certs.col.number')}</th>
                  <th scope="col">{t('admin.certs.col.name')}</th>
                  <th scope="col">{t('admin.certs.col.parent')}</th>
                  <th scope="col">{t('admin.certs.col.book')}</th>
                  <th scope="col">{t('admin.certs.col.date')}</th>
                  <th scope="col">{t('admin.certs.col.design')}</th>
                  <th scope="col">{t('admin.certs.col.action')}</th>
                </tr>
              </thead>
              <tbody>
                {issued.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <code className="adm-code-small">{c.id}</code>
                      <small className="ui-muted dir-sub">
                        {t(`admin.certs.source.${c.source}` as MessageKey)}
                      </small>
                    </td>
                    <td>
                      {c.childName}
                      <small className="ui-muted dir-sub">
                        {usesFullName(c)
                          ? t('admin.certs.fullNameOf', { nickname: c.nickname ?? '' })
                          : t('admin.certs.nicknameUsed')}
                      </small>
                    </td>
                    <td>
                      {c.parentName}
                      <small className="ui-muted dir-sub">{c.parentEmail}</small>
                    </td>
                    <td>{c.bookTitle}</td>
                    <td className="adm-nowrap">{formatShortDate(c.issuedAt)}</td>
                    <td>{t(`admin.certs.design.${c.design}` as MessageKey)}</td>
                    <td>
                      <RowActions slots={[72, 88, 72]} label={`${c.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDownloadError(false);
                            setViewing(c);
                          }}
                        >
                          {t('admin.certs.view')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void refresh(c)}>
                          {t('admin.certs.refresh')}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setRemoving(c)}>
                          {t('admin.certs.delete')}
                        </Button>
                      </RowActions>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ListPager paged={issued} />
      </section>

      {viewing && viewingSheet && (
        <Dialog
          wide
          title={`${viewing.id} · ${viewing.childName}`}
          onClose={() => setViewing(undefined)}
        >
          <div className="uk-stack">
            <CertificateSheet data={viewingSheet} />
            <CertificatePrint data={viewingSheet} />
            {downloadError && <Notice tone="warning">{t('admin.certs.downloadError')}</Notice>}
            <div className="ui-row">
              <Button
                onClick={() =>
                  void downloadCertificateImage(viewingSheet).catch(() => setDownloadError(true))
                }
              >
                {t('admin.certs.download')}
              </Button>
              <Button variant="secondary" onClick={() => printCertificate(viewingSheet)}>
                {t('admin.certs.print')}
              </Button>
              <a
                className="ui-btn ui-btn-ghost"
                href={verifyUrlOf(viewing.id)}
                target="_blank"
                rel="noreferrer"
              >
                {t('admin.certs.verify')}
              </a>
              <Button variant="ghost" onClick={() => setViewing(undefined)}>
                {t('admin.certs.close')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {editing && (
        <CertificateSheetDialog
          design={data.design}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setMessage({ tone: 'success', text: t('admin.certSettings.saved') });
          }}
        />
      )}

      {removing && (
        <Dialog
          title={t('admin.certs.deleteTitle', { number: removing.id })}
          onClose={() => setRemoving(undefined)}
        >
          <div className="uk-stack">
            <p>
              {t('admin.certs.deleteText', { book: removing.bookTitle, name: removing.childName })}
            </p>
            <TextField
              label={t('admin.certs.deleteType')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <div className="ui-row">
              <Button
                variant="danger"
                disabled={confirm.trim().toLowerCase() !== t('admin.certs.deleteWord')}
                onClick={remove}
              >
                {t('admin.certs.delete')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRemoving(undefined);
                  setConfirm('');
                }}
              >
                {t('admin.certs.close')}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
