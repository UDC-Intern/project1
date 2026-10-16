import { DEFAULT_SETTINGS, type AppSettings } from '@udakids/engine';
import { useEffect, useReducer } from 'react';
import { request } from './client';
import * as mock from './mock/settings';
import { isMocked } from './mode';

/**
 * Pengaturan dari menu admin (akses berbayar, kontak WhatsApp, lembar sertifikat) untuk semua halaman. Mode
 * tiruan membaca langsung dari penyimpanan; dengan server, diambil sekali dari `GET /settings` lalu disimpan.
 */

export const SETTINGS_CHANGED = 'udakids:settings-changed';

let cache: AppSettings | null = null;
let pending: Promise<AppSettings> | null = null;

const mocked = () => isMocked('admin');

function notify() {
  try {
    window.dispatchEvent(new Event(SETTINGS_CHANGED));
  } catch {
    /* tanpa window */
  }
}

export function currentSettings(): AppSettings {
  return mocked() ? mock.currentSettings() : (cache ?? DEFAULT_SETTINGS);
}

export function loadSettings(): Promise<AppSettings> {
  if (mocked()) return Promise.resolve(mock.currentSettings());
  pending ??= request<AppSettings>('/settings')
    .then((s) => {
      cache = s;
      notify();
      return s;
    })
    .catch(() => {
      pending = null; // coba lagi di halaman berikutnya
      return cache ?? DEFAULT_SETTINGS;
    });
  return pending;
}

/** Dipanggil setelah admin menyimpan: semua halaman yang memakai pengaturan ikut diperbarui. */
export function settingsChanged(next?: AppSettings) {
  if (next) cache = next;
  pending = null;
  notify();
}

/** Pengaturan terkini; komponen tampil ulang saat admin menyimpan perubahan. */
export function useSettings(): AppSettings {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener(SETTINGS_CHANGED, rerender);
    void loadSettings();
    return () => window.removeEventListener(SETTINGS_CHANGED, rerender);
  }, []);
  return currentSettings();
}
