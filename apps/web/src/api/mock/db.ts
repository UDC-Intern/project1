import {
  FOREVER_ISO,
  bankToLevel,
  mergeSettings,
  type AppSettings,
  type BankQuestion,
  type BillingPackage,
  type BookContent,
  type Certificate,
  type CertificateDesign,
  type Illustration,
  type LevelContent,
  type MasteryState,
  type MomoColor,
  type PaymentMethod,
  type Pin,
  type Stage,
  type Stamp,
  type TopicContent,
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

/** Level seperti di berkas konten, tanpa suntingan soal admin; undefined bila level itu buatan admin atau tidak ada. */
export function baseLevelOf(id: string): LevelContent | undefined {
  const [slug, code, n] = id.split(':');
  return BASE.find((b) => b.slug === slug)
    ?.topics.find((t) => t.code === code)
    ?.levels.find((l) => String(l.number) === n);
}

/** Silabus buatan admin (Silabus Belajar): ditambahkan di atas buku dari berkas konten. */
export type SyllabusAdditions = {
  /** Buku baru lengkap dengan topik dan level awalnya. */
  books: BookContent[];
  /** Topik baru untuk buku yang sudah ada (bawaan atau buatan admin). */
  topics: { book: string; topic: TopicContent }[];
  /** Level baru untuk topik yang sudah ada. */
  levels: { topic: string; level: LevelContent }[];
};

export type ContentEdits = {
  topics: Record<string, { title?: string; lesson?: string; tips?: string[] }>;
  levels: Record<string, { title?: string; isFree?: boolean }>;
  /**
   * Bank soal tulisan admin per level (id level → soal). Menggantikan generator level itu, baik level bawaan maupun
   * buatan admin; menghapusnya mengembalikan generator aslinya.
   */
  questions?: Record<string, BankQuestion[]>;
  /** Data versi lama belum punya bagian ini. */
  added?: SyllabusAdditions;
};

export function applyEdits(edits: ContentEdits): void {
  BOOKS.splice(0, BOOKS.length, ...structuredClone(BASE));
  const added = edits.added;
  if (added) {
    BOOKS.push(...structuredClone(added.books));
    BOOKS.sort((a, b) => a.sort - b.sort);
    for (const { book, topic } of added.topics)
      BOOKS.find((b) => b.slug === book)?.topics.push(structuredClone(topic));
    for (const { topic, level } of added.levels) {
      const [slug, code] = topic.split(':');
      BOOKS.find((b) => b.slug === slug)
        ?.topics.find((t) => t.code === code)
        ?.levels.push(structuredClone(level));
    }
  }
  for (const book of BOOKS) {
    for (const topic of book.topics) {
      const te = edits.topics[`${book.slug}:${topic.code}`];
      if (te) Object.assign(topic, te);
      for (const level of topic.levels) {
        const id = `${book.slug}:${topic.code}:${level.number}`;
        const le = edits.levels[id];
        if (le) Object.assign(level, le);
        const bank = edits.questions?.[id];
        if (bank) Object.assign(level, bankToLevel(bank));
      }
    }
  }
}

export type MockAdmin = {
  id: string;
  name: string;
  email: string;
  password: string;
  /** Akun staf yang dinonaktifkan tidak bisa masuk. Kosong berarti aktif. */
  active?: boolean;
  createdAt?: string;
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
  /** Keluarga yang dinonaktifkan admin: orang tua dan anaknya tidak bisa masuk. Kosong berarti aktif. */
  active?: boolean;
};

export type MockOrder = Order & { parentId: string; proofDataUrl: string | null };

/** Suntingan paket dan rekening versi lama; dipindah ke `packages` dan `methods` saat data dibaca. */
type LegacyBillingEdits = {
  packages?: Record<string, Partial<BillingPackage>>;
  methods?: Record<string, Partial<PaymentMethod>>;
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
  /** Anak yang dinonaktifkan admin tidak bisa masuk. Kosong berarti aktif. */
  active?: boolean;
  createdAt?: string;
  /** Nama lengkap khusus sertifikat, diisi orang tua (opsional). */
  certificateName?: string | null;
  /** Waktu orang tua menyetujui nama lengkap disimpan untuk sertifikat. */
  certificateConsentAt?: string | null;
};

/** Premium per anak yang diberikan admin. Satu baris per pemberian; `endsAt` null berarti selamanya. */
export type MockGrant = {
  id: string;
  childId: string;
  endsAt: string | null;
  note: string;
  grantedBy: string | null;
  createdAt: string;
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
  /** Ilustrasi AI dari menu Media & Audio (antrean tinjau dan yang sudah disetujui) */
  illustrations: Illustration[];
  orders: Record<string, MockOrder>;
  /** Premium keluarga dari pembelian paket: berlaku untuk semua anak orang tua itu */
  familyPremium: Record<string, string>;
  /** Paket dan rekening yang dikelola admin (awalnya dari content/billing.json) */
  packages: BillingPackage[];
  methods: PaymentMethod[];
  /** Pengaturan yang diubah admin di menu Pengaturan */
  settings: AppSettings;
  /** Riwayat Premium per anak dari admin */
  premiumGrants: MockGrant[];
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
  /** Riwayat stempel yang pernah diunggah admin (paling baru di depan). Data versi lama belum punya bagian ini. */
  stamps?: Stamp[];
  /** Data contoh (`demoData.ts`): versi yang dimuat dan kapan; `at` kosong berarti sudah dihapus admin. */
  demo?: { version: number; at: string | null };
};

/** Pembuat gambar di menu Ilustrasi AI selama mode tiruan. */
export const ILLUSTRATION_ENGINE = 'Pustaka bentuk UdaKids (mode tiruan)';

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
      {
        id: 'a-demo',
        name: 'Admin UdaKids',
        email: 'admin@udakids.local',
        password: 'admin12345',
        createdAt: '2026-09-15T08:00:00.000Z',
      },
    ],
    contentEdits: { topics: {}, levels: {} },
    illustrations: [],
    orders: seedOrders(),
    familyPremium: {},
    packages: BILLING.packages.map((p) => ({ ...p, description: '' })),
    methods: BILLING.methods.map((m) => ({ ...m, instructions: '' })),
    settings: mergeSettings({
      contact: {
        adminWhatsapp: BILLING.adminWhatsapp,
        adminMessage:
          'Halo Admin UdaKids (Ridho Dwi Syahputra), saya ingin bertanya mengenai UdaKids.',
      },
    }),
    premiumGrants: [],
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
      const parsed = JSON.parse(raw) as Partial<MockDb> & {
        billingEdits?: LegacyBillingEdits;
        aiJobs?: unknown;
      };
      const base = seed();
      // aiJobs: catatan asisten teks lama, diganti Ilustrasi AI.
      const { billingEdits: legacy, aiJobs: _aiJobs, ...rest } = parsed;
      memory = { ...base, ...rest } as MockDb;
      memory.settings = mergeSettings(parsed.settings ?? base.settings);
      // Data versi lama: paket dan rekening masih berupa suntingan di atas content/billing.json.
      if (!parsed.packages)
        memory.packages = base.packages.map((p) => ({ ...p, ...legacy?.packages?.[p.id] }));
      if (!parsed.methods)
        memory.methods = base.methods.map((m) => ({ ...m, ...legacy?.methods?.[m.id] }));
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
/** Premium anak dari admin = pemberian yang masih berlaku dengan tanggal paling akhir (selamanya menang). */
export function syncChildPremium(db: MockDb, childId: string): void {
  const live = db.premiumGrants.filter(
    (g) => g.childId === childId && (g.endsAt === null || Date.parse(g.endsAt) > Date.now()),
  );
  if (live.length === 0) delete db.premiumUntil[childId];
  else
    db.premiumUntil[childId] = live.some((g) => g.endsAt === null)
      ? FOREVER_ISO
      : live
          .map((g) => g.endsAt!)
          .sort()
          .at(-1)!;
}

/** Akun aktif bila tidak dinonaktifkan; keluarga nonaktif membuat anaknya ikut nonaktif. */
export const isChildActive = (db: MockDb, child: MockChild) =>
  child.active !== false && db.parents.find((p) => p.id === child.parentId)?.active !== false;

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
