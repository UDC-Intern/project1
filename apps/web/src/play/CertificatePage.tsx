import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { certificate } from '../api/certificate';
import { BigButton } from '../components/BigButton';
import { Momo } from '../components/Momo';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDate } from '../lib/format';
import { ErrorState, LoadingState } from '../ui/states';

/** Sertifikat Juara Digital. Dicetak atau disimpan sebagai PDF lewat dialog cetak browser. */
export function CertificatePage() {
  const t = useT('play');
  const { bookSlug = '' } = useParams();
  const load = useCallback(() => certificate(bookSlug), [bookSlug]);
  const { data, error, loading, reload } = useAsync(load);

  if (loading) return <LoadingState />;
  if (error || !data)
    return (
      <div className="uk-stack">
        <ErrorState message={error?.message} onRetry={reload} />
        <Link className="uk-btn uk-btn--big uk-btn--ghost" to="/play/profil">
          {t('cert.back')}
        </Link>
      </div>
    );

  return (
    <div className="uk-stack">
      <section className="uk-certificate" aria-label={t('cert.title')}>
        <Momo mood="happy" size={96} />
        <p style={{ margin: 0 }}>{t('cert.title')}</p>
        <h1>{data.childName}</h1>
        <p style={{ margin: 0, fontSize: 'var(--uk-text-child)' }}>
          {t('cert.text', { book: data.bookTitle })}
        </p>
        <p style={{ margin: 0 }}>{formatDate(data.issuedAt)}</p>
      </section>
      <div className="uk-row uk-no-print">
        <BigButton onClick={() => window.print()}>{t('cert.print')}</BigButton>
        <Link className="uk-btn uk-btn--big uk-btn--ghost" to="/play/profil">
          {t('cert.back')}
        </Link>
      </div>
    </div>
  );
}
