import { beforeEach, describe, expect, it } from 'vitest';
import { readDb, resetMockDb, writeDb } from '../src/api/mock/db';
import { installAudioUnlock, speak, speakAuto } from '../src/audio/speech';

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
