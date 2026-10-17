import type {
  BillingPackage,
  MasteryStatus,
  PaymentMethod,
  PlanStatus,
  Pricing,
  Stage,
} from '@udakids/engine';

/** Bentuk data halaman panel admin (alamat `/admin/...`). Tanggal berupa string ISO. */

export type Page<T> = { page: number; pageSize: number; total: number; items: T[] };

/** Premium per anak dari admin, atau Premium keluarga dari pembelian paket. */
export type Grant = {
  id: string;
  source: 'admin' | 'purchase';
  note: string | null;
  childId: string | null;
  startsAt: string | null;
  /** null berarti selamanya. */
  endsAt: string | null;
  createdAt: string | null;
  grantedByName: string | null;
  live: boolean;
};

export type FamilyChild = {
  id: string;
  nickname: string;
  momoColor: string;
  active: boolean;
  lastActiveAt: string | null;
  plan: PlanStatus;
  grants: Grant[];
};

export type FamilyRow = {
  id: string;
  name: string;
  email: string;
  familyCode: string;
  active: boolean;
  createdAt: string | null;
  lastActiveAt: string | null;
  /** Paket yang dibeli keluarga (berlaku untuk semua anak). */
  plan: PlanStatus;
  /** Jumlah anak yang Premium (paket keluarga atau Premium per anak). */
  premiumChildren: number;
  children: FamilyChild[];
};

export type ChildRow = FamilyChild & {
  createdAt: string | null;
  parent: { id: string; name: string; email: string };
  passed: number;
  answered: number;
};

export type DirectorySummary = {
  families: number;
  familiesInactive: number;
  children: number;
  childrenInactive: number;
  premiumChildren: number;
  premiumFamilies: number;
  adminGrants: number;
};

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  createdAt: string | null;
};

/** Statistik satu level: jawaban, ketepatan, anak yang mencoba dan lulus, jawaban keliru terbanyak. */
export type LevelStat = {
  id: string;
  bookSlug: string;
  bookTitle: string;
  topicCode: string;
  topicTitle: string;
  number: number;
  title: string;
  answered: number;
  accuracy: number | null;
  learners: number;
  passed: number;
  topWrong: { answer: string; count: number }[];
};

export type ChildSummaryRow = {
  id: string;
  nickname: string;
  momoColor: string;
  parentName: string;
  answered: number;
  correct: number;
  passed: number;
  lastActiveAt: string | null;
  active: boolean;
};

export type TopicStatus = MasteryStatus | 'not_started';

export type AdminChildReport = {
  child: {
    id: string;
    nickname: string;
    momoColor: string;
    parentName: string;
    lastActiveAt: string | null;
    createdAt: string | null;
  };
  totals: {
    answered: number;
    correct: number;
    passed: number;
    levels: number;
    mastered: number;
    topics: number;
  };
  week: { answered: number; correct: number };
  recommendations: { topicId: string; title: string; bookTitle: string; status: TopicStatus }[];
  books: {
    slug: string;
    title: string;
    mastery: number;
    passed: number;
    levels: number;
    mastered: number;
    topics: {
      id: string;
      code: string;
      title: string;
      mastery: number;
      status: TopicStatus;
      stage: Stage;
      levels: {
        id: string;
        number: number;
        title: string;
        best: number | null;
        answered: number;
        correct: number;
        passed: boolean;
      }[];
    }[];
  }[];
};

export type AdminNotification = {
  key: string;
  kind: 'parent' | 'child' | 'order_created' | 'order_proof' | 'certificate';
  at: string;
  title: string;
  detail: string;
  amount: number | null;
  href: string;
};

export type PackageRow = BillingPackage & { sold: number; pricing: Pricing };
export type PaymentMethodRow = PaymentMethod;

/** Konten untuk halaman Konten: buku, topik (materi dan hal penting), dan level beserta status gratis. */
export type CatalogBook = {
  slug: string;
  title: string;
  subject: 'math' | 'science';
  topics: {
    id: string;
    code: string;
    title: string;
    lesson: string;
    tips: string[];
    levels: {
      id: string;
      number: number;
      title: string;
      free: boolean;
      /** Status gratis/Premium mengikuti pengecualian admin, bukan aturan level gratis di Pengaturan. */
      override: boolean;
      generator: string | null;
    }[];
  }[];
};

/** `GET|POST|DELETE /admin/demo-data` (mode tiruan): jumlah baris data contoh yang sedang dimuat. */
export type DemoDataSummary = {
  loaded: boolean;
  at: string | null;
  counts: {
    families: number;
    children: number;
    staff: number;
    orders: number;
    rounds: number;
    certificates: number;
    illustrations: number;
    grants: number;
  };
};

/** `GET /admin/dashboard?range=`: antrean kerja admin, kelulusan per buku, dan pesanan terbaru. */
export type AdminDashboard = {
  range: string;
  rounds: number;
  passRate: number | null;
  counts: {
    families: number;
    children: number;
    premiumChildren: number;
    certificates: number;
    waitingCertificates: number;
    pendingOrders: number;
    awaitingPayment: number;
    illustrationsToReview: number;
  };
  books: {
    slug: string;
    title: string;
    rounds: number;
    learners: number;
    passRate: number | null;
    finished: number;
  }[];
  recentOrders: {
    id: string;
    number: string;
    parentName: string;
    packageName: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
};
