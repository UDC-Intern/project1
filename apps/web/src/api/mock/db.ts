import {
  type BookContent,
  type Certificate,
  type CertificateDesign,
  type MasteryState,
  type MomoColor,
  type Pin,
  type Stage,
} from '@udakids/engine';
import {
  ORDER_TTL_MS,
  orderAmounts,
  orderNumber,
  uniqueCodeFor,
  type Order,
  type OrderStatus,
} from '@udakids/engine';
import { BASE_BOOKS } from '../../content/books';
import { BILLING } from '../../content/billing';

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
  createdAt?: string;
  passwordChangedAt?: string | null;
  pendingEmail?: string | null;
  /** kode keluarga orang tua yang mengajaknya mendaftar */
  referredBy?: string | null;
};

export type MockOrder = Order & { parentId: string; proofDataUrl: string | null };

export type BillingEdits = {
  packages: Record<string, { name?: string; listPrice?: number; price?: number; active?: boolean }>;
  methods: Record<string, { name?: string; number?: string; holder?: string; active?: boolean }>;
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
  /** Sertifikat yang terbit saat ronde ini selesai. */
  certificateId?: string | null;
};

export type MockDb = {
  parents: MockParent[];
  admins: MockAdmin[];
  contentEdits: ContentEdits;
  aiJobs: MockAiJob[];
  orders: Record<string, MockOrder>;
  /** Premium keluarga dari pembelian paket: berlaku untuk semua anak orang tua itu */
  familyPremium: Record<string, string>;
  billingEdits: BillingEdits;
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
  /** sertifikat yang sudah terbit, per nomor sertifikat */
  certificates: Record<string, Certificate>;
  /** desain yang dipakai saat sertifikat berikutnya terbit (dipilih admin) */
  certificateDesign: CertificateDesign;
};

const KEY = 'udakids-mock-v1';

/** Riwayat contoh untuk akun demo: pesanan kedaluwarsa, dibatalkan, dan bukti yang perlu dikirim ulang. */
function seedOrders(): Record<string, MockOrder> {
  const make = (
    id: string,
    pkgId: string,
    methodId: string,
    createdAt: string,
    status: OrderStatus,
    extra: Partial<MockOrder> = {},
  ): MockOrder => {
    const pkg = BILLING.packages.find((p) => p.id === pkgId)!;
    const method = BILLING.methods.find((m) => m.id === methodId)!;
    const amounts = orderAmounts(pkg.listPrice, pkg.price, uniqueCodeFor(id));
    const created = Date.parse(createdAt);
    return {
      id,
      number: orderNumber(created, id),
      packageId: pkg.id,
      packageName: pkg.name,
      durationDays: pkg.durationDays,
      ...amounts,
      methodId: method.id,
      methodName: method.name,
      methodNumber: method.number,
      methodHolder: method.holder,
      status,
      createdAt,
      expiresAt: new Date(created + ORDER_TTL_MS).toISOString(),
      proofName: null,
      proofAt: null,
      rejectNote: null,
      paidAt: null,
      parentId: 'p-demo',
      proofDataUrl: null,
      ...extra,
    };
  };
  const list = [
    make('o-demo-1', 'tunas', 'bca', '2026-09-24T09:10:00.000Z', 'expired'),
    make('o-demo-2', 'kumbang', 'gopay', '2026-10-01T13:30:00.000Z', 'cancelled'),
    make('o-demo-3', 'tunas', 'bni', '2026-10-06T07:45:00.000Z', 'rejected', {
      proofName: 'bukti-transfer.png',
      proofAt: '2026-10-06T08:00:00.000Z',
      rejectNote: 'Bukti belum terbaca. Mohon kirim ulang foto yang lebih jelas.',
    }),
  ];
  return Object.fromEntries(list.map((o) => [o.id, o]));
}

function seed(): MockDb {
  return {
    parents: [
      {
        id: 'p-demo',
        name: 'Ridho Dwi Syahputra',
        email: 'ridhodwi330@gmail.com',
        password: 'rahasia123',
        familyCode: 'RWJUVF',
        createdAt: '2026-09-18T08:00:00.000Z',
        passwordChangedAt: null,
        pendingEmail: null,
        referredBy: null,
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
    orders: seedOrders(),
    familyPremium: {},
    billingEdits: { packages: {}, methods: {} },
    passedLevels: {},
    mastery: {},
    best: {},
    rounds: {},
    premiumUntil: {},
    lastLevel: {},
    certificates: {},
    certificateDesign: 'klasik',
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

/** Kelas dari slug buku, mis. matematika-kelas-3. */
export const gradeOf = (slug: string) => Number(/kelas-(\d+)$/.exec(slug)?.[1] ?? 1);

export const topicId = (bookSlug: string, code: string) => `${bookSlug}:${code}`;
export const levelId = (bookSlug: string, code: string, n: number) => `${bookSlug}:${code}:${n}`;

/** Id unik untuk data tiruan (tanpa crypto.randomUUID yang butuh konteks aman). */
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Premium yang berlaku untuk seorang anak: yang paling akhir antara Premium anak (diatur admin) dan Premium
 * keluarga (dari pembelian paket). Null bila tidak ada yang aktif.
 */
export function premiumUntilOf(db: MockDb, childId: string): string | null {
  const child = db.children.find((c) => c.id === childId);
  const candidates = [
    db.premiumUntil[childId],
    child ? db.familyPremium[child.parentId] : undefined,
  ]
    .filter((v): v is string => v !== undefined && Date.parse(v) > Date.now())
    .sort();
  return candidates.at(-1) ?? null;
}
