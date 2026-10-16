import { bookContentSchema, type BookContent } from '@udakids/engine';
import matematika1 from '../../../../content/matematika-kelas-1/book.json';
import matematika2 from '../../../../content/matematika-kelas-2/book.json';
import matematika3 from '../../../../content/matematika-kelas-3/book.json';
import matematika4 from '../../../../content/matematika-kelas-4/book.json';
import sains from '../../../../content/sains-kelas-1/book.json';

/** Buku dari `content/`: sumber yang sama dengan seed database. Landing dan mode tiruan membacanya dari sini. */
export const BASE_BOOKS: BookContent[] = [matematika1, matematika2, matematika3, matematika4, sains]
  .map((raw) => bookContentSchema.parse(raw))
  .sort((a, b) => a.sort - b.sort);

export const TOTAL_LEVELS = BASE_BOOKS.reduce(
  (n, b) => n + b.topics.reduce((m, t) => m + t.levels.length, 0),
  0,
);
