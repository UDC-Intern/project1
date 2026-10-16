import { CERTIFICATE_NUMBER } from '@udakids/engine';
import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { verifyCertificate } from '../api/certificate';
import { useAsync } from '../hooks/useAsync';
import { useT } from '../i18n';
import { formatDate } from '../lib/format';
import { SiteNav } from './SiteNav';

/**
 * Cek keaslian sertifikat (publik, tujuan kode QR di lembar). Menampilkan buku, tanggal terbit, dan nama yang
 * disamarkan, sehingga cocok dengan lembar yang dipegang tanpa membuka nama lengkap anak.
 */
export function VerifyCertificate() {
  const t = useT('site');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(id);
  const load = useCallback(() => (id ? verifyCertificate(id) : Promise.resolve(null)), [id]);
  const { data, error, loading } = useAsync(load);
  const typed = input.trim().toUpperCase();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (typed) navigate(`/sertifikat/cek/${encodeURIComponent(typed)}`);
  }

  return (
    <div className="site">
      <SiteNav />
      <main className="site-section verify" aria-labelledby="verify-title">
        <h1 id="verify-title">{t('verify.title')}</h1>
        <p className="section-lead">{t('verify.lead')}</p>
        <form className="verify-form" onSubmit={submit}>
          <label htmlFor="verify-number">{t('verify.label')}</label>
          <div className="verify-row">
            <input
              id="verify-number"
              value={input}
              placeholder="CERT-XXXXXX"
              autoComplete="off"
              spellCheck={false}
              maxLength={20}
              onChange={(e) => setInput(e.target.value)}
            />
            <button type="submit" className="site-btn">
              {t('verify.check')}
            </button>
          </div>
          {typed && !CERTIFICATE_NUMBER.test(typed) && (
            <small className="verify-hint">{t('verify.format')}</small>
          )}
        </form>

        {id && loading && <p className="verify-hint">{t('verify.loading')}</p>}
        {id && error && (
          <section className="verify-card is-bad" role="status">
            <strong>{t('verify.notFound', { number: id.toUpperCase() })}</strong>
            <p>{t('verify.notFoundHint')}</p>
          </section>
        )}
        {data && (
          <section className="verify-card is-ok" role="status">
            <strong>
              <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                <path
                  d="M5 13l4 4L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {t('verify.valid', { issuer: data.issuer })}
            </strong>
            <dl>
              <dt>{t('verify.number')}</dt>
              <dd className="verify-mono">{data.id}</dd>
              <dt>{t('verify.name')}</dt>
              <dd>{data.name}</dd>
              <dt>{t('verify.book')}</dt>
              <dd>{data.bookTitle}</dd>
              <dt>{t('verify.achievement')}</dt>
              <dd>{t('verify.achievementValue', { levels: data.levels, topics: data.topics })}</dd>
              <dt>{t('verify.issued')}</dt>
              <dd>{formatDate(data.issuedAt)}</dd>
            </dl>
            <p className="verify-hint">{t('verify.privacy')}</p>
          </section>
        )}
      </main>
    </div>
  );
}
