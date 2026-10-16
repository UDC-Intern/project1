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
} from '../api/admin';
import { ApiError } from '../api/client';
import { useSettings } from '../api/settings';
import { CertificatePrint, CertificateSheet } from '../components/certificate/CertificateSheet';
import {
  downloadCertificateImage,
  printCertificate,
  sheetDataOf,
} from '../components/certificate/sheet';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDate, formatDateTime } from '../lib/format';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingState } from '../ui/states';
import { PageHeader } from '../ui/ui';

const thisMonth = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

/**
 * Sertifikat di panel admin: sistem terbit otomatis, desain yang dipakai, anak yang menunggu (lulus semua level
 * tetapi belum terbit), dan semua sertifikat yang terbit (lihat, unduh, perbarui, hapus).
 */
export function AdminCertificatesPage() {
  const t = useT('admin');
  const load = useCallback(() => certificates(), []);
  const { data, error, loading, reload } = useAsync(load);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminCertificate | null>(null);
  const [removing, setRemoving] = useState<AdminCertificate | null>(null);
  const [confirm, setConfirm] = useState('');
  const [downloadError, setDownloadError] = useState(false);
  const settings = useSettings().certificate;
  const viewingSheet = viewing ? sheetDataOf(viewing, settings) : null;

  async function run(action: () => Promise<string>) {
    setMessage(null);
    try {
      setMessage(await action());
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : t('error.generic'));
    }
  }

  const issue = (c: CertificateCandidate) =>
    run(async () => {
      const cert = await issueCertificate({ childId: c.childId, bookSlug: c.bookSlug });
      return t('cert.issued', { number: cert.id, name: cert.childName });
    });
  const refresh = (c: AdminCertificate) =>
    run(async () => {
      await refreshCertificate(c.id);
      return t('cert.refreshed', { number: c.id });
    });
  const chooseDesign = (design: CertificateDesign) =>
    run(async () => {
      await setCertificateDesign(design);
      return t('cert.designSaved', { name: t(`cert.design.${design}`) });
    });
  const remove = () => {
    const target = removing;
    if (!target) return;
    setRemoving(null);
    setConfirm('');
    void run(async () => {
      await deleteCertificate(target.id);
      return t('cert.deleted', { number: target.id });
    });
  };

  const q = query.trim().toLowerCase();
  const list = (data?.certificates ?? []).filter(
    (c) =>
      !q ||
      [c.id, c.childName, c.parentName, c.parentEmail, c.bookTitle].some((v) =>
        v.toLowerCase().includes(q),
      ),
  );

  return (
    <div className="uk-stack">
      <PageHeader title={t('cert.title')} subtitle={t('cert.subtitle')} />

      <section className="cert-admin-banner" aria-labelledby="cert-auto-title">
        <h2 id="cert-auto-title">{t('cert.autoTitle')}</h2>
        <ul>
          <li>{t('cert.auto1')}</li>
          <li>{t('cert.auto2')}</li>
          <li>{t('cert.auto3')}</li>
        </ul>
      </section>

      {message && <p role="status">{message}</p>}
      {loading && !data && <LoadingState />}
      {error && <ErrorState onRetry={reload} />}

      {data && (
        <>
          <div className="uk-stats">
            <div className="uk-stat">
              <strong>{data.certificates.length}</strong>
              {t('cert.statIssued')}
            </div>
            <div className="uk-stat">
              <strong>{data.candidates.length}</strong>
              {t('cert.statWaiting')}
            </div>
            <div className="uk-stat">
              <strong>{data.certificates.filter((c) => thisMonth(c.issuedAt)).length}</strong>
              {t('cert.statMonth')}
            </div>
          </div>

          <section className="uk-stack" aria-labelledby="cert-design-title">
            <h2 id="cert-design-title">{t('cert.designTitle')}</h2>
            <ul className="cert-admin-designs">
              {CERTIFICATE_DESIGNS.map((d) => (
                <li key={d} className={`cert-admin-design${data.design === d ? ' is-on' : ''}`}>
                  <CertificateSheet
                    data={{
                      childName: t('cert.sampleName'),
                      bookTitle: 'Matematika Kelas 1',
                      levels: 40,
                      topics: 10,
                      design: d,
                      number: null,
                      issuedAt: null,
                      settings,
                    }}
                  />
                  <div className="cert-admin-design-row">
                    <strong>{t(`cert.design.${d}`)}</strong>
                    {data.design === d ? (
                      <span className="uk-badge">{t('cert.designActive')}</span>
                    ) : (
                      <button
                        type="button"
                        className="uk-btn uk-btn--ghost"
                        onClick={() => void chooseDesign(d)}
                      >
                        {t('cert.designUse')}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="uk-stack" aria-labelledby="cert-waiting-title">
            <h2 id="cert-waiting-title">{t('cert.waitingTitle')}</h2>
            {data.candidates.length === 0 ? (
              <p>{t('cert.waitingNone')}</p>
            ) : (
              <div className="uk-table-wrap">
                <table className="uk-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('cert.col.child')}</th>
                      <th scope="col">{t('cert.col.parent')}</th>
                      <th scope="col">{t('cert.col.book')}</th>
                      <th scope="col">{t('cert.col.completed')}</th>
                      <th scope="col">{t('cert.col.premium')}</th>
                      <th scope="col">{t('cert.col.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.candidates.map((c) => (
                      <tr key={`${c.childId}:${c.bookSlug}`}>
                        <td>{c.childName}</td>
                        <td>{c.parentName}</td>
                        <td>{c.bookTitle}</td>
                        <td>{c.completedAt ? formatDateTime(c.completedAt) : '-'}</td>
                        <td>{c.hasPremium ? t('cert.premiumOn') : t('cert.premiumOff')}</td>
                        <td>
                          <button type="button" className="uk-btn" onClick={() => void issue(c)}>
                            {t('cert.issue')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="uk-stack" aria-labelledby="cert-list-title">
            <h2 id="cert-list-title">{t('cert.listTitle')}</h2>
            <label className="uk-field" style={{ maxWidth: 420 }}>
              {t('cert.search')}
              <input value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            {data.certificates.length === 0 ? (
              <p>{t('cert.none')}</p>
            ) : list.length === 0 ? (
              <p>{t('cert.noMatch')}</p>
            ) : (
              <div className="uk-table-wrap">
                <table className="uk-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('cert.col.number')}</th>
                      <th scope="col">{t('cert.col.child')}</th>
                      <th scope="col">{t('cert.col.parent')}</th>
                      <th scope="col">{t('cert.col.book')}</th>
                      <th scope="col">{t('cert.col.date')}</th>
                      <th scope="col">{t('cert.col.design')}</th>
                      <th scope="col">{t('cert.col.source')}</th>
                      <th scope="col">{t('cert.col.action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <code className="cert-admin-num">{c.id}</code>
                        </td>
                        <td>{c.childName}</td>
                        <td>
                          {c.parentName}
                          <br />
                          <small>{c.parentEmail}</small>
                        </td>
                        <td>{c.bookTitle}</td>
                        <td>{formatDate(c.issuedAt)}</td>
                        <td>{t(`cert.design.${c.design}`)}</td>
                        <td>{t(`cert.source.${c.source}`)}</td>
                        <td>
                          <div className="uk-row">
                            <button
                              type="button"
                              className="uk-btn uk-btn--ghost"
                              onClick={() => {
                                setDownloadError(false);
                                setViewing(c);
                              }}
                            >
                              {t('cert.view')}
                            </button>
                            <button
                              type="button"
                              className="uk-btn uk-btn--ghost"
                              onClick={() => void refresh(c)}
                            >
                              {t('cert.refresh')}
                            </button>
                            <button
                              type="button"
                              className="uk-btn uk-btn--danger"
                              onClick={() => setRemoving(c)}
                            >
                              {t('cert.delete')}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {viewing && viewingSheet && (
        <Dialog
          wide
          title={`${viewing.id} · ${viewing.childName}`}
          onClose={() => setViewing(null)}
        >
          <div className="uk-stack">
            <CertificateSheet data={viewingSheet} />
            <CertificatePrint data={viewingSheet} />
            {downloadError && <p role="alert">{t('cert.downloadError')}</p>}
            <div className="uk-row">
              <button
                type="button"
                className="uk-btn"
                onClick={() =>
                  void downloadCertificateImage(viewingSheet).catch(() => setDownloadError(true))
                }
              >
                {t('cert.download')}
              </button>
              <button
                type="button"
                className="uk-btn uk-btn--ghost"
                onClick={() => printCertificate(viewingSheet)}
              >
                {t('cert.print')}
              </button>
              <button
                type="button"
                className="uk-btn uk-btn--ghost"
                onClick={() => setViewing(null)}
              >
                {t('cert.close')}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {removing && (
        <Dialog
          title={t('cert.deleteTitle', { number: removing.id })}
          onClose={() => setRemoving(null)}
        >
          <div className="uk-stack">
            <p>{t('cert.deleteText', { book: removing.bookTitle, name: removing.childName })}</p>
            <label className="uk-field">
              {t('cert.deleteType')}
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </label>
            <div className="uk-row">
              <button
                type="button"
                className="uk-btn uk-btn--danger"
                disabled={confirm.trim().toLowerCase() !== t('cert.deleteWord')}
                onClick={remove}
              >
                {t('cert.delete')}
              </button>
              <button
                type="button"
                className="uk-btn uk-btn--ghost"
                onClick={() => {
                  setRemoving(null);
                  setConfirm('');
                }}
              >
                {t('cert.close')}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
