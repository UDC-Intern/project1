import {
  BANK_GOOD_QUESTIONS,
  BANK_MAX_QUESTIONS,
  BANK_MIN_QUESTIONS,
  MAX_LEVELS_PER_TOPIC,
  MAX_TOPICS_PER_BOOK,
  bankFromGenerator,
  bankFromLevel,
  bankToLevel,
  bookInputSchema,
  bookSlugOf,
  generateRound,
  levelInputSchema,
  levelSource,
  nextTopicCode,
  questionBankSchema,
  subjectCodeOf,
  topicInputSchema,
  type BankQuestion,
  type BookContent,
  type LevelContent,
  type TopicContent,
  type TopicInput,
} from '@udakids/engine';
import type { CatalogBook } from '../adminTypes';
import { ApiError } from '../client';
import {
  BOOKS,
  applyEdits,
  baseLevelOf,
  gradeOf,
  levelId,
  readDb,
  topicId,
  writeDb,
  type MockDb,
  type SyllabusAdditions,
} from './db';
import { findLevel } from './levels';
import { isLevelFree } from './settings';
import { adminFromToken } from './staff';

/**
 * Silabus Belajar di mode tiruan: menambah dan menghapus buku, topik, dan level, serta menulis bank soal sebuah
 * level. Yang bawaan (dari berkas konten) hanya bisa disunting judul dan materinya; yang dibuat admin bisa dihapus
 * selama belum dikerjakan anak.
 */

/** Galat skema (zod) dalam bentuk yang dibutuhkan di sini. */
type SchemaError = { issues: { path: PropertyKey[]; message: string }[] };

const issuesOf = (error: SchemaError) =>
  error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));

const invalid = (error: SchemaError) =>
  new ApiError(
    400,
    { code: 'VALIDATION', message: error.issues[0]?.message ?? 'Periksa lagi isian.' },
    issuesOf(error),
  );

const failed = (message: string, path?: string) =>
  new ApiError(400, { code: 'VALIDATION', message }, path ? [{ path, message }] : []);
const conflict = (message: string) => new ApiError(409, { code: 'CONFLICT', message });
const notFound = (message: string) => new ApiError(404, { code: 'NOT_FOUND', message });

const additions = (db: MockDb): SyllabusAdditions =>
  (db.contentEdits.added ??= { books: [], topics: [], levels: [] });

/** Kunci buku, topik, dan level yang dibuat admin. */
function customKeys(db: MockDb) {
  const a = db.contentEdits.added;
  const books = new Set<string>();
  const topics = new Set<string>();
  const levels = new Set<string>();
  const addTopic = (slug: string, topic: TopicContent, wholeTopic: boolean) => {
    const tid = topicId(slug, topic.code);
    if (wholeTopic) topics.add(tid);
    for (const l of topic.levels) levels.add(levelId(slug, topic.code, l.number));
  };
  for (const b of a?.books ?? []) {
    books.add(b.slug);
    for (const t of b.topics) addTopic(b.slug, t, true);
  }
  for (const x of a?.topics ?? []) addTopic(x.book, x.topic, true);
  for (const x of a?.levels ?? []) {
    const [slug, code] = x.topic.split(':');
    levels.add(levelId(slug!, code!, x.level.number));
  }
  return { books, topics, levels };
}

/** Id level yang sudah dikerjakan anak (lulus atau pernah ronde). */
function usedLevelIds(db: MockDb): Set<string> {
  const ids = new Set<string>();
  for (const list of Object.values(db.passedLevels)) for (const id of list) ids.add(id);
  for (const r of Object.values(db.rounds)) ids.add(r.levelId);
  return ids;
}

const anyUsed = (ids: Set<string>, prefix: string) => [...ids].some((id) => id.startsWith(prefix));

const questionCount = (level: LevelContent) =>
  ((level.generatorParams as { params?: { items?: unknown[] } } | undefined)?.params?.items ?? [])
    .length;

