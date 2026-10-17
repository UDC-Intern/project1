import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NarrationPage } from '../src/admin/media/NarrationPage';
import { readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import {
  indonesianVoices,
  installAudioUnlock,
  speak,
  speakAuto,
  watchVoices,
} from '../src/audio/speech';
import { useSession } from '../src/auth/store';

const said: { text: string; rate: number; pitch: number }[] = [];

beforeEach(() => {
  resetMockDb();
  said.length = 0;
  class Utterance {
    rate = 1;
    pitch = 1;
    lang = '';
    constructor(public text: string) {}
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: Utterance,
    configurable: true,
  });
  Object.defineProperty(window, 'speechSynthesis', {
    value: {
      cancel: () => undefined,
      speak: (u: { text: string; rate: number; pitch: number }) =>
        said.push({ text: u.text, rate: u.rate, pitch: u.pitch }),
    },
    configurable: true,
  });
  installAudioUnlock();
  window.dispatchEvent(new Event('pointerdown'));
});

function setVoice(patch: Partial<ReturnType<typeof readDb>['settings']['voice']>) {
  const db = readDb();
  db.settings.voice = { ...db.settings.voice, ...patch };
  writeDb(db);
}

describe('simbol matematika dibacakan sebagai kata', () => {
  it('> < = dibaca lebih dari, kurang dari, sama dengan', () => {
    speak('Mana yang benar: 8 > 5 atau 8 < 5?');
    speak('3 + 4 = 7');
    expect(said.map((s) => s.text)).toEqual([
      'Mana yang benar: 8 lebih dari 5 atau 8 kurang dari 5?',
      '3 tambah 4 sama dengan 7',
    ]);
  });

  it('juga untuk bacaan yang tertahan sebelum halaman diketuk dan untuk pratinjau admin', () => {
    speak('9 - 4 = 5', { voice: { ...readDb().settings.voice, enabled: false } });
    speak('2 × 3 ≠ 7 ÷ 1');
    expect(said.map((s) => s.text)).toEqual([
      '9 kurang 4 sama dengan 5',
      '2 kali 3 tidak sama dengan 7 bagi 1',
    ]);
  });
});

describe('suara narasi mengikuti Audio Narasi', () => {
  it('kecepatan dan nada dari pengaturan', () => {
    setVoice({ rate: 1.2, pitch: 0.9 });
    speak('Halo');
    expect(said).toEqual([{ text: 'Halo', rate: 1.2, pitch: 0.9 }]);
  });

  it('suara mati: tidak ada yang dibacakan, kecuali pratinjau admin', () => {
    setVoice({ enabled: false });
    speak('Halo');
    speakAuto('Soal pertama');
    expect(said).toEqual([]);
    speak('Uji', { voice: { ...readDb().settings.voice, enabled: false } });
    expect(said.map((s) => s.text)).toEqual(['Uji']);
  });

  it('bacaan otomatis mati: ketukan tetap bersuara', () => {
    setVoice({ autoRead: false });
    speakAuto('Soal pertama');
    speak('Tombol');
    expect(said.map((s) => s.text)).toEqual(['Tombol']);
  });
});

type FakeVoice = { name: string; lang: string };

/** Mesin suara tiruan yang daftar suaranya bisa diisi belakangan, seperti peramban yang memuatnya tak serempak. */
function fakeSynth(initial: FakeVoice[] = []) {
  const listeners = new Set<() => void>();
  const synth = {
    voices: initial,
    cancel: () => undefined,
    speak: () => undefined,
    getVoices() {
      return synth.voices;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    listeners,
    fire: () => listeners.forEach((fn) => fn()),
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  return synth;
}

describe('daftar suara bahasa Indonesia', () => {
  it('mengenali kode id-ID, id_ID, dan kode lama in-ID; menolak bahasa lain dan nama kembar', () => {
    fakeSynth([
      { name: 'A', lang: 'id-ID' },
      { name: 'B', lang: 'id_ID' },
      { name: 'C', lang: 'in-ID' },
      { name: 'D', lang: 'ID' },
      { name: 'E', lang: 'en-US' },
      { name: 'F', lang: 'ms-MY' },
      { name: 'G', lang: 'inh-RU' },
      { name: 'A', lang: 'id-ID' },
    ]);
    expect(indonesianVoices().map((v) => v.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('tanpa mesin suara atau getVoices: daftar kosong tanpa galat', () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    delete (window as { speechSynthesis?: unknown }).speechSynthesis;
    expect(indonesianVoices()).toEqual([]);
    Object.defineProperty(window, 'speechSynthesis', { value: {}, configurable: true });
    expect(indonesianVoices()).toEqual([]);
  });

  describe('watchVoices', () => {
    afterEach(() => vi.useRealTimers());

    it('dibaca sekarang, saat voiceschanged, dan berkala selama 5 detik walau peristiwanya terlewat', () => {
      vi.useFakeTimers();
      const synth = fakeSynth();
      const seen = vi.fn();
      const stop = watchVoices(seen);
      expect(seen).toHaveBeenCalledTimes(1);
      synth.fire();
      expect(seen).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(250);
      expect(seen).toHaveBeenCalledTimes(3);
      vi.advanceTimersByTime(5000);
      // 20 kali bacaan berkala, lalu berhenti sendiri.
      expect(seen).toHaveBeenCalledTimes(2 + 20);
      vi.advanceTimersByTime(5000);
      expect(seen).toHaveBeenCalledTimes(2 + 20);
      stop();
    });

    it('berhenti dan melepas pendengar saat dibersihkan; tanpa mesin suara tidak melakukan apa pun', () => {
      vi.useFakeTimers();
      const synth = fakeSynth();
      const seen = vi.fn();
      const stop = watchVoices(seen);
      expect(synth.listeners.size).toBe(1);
      stop();
      expect(synth.listeners.size).toBe(0);
      vi.advanceTimersByTime(3000);
      expect(seen).toHaveBeenCalledTimes(1);

      delete (window as { speechSynthesis?: unknown }).speechSynthesis;
      const none = vi.fn();
      watchVoices(none)();
      expect(none).not.toHaveBeenCalled();
    });
  });

  it('Audio Narasi: suara yang baru muncul tanpa peristiwa voiceschanged tetap masuk pilihan', async () => {
    const synth = fakeSynth();
    useSession.setState({ session: { token: 'mock-admin:a-demo', role: 'admin', name: 'Admin' } });
    render(
      <MemoryRouter>
        <NarrationPage />
      </MemoryRouter>,
    );
    await screen.findByRole('combobox', { name: 'Suara' });
    expect(await screen.findByText(/Belum ada suara bahasa Indonesia/)).toBeInTheDocument();
    // Suara dimuat peramban belakangan dan peristiwanya sudah lewat: halaman tetap membacanya ulang.
    synth.voices = [
      { name: 'Microsoft Andika - Indonesian (Indonesia)', lang: 'id-ID' },
      { name: 'Microsoft David - English (United States)', lang: 'en-US' },
    ];
    await waitFor(() => expect(screen.queryByText(/Belum ada suara bahasa Indonesia/)).toBeNull(), {
      timeout: 3000,
    });
    fireEvent.click(screen.getByRole('combobox', { name: 'Suara' }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Otomatis (suara Indonesia pertama)',
      'Microsoft Andika - Indonesian (Indonesia) (id-ID)',
    ]);
  });
});
