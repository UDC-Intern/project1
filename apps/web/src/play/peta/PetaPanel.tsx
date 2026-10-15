import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { speak } from '../../audio/speech';
import { PlayIcon } from '../../components/Icons';
import { Momo } from '../../components/Momo';
import { t } from '../../i18n';
import { Stars, type NodeInfo } from './PetaBelajar';
import type { Shelf } from './types';

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 48 48" width="28" height="28" aria-hidden="true">
      <path d="M8 18h8l10-8v28l-10-8H8z" fill="currentColor" />
      <path
        d="M32 16c3 3 3 13 0 16M36 11c6 6 6 20 0 26"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true" className="peta-fact-icon">
      <path d="M24 5a14 14 0 0 0-8 25.5V36h16v-5.5A14 14 0 0 0 24 5z" />
      <path d="M18 41h12" />
    </svg>
  );
}

/**
 * Panel topik Peta Belajar: Momo membacakan pengantar topik, "Tahukah kamu?" dari hal penting topik, kemajuan
 * level, lalu "Mulai belajar" ke halaman topik. Bagian yang datanya belum ada tidak ditampilkan.
 */
export const PetaPanel = forwardRef<
  HTMLElement,
  {
    id: string;
    shelf: Shelf;
    info: NodeInfo;
    n: number;
    premium: boolean;
    momoColor: string;
  }
>(function PetaPanel({ id, shelf, info, n, premium, momoColor }, ref) {
  const locked = info.state === 'terkunci';
  const story = shelf.intro.trim();
  const facts = shelf.tips;

  return (
    <section
      ref={ref}
      id={id}
      className={`peta-panel is-${info.state}`}
      aria-label={t('play.peta.panel', { topic: shelf.title })}
    >
      <header className="peta-panel-head">
        <span className="peta-panel-num" aria-hidden="true">
          {n}
        </span>
        <h3>{shelf.title}</h3>
      </header>

      {story && (
        <div className="peta-story">
          <Momo own color={momoColor} mood="happy" size={76} />
          <div className="peta-bubble">
            <p>{story}</p>
            <button
              type="button"
              className="kid-btn secondary peta-listen"
              onClick={() => speak(story)}
            >
              <SpeakerIcon />
              {t('play.peta.listen')}
            </button>
          </div>
        </div>
      )}

      {facts.length > 0 && (
        <div className="peta-fact">
          <div className="peta-fact-head">
            <BulbIcon />
            <h4>{t('play.peta.fact')}</h4>
            <button
              type="button"
              className="peta-fact-say"
              aria-label={t('play.peta.factListen')}
              onClick={() => speak([t('play.peta.fact'), ...facts].join('. '))}
            >
              <SpeakerIcon />
            </button>
          </div>
          <ul>
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="peta-progress">
        <Stars n={info.stars} />
        <span>
          {locked && !info.paidNext
            ? t('play.peta.lockedNote')
            : t('play.peta.levels', { passed: info.passed, total: info.total })}
        </span>
      </div>
      {info.paidNext && !premium && (
        <p className="peta-paid" role="note">
          {t('play.library.paid')}
        </p>
      )}

      <Link className="kid-btn peta-start" to={shelf.href}>
        <PlayIcon />
        {t('play.peta.start')}
      </Link>
    </section>
  );
});