/** `GET /admin/catalogs`: seluruh silabus, dengan tanda mana yang buatan admin dan mana yang sudah dikerjakan. */
export function catalogBooks(): CatalogBook[] {
  const db = readDb();
  const mine = customKeys(db);
  const used = usedLevelIds(db);
  const certified = new Set(Object.values(db.certificates).map((c) => c.bookSlug));
  return BOOKS.map((b) => ({
    slug: b.slug,
    title: b.title,
    subject: b.subject,
    grade: gradeOf(b.slug),
    custom: mine.books.has(b.slug),
    used: certified.has(b.slug) || anyUsed(used, `${b.slug}:`),
    topics: b.topics.map((t) => {
      const tid = topicId(b.slug, t.code);
      return {
        id: tid,
        code: t.code,
        title: t.title,
        lesson: t.lesson,
        tips: t.tips ?? [],
        custom: mine.topics.has(tid),
        used: anyUsed(used, `${tid}:`),
        levels: t.levels.map((l) => {
          const id = levelId(b.slug, t.code, l.number);
          const source = levelSource(l);
          return {
            id,
            number: l.number,
            title: l.title,
            free: isLevelFree(db, id, l.number),
            override: db.contentEdits.levels[id]?.isFree !== undefined,
            generator: l.generator,
            source,
            questions: source === 'bank' ? questionCount(l) : 0,
            custom: mine.levels.has(id),
            used: used.has(id),
            edited: db.contentEdits.questions?.[id] !== undefined,
          };
        }),
      };
    }),
  }));
}

function save(db: MockDb): CatalogBook[] {
  applyEdits(db.contentEdits);
  writeDb(db);
  return catalogBooks();
}

/** Topik dari isian formulir: level baru belum punya soal ("Segera hadir") sampai bank soalnya ditulis. */
function topicOf(input: TopicInput, code: string, sort: number): TopicContent {
  return {
    code,
    title: input.title,
    sort,
    lesson: input.lesson,
    ...(input.tips.length > 0 && { tips: input.tips }),
    levels: input.levels.map((l, i) => ({
      number: i + 1,
      title: l.title,
      isFree: i < 2,
      generator: null,
    })),
  };
}

/** Kode topik dari isian (dirapikan) atau dibuat otomatis; harus unik di bukunya. */
function codeFor(book: BookContent | undefined, wanted: string | undefined): string {
  const used = (book?.topics ?? []).map((t) => t.code);
  if (!wanted) return nextTopicCode(used);
  const code = wanted.toUpperCase();
  if (used.some((c) => c.toUpperCase() === code))
    throw failed(`Kode ${code} sudah dipakai topik lain di buku ini.`, 'code');
  return code;
}

/** `POST /admin/books`: buku baru untuk satu pasangan mapel dan kelas, langsung dengan topik pertamanya. */
export async function addBook(token: string | null, body: unknown): Promise<CatalogBook[]> {
  adminFromToken(token);
  const parsed = bookInputSchema.safeParse(body);
  if (!parsed.success) throw invalid(parsed.error);
  const { grade, title, topic } = parsed.data;
  // Matematika dan Sains tersimpan sebagai kode lama; mapel lain sebagai namanya yang rapi.
  const subject = subjectCodeOf(parsed.data.subject);
  const slug = bookSlugOf(subject, grade);
  if (BOOKS.some((b) => b.slug === slug))
    throw conflict('Buku untuk mapel dan kelas ini sudah ada. Tambahkan topik ke buku itu.');
  const db = readDb();
  additions(db).books.push({
    slug,
    grade: grade === 1 ? 'kelas-1' : `sd${grade}`,
    subject,
    title,
    // Dalam satu kelas: Matematika, lalu Sains, lalu mapel lain menurut urutan dibuat.
    sort: 100 + grade * 10 + (subject === 'math' ? 0 : subject === 'science' ? 1 : 2),
    topics: [topicOf(topic, codeFor(undefined, topic.code), 1)],
  });
  return save(db);
}

