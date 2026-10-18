/**
 * Suara untuk anak yang belum lancar membaca. Memakai sintesis suara bawaan peramban (bahasa Indonesia).
 * Suara diputar langsung, tanpa jeda. Peramban hanya mengizinkan suara setelah halaman pernah diketuk, jadi
 * bacaan yang diminta sebelum itu ditahan dan diputar pada ketukan pertama.
 * Bila peramban tidak punya suara, tombol dengar tetap aman: tidak ada yang terjadi dan teks tetap tampil.
 * Kecepatan, nada, suara yang diutamakan, dan sakelar suara diatur admin di menu Audio Narasi (pengaturan `voice`).
 * Simbol matematika (> < = + - × ÷) diganti kata bahasa Indonesia sebelum dibacakan (`speakableText`), karena mesin
 * suara peramban biasanya melewatkannya.
 */

import { DEFAULT_SETTINGS, speakableText, type VoiceSettings } from '@udakids/engine';
import { currentSettings } from '../api/settings';
import { assetUrl } from '../api/media';

type Synth = SpeechSynthesis;

/** Pengaturan suara yang berlaku; bila belum bisa dibaca, nilai awal. */
function voiceSettings(): VoiceSettings {
  try {
    return currentSettings().voice;
  } catch {
    return DEFAULT_SETTINGS.voice;
  }
}

const synth = (): Synth | null =>
  typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let touched = false;
let pending: {
  text: string;
  onEnd: (() => void) | undefined;
  voice: VoiceSettings;
  audioUrl?: string | null;
} | null = null;
let playing: HTMLAudioElement | null = null;

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
  playing?.pause();
  playing = null;
  try {
    synth()?.cancel();
  } catch {
    /* abaikan */
  }
}

/** Kode bahasa Indonesia di suara peramban: "id-ID", "id_ID", atau kode lama "in-ID" (sebagian peramban Android). */
const isIndonesian = (lang: string) => /^(id|in|ind)([-_]|$)/i.test(lang);

/** Suara bahasa Indonesia yang tersedia di peramban ini (untuk pilihan di menu Audio Narasi), tanpa nama kembar. */
export function indonesianVoices(): { name: string; lang: string }[] {
  try {
    const s = synth();
    const seen = new Set<string>();
    return (s ? voicesOf(s) : [])
      .filter((v) => isIndonesian(v.lang) && !seen.has(v.name) && !!seen.add(v.name))
      .map((v) => ({ name: v.name, lang: v.lang }));
  } catch {
    return [];
  }
}

const VOICE_POLL_MS = 250;
const VOICE_POLLS = 20;

/**
 * Peramban memuat daftar suara secara tak serempak: panggilan `getVoices()` pertama sering kosong, dan `voiceschanged`
 * hanya terjadi sekali dalam hitungan milidetik, kadang sebelum halaman sempat mendengarkan. Maka `onChange` dipanggil
 * sekarang, setiap kali `voiceschanged`, dan tiap 250 ms selama 5 detik pertama; pemanggil membaca ulang daftarnya.
 * Mengembalikan fungsi untuk berhenti.
 */
export function watchVoices(onChange: () => void): () => void {
  const s = synth();
  if (!s) return () => undefined;
  s.addEventListener?.('voiceschanged', onChange);
  onChange();
  let n = 0;
  const timer = window.setInterval(() => {
    onChange();
    if (++n >= VOICE_POLLS) window.clearInterval(timer);
  }, VOICE_POLL_MS);
  return () => {
    s.removeEventListener?.('voiceschanged', onChange);
    window.clearInterval(timer);
  };
}

/** Daftar suara peramban; peramban lama tanpa getVoices dianggap tidak punya pilihan suara. */
const voicesOf = (s: Synth): SpeechSynthesisVoice[] =>
  typeof s.getVoices === 'function' ? s.getVoices() : [];

function pickVoice(s: Synth, name: string): SpeechSynthesisVoice | undefined {
  const voices = voicesOf(s);
  return (
    (name ? voices.find((v) => v.name === name) : undefined) ??
    voices.find((v) => isIndonesian(v.lang))
  );
}

function say(
  text: string,
  voice: VoiceSettings,
  onEnd?: () => void,
  audioUrl?: string | null,
): void {
  playing?.pause();
  playing = null;
  if (audioUrl && typeof Audio !== 'undefined') {
    synth()?.cancel();
    const audio = new Audio(assetUrl(audioUrl));
    playing = audio;
    audio.onended = () => {
      if (playing === audio) playing = null;
      onEnd?.();
    };
    void audio.play().catch(() => {
      if (playing === audio) playing = null;
    });
    return;
  }
  const s = synth();
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return;
  try {
    s.cancel();
    const u = new SpeechSynthesisUtterance(speakableText(text));
    u.lang = 'id-ID';
    u.rate = voice.rate;
    u.pitch = voice.pitch;
    const chosen = pickVoice(s, voice.voiceName);
    if (chosen) u.voice = chosen;
    if (onEnd) u.onend = onEnd;
    s.speak(u);
  } catch {
    /* abaikan */
  }
}

export type SpeakOptions = {
  audioUrl?: string | null;
  onEnd?: () => void;
  /** Pratinjau admin: pakai nilai ini dan abaikan sakelar "suara aktif". */
  voice?: VoiceSettings;
};

/** Bacakan teks segera. Bacaan sebelumnya dihentikan. `onEnd` dipanggil setelah selesai. */
export function speak(text: string, opts: SpeakOptions = {}): void {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return;
  const voice = opts.voice ?? voiceSettings();
  if (!opts.voice && !voice.enabled) return;
  if (!ready()) {
    pending = { text: clean, onEnd: opts.onEnd, voice, audioUrl: opts.audioUrl };
    return;
  }
  say(clean, voice, opts.onEnd, opts.audioUrl);
}

/** Bacaan otomatis saat halaman atau soal tampil; mati bila admin mematikan "bacakan otomatis". */
export function speakAuto(text: string, audioUrl?: string | null): void {
  if (voiceSettings().autoRead) speak(text, { audioUrl });
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
      say(p.text, p.voice, p.onEnd, p.audioUrl);
    }
  };
  for (const ev of events) window.addEventListener(ev, unlock, { capture: true, passive: true });
}
