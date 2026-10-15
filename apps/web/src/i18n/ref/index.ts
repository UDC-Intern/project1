import common from './id/common.json';
import parent from './id/parent.json';
import play from './id/play.json';
import rank from './id/rank.json';
import site from './id/site.json';
import staff from './id/staff.json';
import { APP_NAME, CHARACTER_NAME } from '../../config/app';

// Katalog teks halaman area orang tua dan beranda publik. Satu berkas per area, kunci "area.kunci".
const namespaces = { common, staff, parent, play, site, rank };
type Namespaces = typeof namespaces;
export type MessageKey = {
  [N in keyof Namespaces]: `${N & string}.${keyof Namespaces[N] & string}`;
}[keyof Namespaces];

const flat: Record<string, string> = {};
for (const [ns, dict] of Object.entries(namespaces)) {
  for (const [k, v] of Object.entries(dict as Record<string, string>)) flat[`${ns}.${k}`] = v;
}

const defaults: Record<string, string> = { app: APP_NAME, character: CHARACTER_NAME };

export function t(key: MessageKey, vars: Record<string, string | number> = {}): string {
  const all = { ...defaults, ...vars };
  const template = flat[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in all ? String(all[name]) : m));
}
