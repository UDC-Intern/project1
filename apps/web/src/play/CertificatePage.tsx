import type { CertificateBook } from '@udakids/engine';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { claimCertificate, myCertificate } from '../api/certificate';
import { useSettings } from '../api/settings';
import { useSession } from '../auth/store';
import { CertificatePrint, CertificateSheet } from '../components/certificate/CertificateSheet';
import { printCertificate, sheetDataOf, type SheetData } from '../components/certificate/sheet';
import { MedalIcon, PlayIcon, PrintIcon } from '../components/Icons';
import { Momo } from '../components/Momo';
import { PageHead } from '../components/PageHead';
import { useAsync } from '../hooks/useAsync';
import { t as tt, useT } from '../i18n';
import { ErrorState, LoadingState } from '../ui/states';
import { AutoSpeak } from './AutoSpeak';
import { rememberBook } from './libraryChoice';
import { SpeakButton } from './SpeakButton';

/** Alamat halaman orang tua di domain yang sedang dipakai. */
const parentUrl = (path: string) =>
  `${typeof window !== 'undefined' ? window.location.host : ''}/orang-tua${path}`;

/** Bilah kemajuan level buku menuju sertifikat. */
export function CertProgress({ passed, total }: { passed: number; total: number }) {
  const t = useT('play');
  return (
    <div className="cert-kid-progress">
      <span className="cert-kid-bar" aria-hidden="true">
        <span style={{ width: `${total ? (passed / total) * 100 : 0}%` }} />
      </span>
      <strong>{t('cert.progress', { passed, total })}</strong>
    </div>
  );
}

/**
 * Sertifikat Juara Digital satu buku untuk anak. Empat keadaan: sudah terbit (lembar + cetak), siap diambil
 * (buku tuntas, Premium aktif), perlu Premium (tanpa harga, langkah untuk orang tua), atau belum tuntas
 * (kemajuan level + contoh lembar).
 */
export function CertificatePage() {
  const t = useT('play');
  const { bookSlug = '' } = useParams();
  const name = useSession((s) => s.session?.name ?? '');
  const settings = useSettings().certificate;
  const load = useCallback(() => myCertificate(bookSlug), [bookSlug]);
  const { data, error, loading, reload } = useAsync(load);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  if (loading && !data) return <LoadingState />;
  if (error || !data)
    return (
      <main className="kid-screen">
        <ErrorState message={error?.message} onRetry={reload} />
        <Link className="kid-btn" to="/play">
          {t('cert.back')}
        </Link>
      </main>
    );

  async function claim() {
    setClaiming(true);
    setClaimError(null);
    try {
      await claimCertificate(bookSlug);
      reload();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : null);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <main
      className="library cert-kid"
      data-mapel={data.subject === 'science' ? 'sains' : 'matematika'}
    >
      <PageHead title={t('cert.title')} sub={data.bookTitle} back="/play" />
      {data.certificate ? (
        <Issued sheet={sheetDataOf(data.certificate, settings)} />
      ) : data.status === 'not_finished' ? (
        <NotFinished data={data} name={name} />
      ) : (
        <section className="cert-kid-card is-done">
          <AutoSpeak
            text={`${t('cert.doneTitle')} ${data.status === 'ready' ? t('cert.readyText') : t('cert.premiumText')}`}
          />
          <Momo mood="proud" size={110} />
          <h1>{t('cert.doneTitle')}</h1>
          <CertProgress passed={data.levelsPassed} total={data.levelsTotal} />
          {data.status === 'ready' ? (
            <>
              <div className="kid-say">
                <SpeakButton text={t('cert.readyText')} />
                <p>{t('cert.readyText')}</p>
              </div>
              <button
                type="button"
                className="kid-btn big-play"
                disabled={claiming}
                onClick={() => void claim()}
              >
                <MedalIcon size={28} />
                {t('cert.claim')}
              </button>
              {claimError && <p className="kid-note">{claimError}</p>}
            </>
          ) : (
            <section className="kid-alert" role="note">
              <div className="kid-alert-head">
                <MedalIcon size={28} />
                <strong>{t('cert.premiumText')}</strong>
                <SpeakButton text={t('cert.premiumText')} />
              </div>
              <div className="kid-alert-parent">
                <strong>{tt('play.premium.parentTitle')}</strong>
                <ol>
                  <li>{tt('play.premium.stepLogin', { url: parentUrl('') })}</li>
                  <li>{tt('play.premium.stepPackage', { url: parentUrl('/paket') })}</li>
                  <li>{t('cert.premiumStep')}</li>
                </ol>
              </div>
            </section>
          )}
        </section>
      )}
    </main>
  );
}

function Issued({ sheet }: { sheet: SheetData }) {
  const t = useT('play');
  return (
    <>
      <AutoSpeak text={t('cert.issuedSay', { name: sheet.childName, book: sheet.bookTitle })} />
      <div className="cert-kid-sheet">
        <CertificateSheet data={sheet} />
      </div>
      <CertificatePrint data={sheet} />
      <div className="kid-row cert-kid-actions">
        <button type="button" className="kid-btn big-play" onClick={() => printCertificate(sheet)}>
          <PrintIcon size={26} />
          {t('cert.print')}
        </button>
        <Link className="kid-btn secondary" to="/play">
          {t('cert.back')}
        </Link>
      </div>
    </>
  );
}

function NotFinished({ data, name }: { data: CertificateBook; name: string }) {
  const settings = useSettings().certificate;
  const t = useT('play');
  const say = t('cert.progressSay', { passed: data.levelsPassed, total: data.levelsTotal });
  return (
    <>
      <AutoSpeak text={say} />
      <section className="cert-kid-card">
        <Momo mood="happy" size={96} />
        <div className="kid-say">
          <SpeakButton text={say} />
          <p>{t('cert.keepGoing')}</p>
        </div>
        <CertProgress passed={data.levelsPassed} total={data.levelsTotal} />
        <Link
          className="kid-btn big-play"
          to="/play"
          onClick={() => rememberBook(data.bookSlug, data.grade)}
        >
          <PlayIcon size={26} />
          {t('cert.learn')}
        </Link>
      </section>
      <p className="cert-kid-note">{t('cert.sampleNote')}</p>
      <div className="cert-kid-sheet is-sample">
        <CertificateSheet
          data={{
            childName: name,
            bookTitle: data.bookTitle,
            levels: data.levelsTotal,
            topics: data.topicsTotal,
            design: data.design,
            number: null,
            issuedAt: null,
            settings,
          }}
        />
      </div>
    </>
  );
}
