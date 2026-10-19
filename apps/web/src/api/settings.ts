import { appSettingsSchema, DEFAULT_SETTINGS, type AppSettings } from '@udakids/engine';
import { useEffect, useReducer } from 'react';
import { request } from './client';
import * as mock from './mock/settings';
import { isMocked } from './mode';

/**
 * Pengaturan dari menu admin (akses berbayar, kontak WhatsApp, lembar sertifikat) untuk semua halaman. Mode
 * tiruan membaca langsung dari penyimpanan; dengan server, diambil dari `GET /settings` dan disegarkan saat
 * tab kembali aktif atau admin menyimpan perubahan di tab lain.
 */

export const SETTINGS_CHANGED = 'udakids:settings-changed';

let cache: AppSettings | null = null;
let pending: Promise<AppSettings> | null = null;
let revision = 0;
let syncReady = false;
let channel: BroadcastChannel | null = null;

const mocked = () => isMocked('admin');

function notify() {
  try {
    window.dispatchEvent(new Event(SETTINGS_CHANGED));
  } catch {
    /* tanpa window */
  }
}

function apply(next: AppSettings) {
  revision++;
  cache = next;
  pending = null;
  notify();
}

function installSync() {
  if (syncReady || mocked() || typeof window === 'undefined') return;
  syncReady = true;
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(SETTINGS_CHANGED);
    channel.addEventListener('message', (event: MessageEvent<unknown>) => {
      const next = appSettingsSchema.safeParse(event.data);
      if (next.success) apply(next.data);
    });
  }
  window.addEventListener('focus', () => void loadSettings(true));
}

export function currentSettings(): AppSettings {
  return mocked() ? mock.currentSettings() : (cache ?? DEFAULT_SETTINGS);
}

export function loadSettings(refresh = false): Promise<AppSettings> {
  if (mocked()) return Promise.resolve(mock.currentSettings());
  installSync();
  if (refresh) {
    revision++;
    pending = null;
  }
  const started = revision;
  pending ??= request<AppSettings>('/settings')
    .then((s) => {
      if (started === revision) {
        cache = s;
        notify();
      }
      return cache ?? s;
    })
    .catch(() => {
      if (started === revision) pending = null; // coba lagi di halaman berikutnya
      return cache ?? DEFAULT_SETTINGS;
    });
  return pending;
}

/** Dipanggil setelah admin menyimpan: semua halaman yang memakai pengaturan ikut diperbarui. */
export function settingsChanged(next?: AppSettings) {
  installSync();
  if (next) {
    apply(next);
    channel?.postMessage(next);
  } else {
    revision++;
    pending = null;
    notify();
  }
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
