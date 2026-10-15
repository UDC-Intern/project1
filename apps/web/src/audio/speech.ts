/**
 * Suara untuk anak yang belum lancar membaca. Memakai sintesis suara bawaan peramban (bahasa Indonesia).
 * Bila peramban tidak punya suara, tombol dengar tetap aman: tidak ada yang terjadi dan teks tetap tampil.
 */

type Synth = SpeechSynthesis;

const synth = (): Synth | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

export const speechAvailable = (): boolean => synth() !== null;

export function stopSpeaking(): void {
  try {
    synth()?.cancel();
  } catch {
    /* abaikan */
  }
}

/** Bacakan teks. Bacaan sebelumnya dihentikan lebih dulu. */
export function speak(text: string): void {
  const s = synth();
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!s || !clean || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'id-ID';
    u.rate = 0.9;
    u.pitch = 1.1;
    s.speak(u);
  } catch {
    /* abaikan */
  }
}
