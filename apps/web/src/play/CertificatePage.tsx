import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { certificate } from '../api/certificate';
import { Momo } from '../components/Momo';
import { PageHead } from '../components/PageHead';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDate } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';
import { AutoSpeak } from './AutoSpeak';

/** Sertifikat Juara Digital. Dicetak atau disimpan sebagai PDF lewat dialog cetak browser. */
export function CertificatePage() {
  const t = useT('play');
  const { bookSlug = '' } = useParams();
  const load = useCallback(() => certificate(bookSlug), [bookSlug]);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data)
    return (
      <main className="kid-screen">
        <ErrorState message={error?.message} onRetry={reload} />
        <Link className="kid-btn" to="/play/profil">
          {t('cert.back')}
        </Link>
      </main>
    );

  return (
    <main className="library">
      <AutoSpeak text={`${t('cert.title')}. ${data.childName}`} />
      <PageHead title={t('cert.title')} back="/play/profil" />
      <section className="uk-certificate" aria-label={t('cert.title')}>
        <Momo mood="happy" size={110} />
        <p className="kid-say" style={{ margin: 0 }}>
          {t('cert.title')}
        </p>
        <h1>{data.childName}</h1>
        <p style={{ margin: 0, fontSize: '1.25rem' }}>{t('cert.text', { book: data.bookTitle })}</p>
        <p style={{ margin: 0 }}>{formatDate(data.issuedAt)}</p>
      </section>
      <div className="kid-row uk-no-print" style={{ marginTop: 20 }}>
        <button type="button" className="kid-btn big-play" onClick={() => window.print()}>
          {t('cert.print')}
        </button>
        <Link className="kid-btn secondary" to="/play/profil">
          {t('cert.back')}
        </Link>
      </div>
    </main>
  );
}
