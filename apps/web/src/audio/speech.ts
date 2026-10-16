/**
 * Suara untuk anak yang belum lancar membaca. Memakai sintesis suara bawaan peramban (bahasa Indonesia).
 * Suara diputar langsung, tanpa jeda. Peramban hanya mengizinkan suara setelah halaman pernah diketuk, jadi
 * bacaan yang diminta sebelum itu ditahan dan diputar pada ketukan pertama.
 * Bila peramban tidak punya suara, tombol dengar tetap aman: tidak ada yang terjadi dan teks tetap tampil.
 */

type Synth = SpeechSynthesis;

const synth = (): Synth | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let touched = false;
let pending: { text: string; onEnd: (() => void) | undefined } | null = null;

/** Halaman sudah pernah diketuk atau ditekan tombolnya? */
function ready(): boolean {
  if (touched) return true;
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  return (
    (nav as (Navigator & { userActivation?: { hasBeenActive: boolean } }) | undefined)
      ?.userActivation?.hasBeenActive === true
  );
}

export function stopSpeaking(): void {
  pending = null;
  try {
    synth()?.cancel();
  } catch {
    /* abaikan */
  }
}

function say(text: string, onEnd?: () => void): void {
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'id-ID';
    u.rate = 0.92;
    u.pitch = 1.1;
    if (onEnd) u.onend = onEnd;
    s.speak(u);
  } catch {
    /* abaikan */
  }
}

/** Bacakan teks segera. Bacaan sebelumnya dihentikan. `onEnd` dipanggil setelah selesai. */
export function speak(text: string, opts: { onEnd?: () => void } = {}): void {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;
  if (!ready()) {
    pending = { text: clean, onEnd: opts.onEnd };
    return;
  }
  say(clean, opts.onEnd);
}

/** Pasang sekali: ketukan atau tombol pertama membuka suara dan memutar bacaan yang tertahan. */
export function installAudioUnlock(): void {
  if (typeof window === 'undefined') return;
  const events = ['pointerdown', 'touchend', 'keydown'] as const;
  const unlock = () => {
    for (const ev of events) window.removeEventListener(ev, unlock, true);
    touched = true;
    if (pending) {
      const p = pending;
      pending = null;
      say(p.text, p.onEnd);
    }
  };
  for (const ev of events) window.addEventListener(ev, unlock, { capture: true, passive: true });
}
