import { speak } from '../audio/speech';
import { t } from '../i18n';

/** Tombol dengar: membacakan `text` dengan suara bawaan peramban. */
export function SpeakButton({
  text,
  label,
  onSpeak,
}: {
  text: string;
  label?: string;
  onSpeak?: () => void;
}) {
  return (
    <button
      type="button"
      className="speak-btn"
      aria-label={label ?? t('play.listen')}
      onClick={() => (onSpeak ? onSpeak() : speak(text))}
    >
      <svg viewBox="0 0 48 48" width="36" height="36" aria-hidden="true">
        <path d="M8 18h8l10-8v28l-10-8H8z" fill="currentColor" />
        <path
          d="M32 16c3 3 3 13 0 16M36 11c6 6 6 20 0 26"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
