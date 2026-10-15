import type { MomoLook } from '@udakids/engine';

/** Bentuk data yang dipakai halaman area orang tua. Tanggal berupa string ISO. */

export type ChildProfile = {
  id: string;
  momoLook?: MomoLook | null;
  classId?: string | null;
  className?: string | null;
  classCode?: string | null;
  nickname: string;
  momoColor: string;
  lastActiveAt: string | null;
  createdAt: string;
};

export type CatalogResponse = {
  catalogs: { domain: string; grade: string; title: string }[];
};
