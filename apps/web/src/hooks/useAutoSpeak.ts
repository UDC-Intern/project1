import { useEffect } from 'react';
import { speak } from '../audio/speech';

/** Bacakan `text` begitu halaman tampil (dan setiap kali teksnya berganti). `null` = tidak membacakan. */
export function useAutoSpeak(text: string | null | undefined): void {
  useEffect(() => {
    if (text) speak(text);
  }, [text]);
}
