import {
  bookContentSchema,
  type BookContent,
  type MasteryState,
  type MomoColor,
  type Pin,
  type Stage,
} from '@udakids/engine';
import matematika from '../../../../../content/matematika-kelas-1/book.json';
import sains from '../../../../../content/sains-kelas-1/book.json';

/** Buku dari `content/`: sumber yang sama dengan seed database di tahap berikutnya. */
export const BOOKS: BookContent[] = [matematika, sains]
  .map((raw) => bookContentSchema.parse(raw))
  .sort((a, b) => a.sort - b.sort);

export type MockParent = { id: string; name: string; email: string; familyCode: string };
export type MockChild = {
  id: string;
  parentId: string;
  nickname: string;
  momoColor: MomoColor;
  pin: Pin | null;
  failedAttempts: number;
  lockCount: number;
  lockedUntil: number | null;
};

export type MockRound = {
  id: string;
  childId: string;
  levelId: string;
  seed: number;
  startedAt: number;
  stageBefore: Stage;
  answers: Record<number, { chosen: string; isCorrect: boolean }>;
  finishedAt: number | null;
  result: {
    score: number;
    correct: number;
    wrong: number;
    durationMs: number;
    passed: boolean;
  } | null;
};

export type MockDb = {
  parents: MockParent[];
  children: MockChild[];
  /** id level yang pernah lulus, per anak */
  passedLevels: Record<string, string[]>;
  /** penguasaan per anak per topik (id topik) */
  mastery: Record<string, Record<string, MasteryState>>;
  /** skor dan waktu terbaik per anak per level */
  best: Record<string, Record<string, { score: number; ms: number }>>;
  rounds: Record<string, MockRound>;
  /** Premium sampai tanggal ISO, per anak */
  premiumUntil: Record<string, string>;
  /** level terakhir yang dimainkan, per anak */
  lastLevel: Record<string, string>;
};

const KEY = 'udakids-mock-v1';

function seed(): MockDb {
  return {
    parents: [{ id: 'p-demo', name: 'Bu Ani', email: 'ani@contoh.id', familyCode: 'BELAJR' }],
    children: [
      {
        id: 'c-ayu',
        parentId: 'p-demo',
        nickname: 'Ayu',
        momoColor: 'pink',
        pin: ['apple', 'star', 'fish'],
        failedAttempts: 0,
        lockCount: 0,
        lockedUntil: null,
      },
      {
        id: 'c-bima',
        parentId: 'p-demo',
        nickname: 'Bima',
        momoColor: 'blue',
        pin: ['ball', 'cloud', 'leaf'],
        failedAttempts: 0,
        lockCount: 0,
        lockedUntil: null,
      },
    ],
    passedLevels: {},
    mastery: {},
    best: {},
    rounds: {},
    premiumUntil: {},
    lastLevel: {},
  };
}

let memory: MockDb | null = null;

export function readDb(): MockDb {
  if (memory) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MockDb>;
      memory = { ...seed(), ...parsed } as MockDb;
      return memory;
    }
  } catch {
    /* penyimpanan tidak tersedia: pakai data awal di memori */
  }
  memory = seed();
  return memory;
}

export function writeDb(db: MockDb = readDb()): void {
  memory = db;
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* diabaikan: data hidup selama tab terbuka */
  }
}

export function resetMockDb(): void {
  memory = seed();
  writeDb(memory);
}

export const topicId = (bookSlug: string, code: string) => `${bookSlug}:${code}`;
export const levelId = (bookSlug: string, code: string, n: number) => `${bookSlug}:${code}:${n}`;
