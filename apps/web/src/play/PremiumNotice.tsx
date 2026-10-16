import { FREE_LEVELS } from '@udakids/engine';
import { t } from '../i18n';
import { SpeakButton } from './SpeakButton';

/** Alamat halaman orang tua di domain yang sedang dipakai, mis. localhost:6007/orang-tua/paket. */
const parentUrl = (path: string) =>
  `${typeof window !== 'undefined' ? window.location.host : ''}/orang-tua${path}`;

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="kid-alert-icon">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path
        d="M12 7.2v.1M12 10.5v6.3"
        stroke="var(--kertas)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Info level Premium untuk anak: tanpa harga dan tanpa tombol beli, hanya penjelasan untuk anak dan langkah
 * yang ditujukan ke Ayah atau Bunda. Muncul setelah level gratis di topik itu selesai.
 */
export function PremiumNotice({ compact = false }: { compact?: boolean }) {
  const say = t('play.premium.say', { n: FREE_LEVELS + 1 });
  return (
    <section className={`kid-alert${compact ? ' is-compact' : ''}`} role="note">
      <div className="kid-alert-head">
        <InfoIcon />
        <strong>{t('play.premium.title', { n: FREE_LEVELS + 1 })}</strong>
        <SpeakButton text={say} />
      </div>
      <p>{t('play.premium.kid', { free: FREE_LEVELS })}</p>
      {!compact && (
        <div className="kid-alert-parent">
          <strong>{t('play.premium.parentTitle')}</strong>
          <ol>
            <li>{t('play.premium.stepLogin', { url: parentUrl('') })}</li>
            <li>{t('play.premium.stepPackage', { url: parentUrl('/paket') })}</li>
            <li>{t('play.premium.stepDone')}</li>
          </ol>
        </div>
      )}
    </section>
  );
}