/** `DELETE /admin/books/:slug`: hanya buku buatan admin yang belum dikerjakan anak. */
export async function deleteBook(token: string | null, slug: string): Promise<CatalogBook[]> {
  adminFromToken(token);
  const db = readDb();
  const found = catalogBooks().find((b) => b.slug === slug);
  if (!found) throw notFound('Buku tidak ketemu.');
  if (!found.custom) throw conflict('Buku bawaan tidak bisa dihapus.');
  if (found.used) throw conflict('Buku ini sudah dikerjakan anak, jadi tidak bisa dihapus.');
  const a = additions(db);
  a.books = a.books.filter((b) => b.slug !== slug);
  a.topics = a.topics.filter((x) => x.book !== slug);
  a.levels = a.levels.filter((x) => !x.topic.startsWith(`${slug}:`));
  dropEdits(db, (key) => key.startsWith(`${slug}:`));
  return save(db);
}

/** `POST /admin/books/:slug/topics`: topik baru di akhir buku. */
export async function addTopic(
  token: string | null,
  slug: string,
  body: unknown,
): Promise<CatalogBook[]> {
  adminFromToken(token);
  const book = BOOKS.find((b) => b.slug === slug);
  if (!book) throw notFound('Buku tidak ketemu.');
  const parsed = topicInputSchema.safeParse(body);
  if (!parsed.success) throw invalid(parsed.error);
  if (book.topics.length >= MAX_TOPICS_PER_BOOK)
    throw conflict(`Satu buku paling banyak ${MAX_TOPICS_PER_BOOK} topik.`);
  const db = readDb();
  const sort = Math.max(0, ...book.topics.map((t) => t.sort)) + 1;
  additions(db).topics.push({
    book: slug,
    topic: topicOf(parsed.data, codeFor(book, parsed.data.code), sort),
  });
  return save(db);
}

/** `DELETE /admin/topics/:id`: hanya topik buatan admin yang belum dikerjakan, dan bukan topik terakhir. */
export async function deleteTopic(token: string | null, id: string): Promise<CatalogBook[]> {
  adminFromToken(token);
  const [slug, code] = id.split(':');
  const book = catalogBooks().find((b) => b.slug === slug);
  const topic = book?.topics.find((t) => t.code === code);
  if (!book || !topic) throw notFound('Topik tidak ketemu.');
  if (!topic.custom) throw conflict('Topik bawaan tidak bisa dihapus.');
  if (topic.used) throw conflict('Topik ini sudah dikerjakan anak, jadi tidak bisa dihapus.');
  if (book.topics.length <= 1)
    throw conflict('Topik terakhir tidak bisa dihapus. Hapus bukunya bila tidak dipakai lagi.');
  const db = readDb();
  const a = additions(db);
  a.topics = a.topics.filter((x) => topicId(x.book, x.topic.code) !== id);
  for (const b of a.books) b.topics = b.topics.filter((t) => topicId(b.slug, t.code) !== id);
  a.levels = a.levels.filter((x) => x.topic !== id);
  dropEdits(db, (key) => key === id || key.startsWith(`${id}:`));
  return save(db);
}

/** `POST /admin/topics/:id/levels`: level baru di akhir topik, belum punya soal. */
export async function addLevel(
  token: string | null,
  id: string,
  body: unknown,
): Promise<CatalogBook[]> {
  adminFromToken(token);
  const [slug, code] = id.split(':');
  const topic = BOOKS.find((b) => b.slug === slug)?.topics.find((t) => t.code === code);
  if (!topic) throw notFound('Topik tidak ketemu.');
  const parsed = levelInputSchema.safeParse(body);
  if (!parsed.success) throw invalid(parsed.error);
  if (topic.levels.length >= MAX_LEVELS_PER_TOPIC)
    throw conflict(`Satu topik paling banyak ${MAX_LEVELS_PER_TOPIC} level.`);
  const number = Math.max(0, ...topic.levels.map((l) => l.number)) + 1;
  const db = readDb();
  additions(db).levels.push({
    topic: id,
    level: { number, title: parsed.data.title, isFree: number <= 2, generator: null },
  });
  return save(db);
}

