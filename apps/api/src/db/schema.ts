import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Skema database UdaKids. Satu sumber untuk migrasi (`drizzle-kit generate`) dan semua kueri server.
 * Prinsip: data pribadi anak seminimal mungkin (nama panggilan, warna Momo, hash sandi gambar), id baris berupa uuid
 * kecuali yang dibaca manusia (kode keluarga, nomor sertifikat, id buku dan topik), dan waktu selalu `timestamptz`.
 */

const pk = () => uuid('id').primaryKey().defaultRandom();
const stamp = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => stamp('created_at').notNull().defaultNow();

/** Data biner (bukti transfer, gambar, klip suara): `Buffer` di aplikasi, `bytea` di Postgres. */
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => 'bytea',
  fromDriver: (v) => Buffer.from(v),
  toDriver: (v) => v,
});

// ---- Akun ----

/** Admin dan fasilitator (kakak pendamping kelas). */
export const staffUsers = pgTable(
  'staff_users',
  {
    id: pk(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').$type<'admin' | 'facilitator'>().notNull().default('admin'),
    active: boolean('active').notNull().default(true),
    passwordChangedAt: stamp('password_changed_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('staff_users_email_key').on(sql`lower(${t.email})`)],
);

export const parents = pgTable(
  'parents',
  {
    id: pk(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    /** Kode 6 huruf untuk masuk anak, sekaligus kode ajakan (referral). */
    familyCode: text('family_code').notNull().unique(),
    active: boolean('active').notNull().default(true),
    /** Persetujuan orang tua (UU PDP) saat mendaftar. */
    consentAt: stamp('consent_at'),
    emailVerifiedAt: stamp('email_verified_at'),
    passwordChangedAt: stamp('password_changed_at'),
    /** Email baru yang menunggu kode konfirmasi. */
    pendingEmail: text('pending_email'),
    /** Premium keluarga dari pembelian paket: berlaku untuk semua anak keluarga ini. */
    premiumUntil: stamp('premium_until'),
    /** Hash IP saat mendaftar (batas pendaftaran dan deteksi akun ganda); IP mentah tidak disimpan. */
    signupIpHash: text('signup_ip_hash'),
    lastLoginAt: stamp('last_login_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('parents_email_key').on(sql`lower(${t.email})`)],
);

/** Kelas pendamping: kakak fasilitator membuat kelas dengan kode; anak tanpa akun orang tua masuk lewat kode itu. */
export const classes = pgTable(
  'classes',
  {
    id: pk(),
    facilitatorId: uuid('facilitator_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull().unique(),
    closedAt: stamp('closed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('classes_facilitator_idx').on(t.facilitatorId)],
);

/**
 * Anak: hanya nama panggilan, warna Momo, dan hash sandi gambar. Tanpa foto, email, tanggal lahir, atau suara.
 * `parentId` atau `classId` terisi (anak keluarga atau anak kelas); `certificateName` opsional dengan persetujuan.
 */
export const children = pgTable(
  'children',
  {
    id: pk(),
    parentId: uuid('parent_id').references(() => parents.id, { onDelete: 'cascade' }),
    classId: uuid('class_id').references(() => classes.id, { onDelete: 'set null' }),
    nickname: text('nickname').notNull(),
    momoColor: text('momo_color').notNull().default('blue'),
    picturePinHash: text('picture_pin_hash'),
    pinChangedAt: stamp('pin_changed_at'),
    failedPinAttempts: integer('failed_pin_attempts').notNull().default(0),
    /** Berapa kali terkunci beruntun: menentukan lama kunci berikutnya (1, 5, 30, lalu 120 menit). */
    pinLockCount: integer('pin_lock_count').notNull().default(0),
    pinLockedUntil: stamp('pin_locked_until'),
    active: boolean('active').notNull().default(true),
    certificateName: text('certificate_name'),
    certificateConsentAt: stamp('certificate_consent_at'),
    lastLevelId: text('last_level_id'),
    lastActiveAt: stamp('last_active_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('children_parent_idx').on(t.parentId),
    index('children_class_idx').on(t.classId),
    uniqueIndex('children_parent_nickname_key')
      .on(t.parentId, sql`lower(${t.nickname})`)
      .where(sql`${t.parentId} is not null`),
    uniqueIndex('children_class_nickname_key')
      .on(t.classId, sql`lower(${t.nickname})`)
      .where(sql`${t.classId} is not null`),
  ],
);

// ---- Kurikulum ----

/** Buku = satu pasangan mapel dan kelas. `custom` = dibuat admin (bisa dihapus bila belum dikerjakan). */
export const books = pgTable('books', {
  slug: text('slug').primaryKey(),
  grade: smallint('grade').notNull(),
  subject: text('subject').notNull(),
  title: text('title').notNull(),
  sort: integer('sort').notNull().default(0),
  custom: boolean('custom').notNull().default(false),
  createdAt: createdAt(),
});

/** Id topik berbentuk "slug:kode", mis. "matematika-kelas-1:A". */
export const topics = pgTable(
  'topics',
  {
    id: text('id').primaryKey(),
    bookSlug: text('book_slug')
      .notNull()
      .references(() => books.slug, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    title: text('title').notNull(),
    lesson: text('lesson').notNull(),
    tips: jsonb('tips')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    sort: integer('sort').notNull().default(0),
    custom: boolean('custom').notNull().default(false),
  },
  (t) => [uniqueIndex('topics_book_code_key').on(t.bookSlug, t.code)],
);

/**
 * Id level berbentuk "slug:kode:nomor". Soal berasal dari `bank` (soal tulisan admin, menggantikan generator) atau,
 * bila `bank` kosong, dari `generator` + `generatorParams` (bawaan konten). Keduanya kosong = "Segera hadir".
 */
export const levels = pgTable(
  'levels',
  {
    id: text('id').primaryKey(),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    number: smallint('number').notNull(),
    title: text('title').notNull(),
    /** Pengecualian admin: true gratis, false Premium, null mengikuti aturan Pengaturan. */
    freeOverride: boolean('free_override'),
    generator: text('generator'),
    generatorParams: jsonb('generator_params').$type<Record<string, unknown>>(),
    bank: jsonb('bank').$type<unknown[]>(),
    custom: boolean('custom').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('levels_topic_number_key').on(t.topicId, t.number)],
);

// ---- Belajar ----

/** Satu sesi ronde (10 soal dibuat ulang dari level + seed). Hasil akhirnya ada di `quiz_results`. */
export const rounds = pgTable(
  'rounds',
  {
    id: pk(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    seed: bigint('seed', { mode: 'number' }).notNull(),
    generatorSnapshot: jsonb('generator_snapshot')
      .$type<{ generator: string; generatorParams?: Record<string, unknown> }>()
      .notNull(),
    stageBefore: smallint('stage_before').notNull().default(0),
    startedAt: stamp('started_at').notNull().defaultNow(),
    finishedAt: stamp('finished_at'),
    /** `live` = dimainkan online; `sync` = dikirim dari antrean offline perangkat. */
    source: text('source').notNull().default('live'),
  },
  (t) => [
    index('rounds_child_started_idx').on(t.childId, t.startedAt),
    index('rounds_level_idx').on(t.levelId),
  ],
);

export const roundAnswers = pgTable(
  'round_answers',
  {
    roundId: uuid('round_id')
      .notNull()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    idx: smallint('idx').notNull(),
    chosen: text('chosen').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    answeredAt: stamp('answered_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roundId, t.idx] })],
);

/** Hasil ronde yang sudah selesai (satu baris per ronde). Sumber laporan, peringkat, dan wawasan dasbor. */
export const quizResults = pgTable(
  'quiz_results',
  {
    id: pk(),
    roundId: uuid('round_id')
      .notNull()
      .unique()
      .references(() => rounds.id, { onDelete: 'cascade' }),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    bookSlug: text('book_slug').notNull(),
    score: smallint('score').notNull(),
    correct: smallint('correct').notNull(),
    wrong: smallint('wrong').notNull(),
    durationMs: integer('duration_ms').notNull(),
    passed: boolean('passed').notNull(),
    result: jsonb('result').$type<import('@udakids/engine').RoundResult>().notNull(),
    finishedAt: stamp('finished_at').notNull().defaultNow(),
  },
  (t) => [
    index('quiz_results_child_idx').on(t.childId, t.finishedAt),
    index('quiz_results_level_idx').on(t.levelId),
    index('quiz_results_finished_idx').on(t.finishedAt),
    index('quiz_results_book_idx').on(t.bookSlug),
  ],
);

/** Skor terbaik dan status lulus per anak per level. Skor terbaik dan status lulus tidak pernah turun. */
export const levelProgress = pgTable(
  'level_progress',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    levelId: text('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    bestScore: smallint('best_score').notNull().default(0),
    bestMs: integer('best_ms'),
    passed: boolean('passed').notNull().default(false),
    attempts: integer('attempts').notNull().default(0),
    firstPassedAt: stamp('first_passed_at'),
    updatedAt: stamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.childId, t.levelId] }),
    index('level_progress_level_idx').on(t.levelId),
  ],
);

/** Penguasaan topik (tanaman Momo): skor 0 sampai 100 dan tahap yang terlihat. Tahap tidak pernah turun. */
export const topicMastery = pgTable(
  'topic_mastery',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    topicId: text('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    score: smallint('score').notNull().default(0),
    visibleStage: smallint('visible_stage').notNull().default(0),
    challengeCorrect: smallint('challenge_correct').notNull().default(0),
    updatedAt: stamp('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.topicId] })],
);

/**
 * Catatan kejadian belajar yang dikirim perangkat (antrean offline). `id` dibuat di perangkat (uuid), sehingga
 * pengiriman ganda aman: `insert ... on conflict (id) do nothing`.
 */
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    /** Jam perangkat saat kejadian (dibatasi server supaya tidak bisa dimajukan ke masa depan). */
    occurredAt: stamp('occurred_at').notNull(),
    receivedAt: stamp('received_at').notNull().defaultNow(),
  },
  (t) => [index('events_child_idx').on(t.childId, t.occurredAt)],
);

// ---- Sertifikat dan Premium ----

/** Nama anak dan judul buku disalin saat terbit, supaya lembar tidak berubah diam-diam. */
export const certificates = pgTable(
  'certificates',
  {
    id: text('id').primaryKey(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    childName: text('child_name').notNull(),
    bookSlug: text('book_slug').notNull(),
    bookTitle: text('book_title').notNull(),
    topics: smallint('topics').notNull(),
    levels: smallint('levels').notNull(),
    design: text('design').notNull().default('klasik'),
    source: text('source').$type<'auto' | 'claim' | 'admin'>().notNull(),
    averageScore: smallint('average_score'),
    issuedAt: stamp('issued_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('certificates_child_book_key').on(t.childId, t.bookSlug)],
);

/** Premium per anak yang diberikan admin. `endsAt` kosong berarti selamanya. */
export const premiumGrants = pgTable(
  'premium_grants',
  {
    id: pk(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    endsAt: stamp('ends_at'),
    note: text('note').notNull().default(''),
    grantedBy: text('granted_by'),
    createdAt: createdAt(),
  },
  (t) => [index('premium_grants_child_idx').on(t.childId)],
);

// ---- Billing ----

export const billingPackages = pgTable('billing_packages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  durationDays: integer('duration_days'),
  listPrice: integer('list_price').notNull(),
  price: integer('price').notNull(),
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
});

export const paymentMethods = pgTable('payment_methods', {
  id: text('id').primaryKey(),
  kind: text('kind').$type<'bank' | 'ewallet'>().notNull(),
  name: text('name').notNull(),
  number: text('number').notNull(),
  holder: text('holder').notNull(),
  instructions: text('instructions').notNull().default(''),
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(0),
});

/**
 * Pesanan paket (transfer manual). Nama paket, harga, dan rekening disalin saat pesanan dibuat, jadi riwayat tetap utuh
 * walau paket atau rekening diubah. Total = harga + kode unik (1 sampai 499) supaya transfer mudah dicocokkan.
 */
export const orders = pgTable(
  'orders',
  {
    id: pk(),
    number: text('number').notNull().unique(),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => parents.id, { onDelete: 'cascade' }),
    packageId: text('package_id').notNull(),
    packageName: text('package_name').notNull(),
    durationDays: integer('duration_days'),
    listPrice: integer('list_price').notNull(),
    discount: integer('discount').notNull(),
    price: integer('price').notNull(),
    uniqueCode: integer('unique_code').notNull(),
    total: integer('total').notNull(),
    methodId: text('method_id').notNull(),
    methodKind: text('method_kind').$type<'bank' | 'ewallet'>().notNull(),
    methodName: text('method_name').notNull(),
    methodNumber: text('method_number').notNull(),
    methodHolder: text('method_holder').notNull(),
    status: text('status').notNull().default('awaiting_payment'),
    createdAt: createdAt(),
    expiresAt: stamp('expires_at').notNull(),
    proofName: text('proof_name'),
    proofMime: text('proof_mime'),
    proofData: bytea('proof_data'),
    proofAt: stamp('proof_at'),
    rejectNote: text('reject_note'),
    paidAt: stamp('paid_at'),
    reviewedBy: text('reviewed_by'),
  },
  (t) => [
    index('orders_parent_idx').on(t.parentId, t.createdAt),
    index('orders_status_idx').on(t.status, t.createdAt),
    index('orders_open_total_idx').on(t.status, t.total),
  ],
);

/** Buku kas admin: pemasukan otomatis dari pesanan lunas (satu per pesanan), pengeluaran dan penyesuaian manual. */
export const cashEntries = pgTable(
  'cash_entries',
  {
    id: pk(),
    day: date('day').notNull(),
    kind: text('kind').$type<'in' | 'out'>().notNull(),
    amount: integer('amount').notNull(),
    category: text('category').notNull().default('lain'),
    note: text('note').notNull().default(''),
    orderId: uuid('order_id')
      .unique()
      .references(() => orders.id, { onDelete: 'set null' }),
    createdBy: text('created_by'),
    createdAt: createdAt(),
  },
  (t) => [index('cash_entries_day_idx').on(t.day)],
);

// ---- Afiliasi ----

/** Orang tua yang mendaftar lewat kode ajakan. Komisi dicatat saat pesanan pertama orang itu disetujui. */
export const referrals = pgTable(
  'referrals',
  {
    id: pk(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => parents.id, { onDelete: 'cascade' }),
    refereeId: uuid('referee_id')
      .notNull()
      .unique()
      .references(() => parents.id, { onDelete: 'cascade' }),
    status: text('status').$type<'registered' | 'paid'>().notNull().default('registered'),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    commission: integer('commission').notNull().default(0),
    createdAt: createdAt(),
    paidAt: stamp('paid_at'),
  },
  (t) => [index('referrals_referrer_idx').on(t.referrerId)],
);

/** Pembayaran komisi ke pengajak (dicatat admin setelah transfer). */
export const commissionPayouts = pgTable(
  'commission_payouts',
  {
    id: pk(),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => parents.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    note: text('note').notNull().default(''),
    createdBy: text('created_by'),
    createdAt: createdAt(),
  },
  (t) => [index('commission_payouts_parent_idx').on(t.parentId)],
);

// ---- Pengaturan, media, ilustrasi, suara ----

/** Pengaturan aplikasi per bagian (billing, contact, certificate, voice, certificateDesign, affiliate). */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: stamp('updated_at').notNull().defaultNow(),
});

/** Riwayat stempel sertifikat yang pernah diunggah admin. */
export const stamps = pgTable('stamps', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  image: text('image').notNull(),
  createdAt: createdAt(),
});

/** Ilustrasi AI: permintaan admin, hasil gambar, dan statusnya di antrean tinjau. */
export const illustrations = pgTable(
  'illustrations',
  {
    id: pk(),
    kind: text('kind').notNull(),
    subject: text('subject').notNull(),
    theme: text('theme').notNull(),
    count: smallint('count').notNull(),
    withMomo: boolean('with_momo').notNull(),
    momoColor: text('momo_color').notNull(),
    variant: smallint('variant').notNull(),
    status: text('status').$type<'review' | 'approved' | 'rejected'>().notNull().default('review'),
    /** Mesin pembuat gambar, mis. "openai gpt-image-1". */
    engine: text('engine').notNull(),
    prompt: text('prompt'),
    imageMime: text('image_mime'),
    imageData: bytea('image_data'),
    createdBy: text('created_by').notNull(),
    createdAt: createdAt(),
    reviewedAt: stamp('reviewed_at'),
  },
  (t) => [index('illustrations_status_idx').on(t.status, t.createdAt)],
);

/** Gambar unggahan admin (banner, galeri). Hanya JPG, PNG, atau WebP yang isinya terbukti gambar. */
export const mediaFiles = pgTable('media_files', {
  id: pk(),
  name: text('name').notNull(),
  mime: text('mime').notNull(),
  bytes: integer('bytes').notNull(),
  data: bytea('data').notNull(),
  createdBy: text('created_by'),
  createdAt: createdAt(),
});

/**
 * Cache klip suara Momo. Kunci = hash dari model, suara, kecepatan, dan teks, jadi kalimat yang sama tidak pernah
 * dibuatkan suara dua kali (biaya penyedia TTS dihitung per karakter).
 */
export const voiceClips = pgTable(
  'voice_clips',
  {
    hash: text('hash').primaryKey(),
    text: text('text').notNull(),
    voice: text('voice').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    data: bytea('data').notNull(),
    hits: integer('hits').notNull().default(0),
    createdAt: createdAt(),
    lastUsedAt: stamp('last_used_at').notNull().defaultNow(),
  },
  (t) => [index('voice_clips_created_idx').on(t.createdAt)],
);

// ---- Email ----

/** Kode 6 angka (verifikasi pendaftaran, lupa password, ganti email). Hanya hash-nya yang disimpan. */
export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: pk(),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => parents.id, { onDelete: 'cascade' }),
    purpose: text('purpose').$type<'verify' | 'reset' | 'email'>().notNull(),
    newEmail: text('new_email'),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: stamp('expires_at').notNull(),
    consumedAt: stamp('consumed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('email_verifications_parent_idx').on(t.parentId, t.purpose, t.createdAt)],
);

/** Antrean email: transaksi tidak pernah gagal karena email. Isi dihapus setelah terkirim. */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: pk(),
    toEmail: text('to_email').notNull(),
    subject: text('subject').notNull(),
    html: text('html'),
    text: text('text'),
    kind: text('kind').notNull(),
    refId: text('ref_id'),
    status: text('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    smtpResponse: text('smtp_response'),
    nextAttemptAt: stamp('next_attempt_at').notNull().defaultNow(),
    createdAt: createdAt(),
    sentAt: stamp('sent_at'),
  },
  (t) => [index('email_outbox_due_idx').on(t.status, t.nextAttemptAt)],
);
