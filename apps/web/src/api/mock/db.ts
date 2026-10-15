import {
  type BookContent,
  type MasteryState,
  type MomoColor,
  type Pin,
  type Stage,
} from '@udakids/engine';
import { BASE_BOOKS } from '../../content/books';

const BASE: BookContent[] = BASE_BOOKS;

/** Buku yang sedang berlaku: BASE ditambah suntingan admin. Array yang sama dipakai semua modul mock. */
export const BOOKS: BookContent[] = structuredClone(BASE);

export type ContentEdits = {
  topics: Record<string, { title?: string; lesson?: string }>;
  levels: Record<string, { title?: string; isFree?: boolean }>;
};

export function applyEdits(edits: ContentEdits): void {
  BOOKS.splice(0, BOOKS.length, ...structuredClone(BASE));
  for (const book of BOOKS) {
    for (const topic of book.topics) {
      const te = edits.topics[`${book.slug}:${topic.code}`];
      if (te) Object.assign(topic, te);
      for (const level of topic.levels) {
        const le = edits.levels[`${book.slug}:${topic.code}:${level.number}`];
        if (le) Object.assign(level, le);
      }
    }
  }
}

export type MockAdmin = { id: string; name: string; email: string; password: string };
export type MockAiJob = {
  id: string;
  adminName: string;
  topicTitle: string;
  purpose: 'lesson' | 'curriculum';
  model: string;
  createdAt: string;
};

export type MockParent = {
  id: string;
  name: string;
  email: string;
  password: string;
  familyCode: string;
};
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
  admins: MockAdmin[];
  contentEdits: ContentEdits;
  aiJobs: MockAiJob[];
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
    parents: [
      {
        id: 'p-demo',
        name: 'Bu Ani',
        email: 'ani@contoh.id',
        password: 'rahasia123',
        familyCode: 'BELAJR',
      },
    ],
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
    admins: [
      { id: 'a-demo', name: 'Admin UdaKids', email: 'admin@udakids.local', password: 'admin12345' },
    ],
    contentEdits: { topics: {}, levels: {} },
    aiJobs: [],
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
      for (const p of memory.parents) p.password ??= 'rahasia123';
      applyEdits(memory.contentEdits);
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
  applyEdits(memory.contentEdits);
  writeDb(memory);
}

export const topicId = (bookSlug: string, code: string) => `${bookSlug}:${code}`;
export const levelId = (bookSlug: string, code: string, n: number) => `${bookSlug}:${code}:${n}`;

/** Id unik untuk data tiruan (tanpa crypto.randomUUID yang butuh konteks aman). */
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