/** Level tersimpan buatan admin (objek aslinya, supaya bisa diubah), atau undefined. */
function storedLevel(a: SyllabusAdditions, tid: string, number: number): LevelContent | undefined {
  const own = a.levels.find((x) => x.topic === tid && x.level.number === number);
  if (own) return own.level;
  const topics = [
    ...a.books.flatMap((b) => b.topics.map((t) => ({ id: topicId(b.slug, t.code), topic: t }))),
    ...a.topics.map((x) => ({ id: topicId(x.book, x.topic.code), topic: x.topic })),
  ];
  return topics.find((x) => x.id === tid)?.topic.levels.find((l) => l.number === number);
}

/** Hapus level buatan admin dari tempat penyimpanannya. */
function dropStoredLevel(a: SyllabusAdditions, tid: string, number: number): void {
  a.levels = a.levels.filter((x) => !(x.topic === tid && x.level.number === number));
  const strip = (levels: LevelContent[]) => {
    const i = levels.findIndex((l) => l.number === number);
    if (i >= 0) levels.splice(i, 1);
  };
  for (const b of a.books)
    for (const t of b.topics) if (topicId(b.slug, t.code) === tid) strip(t.levels);
  for (const x of a.topics) if (topicId(x.book, x.topic.code) === tid) strip(x.topic.levels);
}

function findLevelInCatalog(id: string) {
  const [slug, code, n] = id.split(':');
  const book = catalogBooks().find((b) => b.slug === slug);
  const topic = book?.topics.find((t) => t.code === code);
  const level = topic?.levels.find((l) => String(l.number) === n);
  if (!book || !topic || !level) throw notFound('Level tidak ketemu.');
  return { topic, level, tid: topic.id, number: level.number };
}

/** `DELETE /admin/levels/:id`: hanya level terakhir buatan admin yang belum dikerjakan, dan bukan satu-satunya. */
export async function deleteLevel(token: string | null, id: string): Promise<CatalogBook[]> {
  adminFromToken(token);
  const { topic, level, tid, number } = findLevelInCatalog(id);
  if (!level.custom) throw conflict('Level bawaan tidak bisa dihapus.');
  if (level.used) throw conflict('Level ini sudah dikerjakan anak, jadi tidak bisa dihapus.');
  if (topic.levels.length <= 1)
    throw conflict('Level terakhir tidak bisa dihapus. Hapus topiknya bila tidak dipakai lagi.');
  if (number !== Math.max(...topic.levels.map((l) => l.number)))
    throw conflict('Hanya level paling akhir yang bisa dihapus, supaya nomor level tetap urut.');
  const db = readDb();
  dropStoredLevel(additions(db), tid, number);
  dropEdits(db, (key) => key === id);
  return save(db);
}

/** Buang suntingan judul, akses, dan soal milik item yang dihapus (kunci yang cocok dengan `match`). */
function dropEdits(db: MockDb, match: (key: string) => boolean) {
  const edits = db.contentEdits;
  for (const key of Object.keys(edits.levels)) if (match(key)) delete edits.levels[key];
  for (const key of Object.keys(edits.topics)) if (match(key)) delete edits.topics[key];
  for (const key of Object.keys(edits.questions ?? {}))
    if (match(key)) delete edits.questions![key];
}

export type LevelQuestions = {
  items: BankQuestion[];
  min: number;
  good: number;
  max: number;
  /** Soal belum disimpan: baru diambil dari generator level ini supaya bisa disunting. */
  draft: boolean;
  /** Level bawaan yang soalnya sudah disesuaikan admin (bisa dikembalikan ke soal bawaan). */
  edited: boolean;
  /** Level punya generator bawaan, jadi soal contoh bisa diambil ulang darinya. */
  regenerable: boolean;
};

/**
 * `GET /admin/levels/:id/questions`: soal sebuah level sebagai bank yang bisa disunting. Level yang soalnya sudah
 * berupa bank (tulisan admin, disesuaikan, atau bank bawaan) memberi isinya; level otomatis memberi 20 soal contoh
 * dari generatornya (`draft`), yang baru menggantikan generator setelah disimpan. `from: 'generator'` mengambil
 * contoh baru dari generator bawaan (dengan `seed` lain), meski soalnya sudah disesuaikan.
 */
