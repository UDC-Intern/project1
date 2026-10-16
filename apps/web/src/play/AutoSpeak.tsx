import { useAutoSpeak } from '../hooks/useAutoSpeak';

/** Membacakan `text` begitu tampil. Dipakai di halaman yang punya pengembalian dini (memuat, galat). */
export function AutoSpeak({ text }: { text: string }) {
  useAutoSpeak(text);
  return null;
}
