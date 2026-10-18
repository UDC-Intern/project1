import { speak } from '../audio/speech';
import { useT } from '../i18n';
import { SpeakerIcon } from './Icons';

/**
 * Tombol dengar 64 px. Suara baru ada di M10 (klip dari server); sampai saat itu tombol hanya memanggil onListen.
 * Bila klip gagal, tombol diam dan teks tetap tampil.
 */
export function ListenButton({
  onListen,
  text,
  audioUrl,
}: {
  onListen?: () => void;
  text?: string;
  audioUrl?: string | null;
}) {
  const t = useT('play');
  return (
    <button
      type="button"
      className="speak-btn"
      aria-label={t('listen.aria')}
      onClick={() => (onListen ? onListen() : text ? speak(text, { audioUrl }) : undefined)}
    >
      <SpeakerIcon size={30} />
    </button>
  );
}