export async function getQuestions(
  token: string | null,
  id: string,
  opts: { from?: string | null; seed?: number } = {},
): Promise<LevelQuestions> {
  adminFromToken(token);
  const { level } = findLevelInCatalog(id);
  const db = readDb();
  const content = findLevel(id)?.level;
  const base = baseLevelOf(id);
  const regenerable = !!base && levelSource(base) === 'auto';
  const stored = db.contentEdits.questions?.[id];
  const rest = {
    min: BANK_MIN_QUESTIONS,
    good: BANK_GOOD_QUESTIONS,
    max: BANK_MAX_QUESTIONS,
    edited: stored !== undefined,
    regenerable,
  };
  if (opts.from === 'generator') {
    if (!base || !regenerable)
      throw conflict('Level ini tidak punya soal otomatis yang bisa diambil ulang.');
    return { items: bankFromGenerator(base, { seed: opts.seed }), draft: true, ...rest };
  }
  if (stored) return { items: stored, draft: false, ...rest };
  const own = content ? bankFromLevel(content) : null;
  if (own) return { items: own, draft: false, ...rest };
  if (level.source === 'auto' && content)
    return { items: bankFromGenerator(content, { seed: opts.seed }), draft: true, ...rest };
  return { items: [], draft: false, ...rest };
}

/**
 * `PUT /admin/levels/:id/questions`: bank soal baru; level langsung memakainya dan bisa dimainkan anak. Level buatan
 * admin menyimpannya di levelnya sendiri; level bawaan menyimpannya sebagai suntingan yang menggantikan generatornya
 * (generator aslinya kembali bila suntingan dihapus).
 */
export async function saveQuestions(
  token: string | null,
  id: string,
  body: unknown,
): Promise<CatalogBook[]> {
  adminFromToken(token);
  const { level, tid, number } = findLevelInCatalog(id);
  const parsed = questionBankSchema.safeParse((body as { items?: unknown } | undefined)?.items);
  if (!parsed.success) throw invalid(parsed.error);
  const spec = bankToLevel(parsed.data);
  // Pastikan satu ronde benar-benar bisa dibuat sebelum disimpan.
  try {
    generateRound({ generator: spec.generator!, generatorParams: spec.generatorParams }, 1);
  } catch {
    throw failed('Soal belum bisa dibuat menjadi satu ronde. Periksa lagi pilihan jawabannya.');
  }
  const db = readDb();
  if (level.custom) {
    const stored = storedLevel(additions(db), tid, number);
    if (!stored) throw notFound('Level tidak ketemu.');
    stored.generator = spec.generator;
    stored.generatorParams = spec.generatorParams;
  } else {
    (db.contentEdits.questions ??= {})[id] = parsed.data;
  }
  return save(db);
}

/**
 * `DELETE /admin/levels/:id/questions`. Level buatan admin kembali ke "Segera hadir" (hanya bila belum dikerjakan
 * anak); level bawaan kembali ke soal bawaannya (generator aslinya), kapan pun.
 */
export async function clearQuestions(token: string | null, id: string): Promise<CatalogBook[]> {
  adminFromToken(token);
  const { level, tid, number } = findLevelInCatalog(id);
  const db = readDb();
  if (level.custom) {
    if (level.used)
      throw conflict('Level ini sudah dikerjakan anak, jadi soalnya tidak bisa dikosongkan.');
    const stored = storedLevel(additions(db), tid, number);
    if (!stored) throw notFound('Level tidak ketemu.');
    stored.generator = null;
    delete stored.generatorParams;
  } else {
    if (db.contentEdits.questions?.[id] === undefined)
      throw conflict('Soal level ini belum disesuaikan, jadi masih memakai soal bawaan.');
    delete db.contentEdits.questions[id];
  }
  return save(db);
}
