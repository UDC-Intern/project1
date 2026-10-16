import { useEffect } from 'react';
import { speak } from '../audio/speech';

/** Tombol yang punya suara sendiri atau menjawab soal: tidak dibacakan labelnya. */
const SKIP =
  '.choice, .key, .speak-btn, .check-btn, .next-btn, .peta-stop, .peta-listen, .peta-fact-say, [data-silent]';

/**
 * Setiap tombol dan tautan di area anak membacakan namanya saat ditekan, supaya anak yang belum lancar membaca
 * tahu apa yang ia tekan. Satu pendengar untuk seluruh area, tanpa mengubah tiap tombol.
 */
export function TapVoice() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest<HTMLElement>('button, a, [role="button"]');
      if (!el || el.matches(SKIP) || el.closest(SKIP) === el) return;
      const label = (el.getAttribute('aria-label') ?? el.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      if (label && label.length <= 90) speak(label);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
