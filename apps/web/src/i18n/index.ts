import { useCallback } from 'react';
import admin from './id/admin.json';
import common from './id/common.json';
import parent from './id/parent.json';
import play from './id/play.json';
import site from './id/site.json';

const dictionaries = { common, play, parent, admin, site } as const;
export type Namespace = keyof typeof dictionaries;

/** Ambil teks UI. Variabel ditulis {nama}. Kunci yang tidak ada dikembalikan apa adanya. */
export function translate(
  ns: Namespace,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = dictionaries[ns] as Record<string, string>;
  const text = dict[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}

export function useT(ns: Namespace = 'common') {
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(ns, key, vars),
    [ns],
  );
}
