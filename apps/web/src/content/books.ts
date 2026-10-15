import { bookContentSchema, type BookContent } from '@udakids/engine';
import matematika from '../../../../content/matematika-kelas-1/book.json';
import sains from '../../../../content/sains-kelas-1/book.json';

/** Buku dari `content/`: sumber yang sama dengan seed database. Landing dan mode tiruan membacanya dari sini. */
export const BASE_BOOKS: BookContent[] = [matematika, sains]
  .map((raw) => bookContentSchema.parse(raw))
  .sort((a, b) => a.sort - b.sort);

export const TOTAL_LEVELS = BASE_BOOKS.reduce(
  (n, b) => n + b.topics.reduce((m, t) => m + t.levels.length, 0),
  0,
);
