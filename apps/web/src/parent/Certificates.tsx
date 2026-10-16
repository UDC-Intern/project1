import type { Certificate, CertificateBook, ParentCertificates } from '@udakids/engine';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { useApiCall, useFetch } from '../auth/useApi';
import { CertificatePrint, CertificateSheet } from '../components/certificate/CertificateSheet';
import {
  downloadCertificateImage,
  printCertificate,
  sheetDataOf,
} from '../components/certificate/sheet';
import { Momo } from '../components/Momo';
import { t } from '../i18n';
import { formatDate as formatDay } from '../lib/format';
import { Badge, Button, Card, Empty, Notice, PageHeader, Spinner } from '../ui/ui';

type Child = ParentCertificates['children'][number];

const STATUS_TONE: Record<CertificateBook['status'], 'success' | 'info' | 'warning' | 'muted'> = {
  issued: 'success',
  ready: 'info',
  premium_required: 'warning',
  not_finished: 'muted',
};

const statusText = (b: CertificateBook) =>
  b.status === 'not_finished'
    ? t('parent.cert.status.not_finished', { n: b.levelsTotal - b.levelsPassed })
    : t(`parent.cert.status.${b.status}`);

/** Sertifikat anak-anak: yang sudah terbit, kemajuan tiap buku, dan contoh lembar bila belum ada. */
export function CertificatesPage() {
  const { data, error, loading, reload } = useFetch<ParentCertificates>(
    'parent',
    '/parent/certificates',
  );
  const call = useApiCall('parent');
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string }>();
  const kids = data?.children ?? [];

  async function claim(child: Child, book: CertificateBook) {
    setBusy(`${child.id}:${book.bookSlug}`);
    setMessage(undefined);
    try {
      await call<Certificate>('/parent/certificates', {
        method: 'POST',
        body: { childId: child.id, bookSlug: book.bookSlug },
      });
      setMessage({
        tone: 'success',
        text: t('parent.cert.claimed', { book: book.bookTitle, name: child.nickname }),
      });
      reload();
    } catch (err) {
      setMessage({ tone: 'error', text: errorMessage(err) });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="cert-pa">
      <PageHeader title={t('parent.cert.title')} subtitle={t('parent.cert.subtitle')} />
      <Notice tone="info">
        <strong>{t('parent.cert.howTitle')}</strong>
        <ol className="cert-pa-steps">
          <li>{t('parent.cert.how1')}</li>
          <li>{t('parent.cert.how2')}</li>
          <li>{t('parent.cert.how3')}</li>
        </ol>
      </Notice>
      {kids.length > 0 && !kids.some((c) => c.hasPremium) && (
        <Notice tone="warning">
          <div className="pa-welcome">
            <span>{t('parent.cert.noPremium')}</span>
            <Link className="ui-btn ui-btn-primary" to="/orang-tua/paket">
              {t('parent.cert.seePackages')}
            </Link>
          </div>
        </Notice>
      )}
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {loading && !data ? (
        <Spinner label={t('parent.loading')} />
      ) : error ? (
        <Notice tone="error">
          {t('parent.cert.loadError')} {errorMessage(error)}{' '}
          <Button variant="ghost" onClick={reload}>
            {t('parent.dash.retry')}
          </Button>
        </Notice>
      ) : kids.length === 0 ? (
        <Empty>{t('parent.cert.noChildren')}</Empty>
      ) : (
        kids.map((child) => (
          <ChildCertificates
            key={child.id}
            child={child}
            busy={busy}
            onClaim={(book) => void claim(child, book)}
          />
        ))
      )}
    </div>
  );
}

/**
 * Kemajuan tiap buku menuju sertifikat, dengan tindakan yang sesuai. Tanpa `onClaim` (mis. di laporan anak),
 * sertifikat yang siap diterbitkan diarahkan ke halaman Sertifikat.
 */
