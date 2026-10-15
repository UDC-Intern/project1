export type Theme = 'light' | 'dark';

const KEY = 'udakids.theme';

export function storedTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Pasang tema ke elemen html dan ingat pilihannya di perangkat ini. */
export function applyTheme(theme: Theme, remember = true): void {
  document.documentElement.dataset.theme = theme;
  if (!remember) return;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* penyimpanan tidak tersedia */
  }
}
