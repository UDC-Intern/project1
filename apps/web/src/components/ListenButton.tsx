import { useT } from '../i18n';
import { SpeakerIcon } from './Icons';

/**
 * Tombol dengar 64 px. Suara baru ada di M10 (klip dari server); sampai saat itu tombol hanya memanggil onListen.
 * Bila klip gagal, tombol diam dan teks tetap tampil.
 */
export function ListenButton({ onListen }: { onListen?: () => void }) {
  const t = useT('play');
  return (
    <button type="button" className="speak-btn" aria-label={t('listen.aria')} onClick={onListen}>
      <SpeakerIcon size={30} />
    </button>
  );
}
