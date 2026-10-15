import { useT } from '../i18n';
import { SpeakerIcon } from './Icons';

/**
 * Tombol dengar 64 px. Di M1 belum ada suara: tombol hanya memanggil onListen bila diberikan.
 * Suara sungguhan datang di M10 dengan klip dari server; bila gagal, tombol diam dan teks tetap tampil.
 */
export function ListenButton({ onListen }: { onListen?: () => void }) {
  const t = useT('play');
  return (
    <button
      type="button"
      className="uk-btn uk-btn--big uk-btn--ghost"
      aria-label={t('listen.aria')}
      onClick={onListen}
    >
      <SpeakerIcon size={28} />
      {t('listen')}
    </button>
  );
}
