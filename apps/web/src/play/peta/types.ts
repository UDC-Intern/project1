/** Bentuk data Peta Belajar: satu rak = satu topik, dengan level-levelnya. */
export type PlayStatus = 'open' | 'passed' | 'locked' | 'paid';

export type PetaLevel = { id: string; order: number; title: string };

export type Shelf = {
  /** Kode topik, unik di dalam buku. */
  code: string;
  title: string;
  /** Pengantar topik, dibacakan Momo. */
  intro: string;
  /** Hal penting topik ("Tahukah kamu?"). */
  tips: string[];
  /** Tujuan tombol "Mulai belajar". */
  href: string;
  skills: PetaLevel[];
};

export type PetaBook = { title: string; slug: string };
