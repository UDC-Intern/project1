import { useEffect } from 'react';
import { speakAuto } from '../audio/speech';

/**
 * Bacakan `text` begitu halaman tampil (dan setiap kali teksnya berganti). `null` = tidak membacakan. Mengikuti pengaturan
 * "bacakan otomatis" di menu Audio Narasi.
 */
export function useAutoSpeak(text: string | null | undefined): void {
  useEffect(() => {
    if (text) speakAuto(text);
  }, [text]);
}