export function CertificateBooks({
  child,
  busy,
  onClaim,
}: {
  child: Child;
  busy?: string | undefined;
  onClaim?: (book: CertificateBook) => void;
}) {
  return (
    <ul className="cert-pa-books">
      {child.books.map((b) => (
        <li key={b.bookSlug} className="cert-pa-book">
          <div className="cert-pa-book-name">
            <strong>{b.bookTitle}</strong>
            <span className="cert-pa-meter" aria-hidden>
              <span
                style={{ width: `${b.levelsTotal ? (b.levelsPassed / b.levelsTotal) * 100 : 0}%` }}
              />
            </span>
            <small>
              {t('parent.cert.levels', { passed: b.levelsPassed, total: b.levelsTotal })}
            </small>
          </div>
          <div className="cert-pa-book-actions">
            <Badge tone={STATUS_TONE[b.status]}>{statusText(b)}</Badge>
            {b.status === 'ready' &&
              (onClaim ? (
                <Button disabled={busy === `${child.id}:${b.bookSlug}`} onClick={() => onClaim(b)}>
                  {t('parent.cert.claim')}
                </Button>
              ) : (
                <Link className="ui-btn ui-btn-primary" to="/orang-tua/sertifikat">
                  {t('parent.cert.claim')}
                </Link>
              ))}
            {b.status === 'premium_required' && (
              <Link className="ui-btn ui-btn-secondary" to="/orang-tua/paket">
                {t('parent.cert.seePackages')}
              </Link>
            )}
            {b.certificate && (
              <Link
                className="ui-btn ui-btn-ghost"
                to={`/orang-tua/sertifikat/${b.certificate.id}`}
              >
                {t('parent.cert.view')}
              </Link>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ChildCertificates({
  child,
  busy,
  onClaim,
}: {
  child: Child;
  busy: string | undefined;
  onClaim: (book: CertificateBook) => void;
}) {
  const issued = child.books.flatMap((b) => (b.certificate ? [b.certificate] : []));
  // Contoh lembar: buku dengan kemajuan terbanyak yang belum bersertifikat.
  const sample = [...child.books]
    .filter((b) => !b.certificate)
    .sort((a, b) => b.levelsPassed / b.levelsTotal - a.levelsPassed / a.levelsTotal)[0];

  return (
    <Card
      title={
        <span className="cert-pa-child-head">
          <Momo color={child.momoColor} mood="happy" size={36} />
          {child.nickname}
        </span>
      }
    >
      <div className="cert-pa-child">
        <h3>{t('parent.cert.issuedTitle')}</h3>
        {issued.length === 0 ? (
          <Empty>{t('parent.cert.noneIssued', { name: child.nickname })}</Empty>
        ) : (
          <ul className="cert-pa-grid">
            {issued.map((c) => (
              <li key={c.id} className="cert-pa-card">
                <CertificateSheet data={sheetDataOf(c)} />
                <div className="cert-pa-card-meta">
                  <strong>{c.bookTitle}</strong>
                  <span>
                    <span className="pa-mono">{c.id}</span> · {formatDay(c.issuedAt)}
                  </span>
                </div>
                <Link className="ui-btn ui-btn-primary" to={`/orang-tua/sertifikat/${c.id}`}>
                  {t('parent.cert.view')}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <h3>{t('parent.cert.progressTitle')}</h3>
        <CertificateBooks child={child} busy={busy} onClaim={onClaim} />

        {issued.length === 0 && sample && (
          <figure className="cert-pa-sample">
            <figcaption>
              <strong>{t('parent.cert.sampleTitle')}</strong>
              <br />
              <span className="ui-muted">
                {t('parent.cert.sampleHint', { name: child.nickname })}
              </span>
            </figcaption>
            <CertificateSheet
              data={{
                childName: child.nickname,
                bookTitle: sample.bookTitle,
                levels: sample.levelsTotal,
                topics: sample.topicsTotal,
                design: sample.design,
                number: null,
                issuedAt: null,
              }}
            />
          </figure>
        )}
      </div>
    </Card>
  );
}

/** Satu sertifikat: lembar penuh, unduh gambar, cetak atau simpan PDF, dan keterangan. */
export function CertificateView() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useFetch<Certificate>(
    'parent',
    `/parent/certificates/${encodeURIComponent(id)}`,
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  const back = (
    <Link className="ui-btn ui-btn-secondary" to="/orang-tua/sertifikat">
      {t('parent.cert.back')}
    </Link>
  );
  if (loading && !data) return <Spinner label={t('parent.loading')} />;
  if (error || !data)
    return (
      <div className="cert-pa">
        <PageHeader title={t('parent.cert.title')} actions={back} />
        <Notice tone="error">
          {t('parent.cert.loadError')} {errorMessage(error)}{' '}
          <Button variant="ghost" onClick={reload}>
            {t('parent.dash.retry')}
          </Button>
        </Notice>
      </div>
    );

  const sheet = sheetDataOf(data);
  async function download() {
    setDownloading(true);
    setDownloadError(false);
    try {
      await downloadCertificateImage(sheet);
    } catch {
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="cert-pa-view">
      <PageHeader
        title={`${data.childName} · ${data.bookTitle}`}
        subtitle={t('parent.cert.viewSubtitle')}
        actions={back}
      />
      <div className="cert-pa-view-sheet">
        <CertificateSheet data={sheet} />
      </div>
      <CertificatePrint data={sheet} />
      <div className="ui-row">
        <Button disabled={downloading} onClick={() => void download()}>
          {downloading ? t('parent.cert.downloading') : t('parent.cert.download')}
        </Button>
        <Button variant="secondary" onClick={() => printCertificate(sheet)}>
          {t('parent.cert.print')}
        </Button>
      </div>
      <p className="ui-hint">{t('parent.cert.printHint')}</p>
      {downloadError && <Notice tone="warning">{t('parent.cert.downloadError')}</Notice>}
      <Card title={t('parent.cert.detail')}>
        <dl className="cert-pa-facts">
          <dt>{t('parent.cert.number')}</dt>
          <dd className="pa-mono">{data.id}</dd>
          <dt>{t('parent.cert.child')}</dt>
          <dd>{data.childName}</dd>
          <dt>{t('parent.cert.book')}</dt>
          <dd>{data.bookTitle}</dd>
          <dt>{t('parent.cert.issuedAt')}</dt>
          <dd>{formatDay(data.issuedAt)}</dd>
          <dt>{t('parent.cert.sourceLabel')}</dt>
          <dd>{t(`parent.cert.source.${data.source}`)}</dd>
        </dl>
      </Card>
    </div>
  );
}
