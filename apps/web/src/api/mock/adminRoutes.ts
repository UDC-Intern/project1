import {
  FOREVER_ISO,
  PIN_PICTURES,
  WEEK_MS,
  effectiveStatus,
  emailSchema,
  generateRound,
  hasGenerator,
  illustrationRequestSchema,
  masteryStatus,
  passwordSchema,
  type Illustration,
  type Pin,
  type PlanStatus,
} from '@udakids/engine';
import type {
  AdminChildReport,
  AdminDashboard,
  AdminNotification,
  ChildRow,
  ChildSummaryRow,
  DirectorySummary,
  FamilyChild,
  FamilyRow,
  Grant,
  LevelStat,
  Page,
  PackageRow,
  StaffUser,
  TopicStatus,
} from '../adminTypes';
import { ApiError } from '../client';
import * as admin from './admin';
import * as billing from './billing';
import { bookProgress } from './certificate';
import { clearDemoData, demoSummary, reloadDemoData } from './demoData';
import {
  BOOKS,
  ILLUSTRATION_ENGINE,
  isChildActive,
  levelId,
  newId,
  premiumUntilOf,
  readDb,
  syncChildPremium,
  topicId,
  writeDb,
  type MockChild,
  type MockDb,
  type MockGrant,
  type MockParent,
} from './db';
import { findLevel } from './levels';
import { orderView } from './parentRoutes';
import * as stamps from './stamps';
import * as syllabus from './syllabus';
import { catalogBooks } from './syllabus';
import { SETTINGS_PARTS, adminSettings, updateSettings, type SettingsPart } from './settings';
import { adminFromToken } from './staff';

/**
 * Pintu masuk data tiruan untuk halaman panel admin: alamat dan bentuk respons mengikuti kontrak yang dipakai
 * halaman itu, lalu diteruskan ke modul tiruan yang sudah ada. Semua rute hanya untuk admin.
 */

type Body = Record<string, unknown>;
const DAY_MS = 86_400_000;

const notFound = (message = 'Data tidak ketemu.') =>
  new ApiError(404, { code: 'NOT_FOUND', message });
const invalid = (message: string, path?: string) =>
  new ApiError(400, { code: 'VALIDATION', message }, path ? [{ path, message }] : []);

const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);

function finishedRounds(db: MockDb, childId?: string) {
  return Object.values(db.rounds).filter(
    (r) => r.result && r.finishedAt && (!childId || r.childId === childId),
  );
}

function lastActive(db: MockDb, childId: string): string | null {
  const last = finishedRounds(db, childId).sort((a, b) => b.finishedAt! - a.finishedAt!)[0];
  return iso(last?.finishedAt);
}

function answersOf(db: MockDb, childId: string, since = 0) {
  let answered = 0;
  let correct = 0;
  for (const r of finishedRounds(db, childId)) {
    if (r.finishedAt! < since) continue;
    for (const a of Object.values(r.answers)) {
      answered += 1;
      if (a.isCorrect) correct += 1;
    }
  }
  return { answered, correct };
}

// ---- Premium ----

const isLive = (g: MockGrant) => g.endsAt === null || Date.parse(g.endsAt) > Date.now();

function grantView(db: MockDb, g: MockGrant): Grant {
  return {
    id: g.id,
    source: 'admin',
    note: g.note || null,
    childId: g.childId,
    startsAt: g.createdAt,
    endsAt: g.endsAt,
    createdAt: g.createdAt,
    grantedByName: g.grantedBy,
    live: isLive(g),
  };
}

/** Premium yang berlaku untuk anak: paket keluarga atau pemberian admin, yang paling akhir. */
function childPlan(db: MockDb, child: MockChild): PlanStatus {
  const until = premiumUntilOf(db, child.id);
  if (!until) return { tier: 'free', endsAt: null, source: null };
  return {
    tier: 'premium',
    endsAt: until === FOREVER_ISO ? null : until,
    source: db.familyPremium[child.parentId] === until ? 'purchase' : 'admin',
  };
}

function familyPlan(db: MockDb, parent: MockParent): PlanStatus {
  const until = db.familyPremium[parent.id];
  if (!until || Date.parse(until) <= Date.now())
    return { tier: 'free', endsAt: null, source: null };
  return { tier: 'premium', endsAt: until === FOREVER_ISO ? null : until, source: 'purchase' };
}

function grantPremium(token: string | null, body: Body | undefined) {
  const me = adminFromToken(token);
  const db = readDb();
  const child = db.children.find((c) => c.id === body?.childId);
  if (!child) throw notFound('Anak tidak ketemu.');
  const days = body?.durationDays;
  if (
    days !== null &&
    !(typeof days === 'number' && Number.isInteger(days) && days > 0 && days <= 3650)
  )
    throw invalid('Pilih lama Premium.', 'durationDays');
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 200) : '';
  // Perpanjangan dimulai dari akhir Premium admin yang masih berlaku.
  const live = db.premiumGrants.filter((g) => g.childId === child.id && isLive(g));
  if (live.some((g) => g.endsAt === null))
    throw new ApiError(409, { code: 'CONFLICT', message: 'Anak ini sudah Premium selamanya.' });
  const from = Math.max(Date.now(), ...live.map((g) => Date.parse(g.endsAt!)));
  const grant: MockGrant = {
    id: newId('g'),
    childId: child.id,
    endsAt: days === null ? null : new Date(from + (days as number) * DAY_MS).toISOString(),
    note,
    grantedBy: me.name,
    createdAt: new Date().toISOString(),
  };
  db.premiumGrants.push(grant);
  syncChildPremium(db, child.id);
  writeDb(db);
  return grantView(db, grant);
}

function revokePremium(token: string | null, grantId: string) {
  adminFromToken(token);
  const db = readDb();
  const grant = db.premiumGrants.find((g) => g.id === grantId);
  if (!grant) throw notFound('Pemberian Premium tidak ketemu.');
  db.premiumGrants = db.premiumGrants.filter((g) => g.id !== grantId);
  syncChildPremium(db, grant.childId);
  writeDb(db);
}

// ---- Direktori keluarga dan anak ----

function familyChild(db: MockDb, c: MockChild): FamilyChild {
  return {
    id: c.id,
    nickname: c.nickname,
    momoColor: c.momoColor,
    active: isChildActive(db, c),
    lastActiveAt: lastActive(db, c.id),
    plan: childPlan(db, c),
    grants: db.premiumGrants.filter((g) => g.childId === c.id).map((g) => grantView(db, g)),
  };
}

function familyRow(db: MockDb, p: MockParent): FamilyRow {
  const children = db.children.filter((c) => c.parentId === p.id).map((c) => familyChild(db, c));
  const times = children.map((c) => c.lastActiveAt).filter((v): v is string => v !== null);
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    familyCode: p.familyCode,
    active: p.active !== false,
    createdAt: p.createdAt ?? null,
    lastActiveAt: times.sort().at(-1) ?? null,
    plan: familyPlan(db, p),
    premiumChildren: children.filter((c) => c.plan.tier === 'premium').length,
    children,
  };
}

function childRow(db: MockDb, c: MockChild): ChildRow {
  const parent = db.parents.find((p) => p.id === c.parentId);
  return {
    ...familyChild(db, c),
    createdAt: c.createdAt ?? null,
    parent: { id: c.parentId, name: parent?.name ?? '-', email: parent?.email ?? '-' },
    passed: (db.passedLevels[c.id] ?? []).length,
    answered: answersOf(db, c.id).answered,
  };
}

type ListQuery = {
  search: string;
  status: string;
  active: string;
  sort: string;
  page: number;
  pageSize: number;
};

function listQuery(params: URLSearchParams): ListQuery {
  const size = Number(params.get('pageSize') ?? 20);
  return {
    search: (params.get('search') ?? '').trim().toLowerCase(),
    status: params.get('status') ?? 'all',
    active: params.get('active') ?? 'all',
    sort: params.get('sort') ?? 'newest',
    page: Math.max(1, Number(params.get('page') ?? 1) || 1),
    pageSize: [10, 20, 50].includes(size) ? size : 20,
  };
}

function paged<T>(items: T[], q: ListQuery): Page<T> {
  const start = (q.page - 1) * q.pageSize;
  return {
    page: q.page,
    pageSize: q.pageSize,
    total: items.length,
    items: items.slice(start, start + q.pageSize),
  };
}

const byText = (a: string, b: string) => a.localeCompare(b, 'id');
const byDate = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '');

function sorted<T extends { name: string; createdAt: string | null; lastActiveAt: string | null }>(
  items: T[],
  sort: string,
): T[] {
  const copy = [...items];
  if (sort === 'name') return copy.sort((a, b) => byText(a.name, b.name));
  if (sort === 'oldest') return copy.sort((a, b) => byDate(b.createdAt, a.createdAt));
  if (sort === 'recent') return copy.sort((a, b) => byDate(a.lastActiveAt, b.lastActiveAt));
  return copy.sort((a, b) => byDate(a.createdAt, b.createdAt));
}

function families(params: URLSearchParams): Page<FamilyRow> {
  const db = readDb();
  const q = listQuery(params);
  const rows = db.parents
    .map((p) => familyRow(db, p))
    .filter(
      (f) =>
        (!q.search ||
          [f.name, f.email, f.familyCode, ...f.children.map((c) => c.nickname)].some((v) =>
            v.toLowerCase().includes(q.search),
          )) &&
        (q.status === 'all' || (q.status === 'premium') === f.premiumChildren > 0) &&
        (q.active === 'all' || (q.active === 'active') === f.active),
    );
  return paged(sorted(rows, q.sort), q);
}

function childrenPage(params: URLSearchParams): Page<ChildRow> {
  const db = readDb();
  const q = listQuery(params);
  const rows = db.children
    .map((c) => childRow(db, c))
    .filter(
      (c) =>
        (!q.search ||
          [c.nickname, c.parent.name, c.parent.email].some((v) =>
            v.toLowerCase().includes(q.search),
          )) &&
        (q.status === 'all' || (q.status === 'premium') === (c.plan.tier === 'premium')) &&
        (q.active === 'all' || (q.active === 'active') === c.active),
    )
    .map((c) => ({ ...c, name: c.nickname }));
  return paged(
    sorted(rows, q.sort).map(({ name: _n, ...c }) => c),
    q,
  );
}

function summary(): DirectorySummary {
  const db = readDb();
  const rows = db.parents.map((p) => familyRow(db, p));
  const kids = rows.flatMap((f) => f.children);
  return {
    families: rows.length,
    familiesInactive: rows.filter((f) => !f.active).length,
    children: kids.length,
    childrenInactive: kids.filter((c) => !c.active).length,
    premiumChildren: kids.filter((c) => c.plan.tier === 'premium').length,
    premiumFamilies: rows.filter((f) => f.plan.tier === 'premium').length,
    adminGrants: db.premiumGrants.filter(isLive).length,
  };
}

function patchParent(token: string | null, id: string, body: Body | undefined) {
  adminFromToken(token);
  const db = readDb();
  const parent = db.parents.find((p) => p.id === id);
  if (!parent) throw notFound('Orang tua tidak ketemu.');
  if (typeof body?.active === 'boolean') parent.active = body.active;
  writeDb(db);
  return familyRow(db, parent);
}

function setParentPassword(token: string | null, id: string, body: Body | undefined) {
  adminFromToken(token);
  const db = readDb();
  const parent = db.parents.find((p) => p.id === id);
  if (!parent) throw notFound('Orang tua tidak ketemu.');
  const parsed = passwordSchema.safeParse(body?.password);
  if (!parsed.success) throw invalid('Password minimal 8 karakter.', 'password');
  parent.password = parsed.data;
  parent.passwordChangedAt = new Date().toISOString();
  writeDb(db);
}

function patchChild(token: string | null, id: string, body: Body | undefined) {
  adminFromToken(token);
  const db = readDb();
  const child = db.children.find((c) => c.id === id);
  if (!child) throw notFound('Anak tidak ketemu.');
  if (typeof body?.active === 'boolean') child.active = body.active;
  writeDb(db);
  return familyChild(db, child);
}

function setChildPin(token: string | null, id: string, body: Body | undefined) {
  adminFromToken(token);
  const db = readDb();
  const child = db.children.find((c) => c.id === id);
  if (!child) throw notFound('Anak tidak ketemu.');
  const pin = body?.pin;
  if (
    !Array.isArray(pin) ||
    pin.length !== 3 ||
    !pin.every((p) => (PIN_PICTURES as readonly unknown[]).includes(p))
  )
    throw invalid('Pilih 3 gambar.', 'pin');
  child.pin = pin as Pin;
  child.failedAttempts = 0;
  child.lockCount = 0;
  child.lockedUntil = null;
  writeDb(db);
}

// ---- Staf ----

const staffView = (a: MockDb['admins'][number]): StaffUser => ({
  id: a.id,
  name: a.name,
  email: a.email,
  active: a.active !== false,
  createdAt: a.createdAt ?? null,
});

function createStaff(token: string | null, body: Body | undefined) {
  adminFromToken(token);
  const db = readDb();
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 60) throw invalid('Nama 2 sampai 60 huruf.', 'name');
  const email = emailSchema.safeParse(body?.email);
  if (!email.success) throw invalid('Format email belum benar.', 'email');
  const password = passwordSchema.safeParse(body?.password);
  if (!password.success) throw invalid('Password minimal 8 karakter.', 'password');
  if (
    db.admins.some((a) => a.email === email.data) ||
    db.parents.some((p) => p.email === email.data)
  )
    throw new ApiError(409, { code: 'CONFLICT', message: 'Email ini sudah dipakai.' });
  const created = {
    id: newId('a'),
    name,
    email: email.data,
    password: password.data,
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.admins.push(created);
  writeDb(db);
  return staffView(created);
}

function patchStaff(token: string | null, id: string, body: Body | undefined) {
  const me = adminFromToken(token);
  const db = readDb();
  const user = db.admins.find((a) => a.id === id);
  if (!user) throw notFound('Staf tidak ketemu.');
  if (typeof body?.active === 'boolean') {
    if (!body.active && user.id === me.id)
      throw new ApiError(409, {
        code: 'CONFLICT',
        message: 'Akun yang sedang dipakai tidak bisa dinonaktifkan.',
      });
    user.active = body.active;
  }
  if (body?.password !== undefined) {
    const parsed = passwordSchema.safeParse(body.password);
    if (!parsed.success) throw invalid('Password minimal 8 karakter.', 'password');
    user.password = parsed.data;
  }
  writeDb(db);
  return staffView(user);
}

// ---- Laporan ----

function levelStats(): LevelStat[] {
  const db = readDb();
  const rows: LevelStat[] = [];
  const rounds = finishedRounds(db);
  for (const book of BOOKS) {
    for (const topic of book.topics) {
      for (const level of topic.levels) {
        const id = levelId(book.slug, topic.code, level.number);
        const mine = rounds.filter((r) => r.levelId === id);
        let answered = 0;
        let correct = 0;
        const wrong = new Map<string, number>();
        for (const r of mine)
          for (const a of Object.values(r.answers)) {
            answered += 1;
            if (a.isCorrect) correct += 1;
            else wrong.set(a.chosen, (wrong.get(a.chosen) ?? 0) + 1);
          }
        rows.push({
          id,
          bookSlug: book.slug,
          bookTitle: book.title,
          topicCode: topic.code,
          topicTitle: topic.title,
          number: level.number,
          title: level.title,
          answered,
          accuracy: answered ? Math.round((correct / answered) * 100) : null,
          learners: new Set(mine.map((r) => r.childId)).size,
          passed: db.children.filter((c) => (db.passedLevels[c.id] ?? []).includes(id)).length,
          topWrong: [...wrong.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([answer, count]) => ({ answer, count })),
        });
      }
    }
  }
  return rows;
}

function childSummaries(): ChildSummaryRow[] {
  const db = readDb();
  return db.children.map((c) => {
    const { answered, correct } = answersOf(db, c.id);
    return {
      id: c.id,
      nickname: c.nickname,
      momoColor: c.momoColor,
      parentName: db.parents.find((p) => p.id === c.parentId)?.name ?? '-',
      answered,
      correct,
      passed: (db.passedLevels[c.id] ?? []).length,
      lastActiveAt: lastActive(db, c.id),
      active: isChildActive(db, c),
    };
  });
}

function childReport(id: string): AdminChildReport {
  const db = readDb();
  const child = db.children.find((c) => c.id === id);
  if (!child) throw notFound('Anak tidak ketemu.');
  const passedIds = new Set(db.passedLevels[id] ?? []);
  const rounds = finishedRounds(db, id);
  const books: AdminChildReport['books'] = BOOKS.map((book) => {
    const topics = book.topics.map((topic) => {
      const tId = topicId(book.slug, topic.code);
      const m = db.mastery[id]?.[tId];
      const status: TopicStatus = m ? masteryStatus(m.score) : 'not_started';
      return {
        id: tId,
        code: topic.code,
        title: topic.title,
        mastery: m?.score ?? 0,
        status,
        stage: m?.visibleStage ?? 0,
        levels: topic.levels.map((level) => {
          const lId = levelId(book.slug, topic.code, level.number);
          let answered = 0;
          let correct = 0;
          for (const r of rounds)
            if (r.levelId === lId)
              for (const a of Object.values(r.answers)) {
                answered += 1;
                if (a.isCorrect) correct += 1;
              }
          return {
            id: lId,
            number: level.number,
            title: level.title,
            best: db.best[id]?.[lId]?.score ?? null,
            answered,
            correct,
            passed: passedIds.has(lId),
          };
        }),
      };
    });
    const levels = topics.flatMap((t) => t.levels);
    const started = topics.filter((t) => t.status !== 'not_started');
    return {
      slug: book.slug,
      title: book.title,
      mastery: started.length
        ? Math.round(started.reduce((n, t) => n + t.mastery, 0) / started.length)
        : 0,
      passed: levels.filter((l) => l.passed).length,
      levels: levels.length,
      mastered: topics.filter((t) => t.status === 'mastered').length,
      topics,
    };
  });
  const allTopics = books.flatMap((b) => b.topics.map((t) => ({ ...t, bookTitle: b.title })));
  return {
    child: {
      id: child.id,
      nickname: child.nickname,
      momoColor: child.momoColor,
      parentName: db.parents.find((p) => p.id === child.parentId)?.name ?? '-',
      lastActiveAt: lastActive(db, id),
      createdAt: child.createdAt ?? null,
    },
    totals: {
      ...answersOf(db, id),
      passed: passedIds.size,
      levels: books.reduce((n, b) => n + b.levels, 0),
      mastered: allTopics.filter((t) => t.status === 'mastered').length,
      topics: allTopics.length,
    },
    week: answersOf(db, id, Date.now() - WEEK_MS),
    // Saran: topik yang sudah dimulai dengan penguasaan terendah dan belum Jago.
    recommendations: allTopics
      .filter((t) => t.status === 'learning' || t.status === 'proficient')
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3)
      .map((t) => ({ topicId: t.id, title: t.title, bookTitle: t.bookTitle, status: t.status })),
    books,
  };
}

// ---- Transaksi ----

async function ordersFor(token: string | null, status: string | null) {
  const list = await billing.adminOrders(token, null);
  const db = readDb();
  const kindOf = (id: string) => db.methods.find((m) => m.id === id)?.kind ?? 'bank';
  const mimeOf = (dataUrl: string | null) => /^data:([^;]+);/.exec(dataUrl ?? '')?.[1] ?? null;
  return list
    .filter((o) => !status || status === 'all' || o.status === status)
    .map((o) => ({
      ...orderView(o, kindOf(o.methodId), mimeOf(o.proofDataUrl)),
      parentName: o.parentName,
      parentEmail: o.parentEmail,
    }));
}

async function orderById(token: string | null, id: string) {
  const found = (await ordersFor(token, null)).find((o) => o.id === id);
  if (!found) throw notFound('Pesanan tidak ketemu.');
  return found;
}

// ---- Paket ----

const packageRow = (p: billing.AdminPackage): PackageRow => ({
  ...p,
  pricing: {
    normal: p.listPrice,
    final: p.price,
    discount: p.listPrice - p.price,
    discountActive: p.listPrice > p.price,
  },
});

// ---- Konten ----

/** Pengecualian gratis/Premium per level; sama dengan aturan Pengaturan berarti pengecualiannya dihapus. */
async function saveLevel(token: string | null, id: string, body: Body | undefined) {
  if (!findLevel(id)) throw notFound('Level tidak ketemu.');
  const [, , n] = id.split(':');
  const title = typeof body?.title === 'string' ? body.title : undefined;
  if (title !== undefined) await admin.updateLevel(token, id, { title });
  if (typeof body?.free === 'boolean') {
    if (n === '1' && !body.free) throw invalid('Level 1 harus tetap gratis.', 'free');
    const db = readDb();
    const ruleFree = !db.settings.billing.paywall || Number(n) <= db.settings.billing.freeLevels;
    const edit = { ...db.contentEdits.levels[id] };
    if (body.free === ruleFree) delete edit.isFree;
    else edit.isFree = body.free;
    db.contentEdits.levels[id] = edit;
    writeDb(db);
  }
}

// ---- Notifikasi ----

function notifications(): { items: AdminNotification[] } {
  const db = readDb();
  const items: AdminNotification[] = [];
  for (const p of db.parents)
    if (p.createdAt)
      items.push({
        key: `parent:${p.id}`,
        kind: 'parent',
        at: p.createdAt,
        title: p.name,
        detail: p.email,
        amount: null,
        href: `/admin/keluarga?q=${encodeURIComponent(p.email)}`,
      });
  for (const c of db.children)
    if (c.createdAt)
      items.push({
        key: `child:${c.id}`,
        kind: 'child',
        at: c.createdAt,
        title: c.nickname,
        detail: db.parents.find((p) => p.id === c.parentId)?.name ?? '',
        amount: null,
        href: `/admin/keluarga?tab=anak&q=${encodeURIComponent(c.nickname)}`,
      });
  for (const o of Object.values(db.orders)) {
    const parent = db.parents.find((p) => p.id === o.parentId)?.name ?? '';
    items.push({
      key: `order:${o.id}`,
      kind: 'order_created',
      at: o.createdAt,
      title: o.packageName,
      detail: parent,
      amount: o.total,
      href: '/admin/transaksi',
    });
    if (o.proofAt)
      items.push({
        key: `proof:${o.id}`,
        kind: 'order_proof',
        at: o.proofAt,
        title: o.number,
        detail: parent,
        amount: o.total,
        href: '/admin/transaksi',
      });
  }
  for (const c of Object.values(db.certificates))
    items.push({
      key: `cert:${c.id}`,
      kind: 'certificate',
      at: c.issuedAt,
      title: c.childName,
      detail: c.bookTitle,
      amount: null,
      href: '/admin/sertifikat',
    });
  return { items: items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30) };
}

// ---- Ringkasan ----

const RANGE_DAYS: Record<string, () => number> = {
  '7d': () => 7,
  '30d': () => 30,
  month: () => new Date().getDate(),
};

/** Ringkasan yang melengkapi grafik `insights`: antrean kerja admin, kelulusan per buku, dan kabar terbaru. */
function dashboard(params: URLSearchParams): AdminDashboard {
  const db = readDb();
  const range = params.get('range') ?? '7d';
  const days = (RANGE_DAYS[range] ?? RANGE_DAYS['7d']!)();
  const from = Date.now() - days * DAY_MS;
  const rounds = finishedRounds(db).filter((r) => r.finishedAt! >= from);
  const passRate = (list: typeof rounds) =>
    list.length
      ? Math.round((list.filter((r) => r.result!.passed).length / list.length) * 100)
      : null;
  const now = Date.now();
  const orders = Object.values(db.orders);
  const statusOf = (o: (typeof orders)[number]) => effectiveStatus(o, now);
  let waiting = 0;
  for (const child of db.children)
    for (const book of BOOKS) {
      const s = bookProgress(db, child.id, book).status;
      if (s === 'ready' || s === 'premium_required') waiting += 1;
    }
  const parentName = (id: string) => db.parents.find((p) => p.id === id)?.name ?? '-';
  return {
    range,
    rounds: rounds.length,
    passRate: passRate(rounds),
    counts: {
      families: db.parents.length,
      children: db.children.length,
      premiumChildren: db.children.filter((c) => premiumUntilOf(db, c.id) !== null).length,
      certificates: Object.keys(db.certificates).length,
      waitingCertificates: waiting,
      pendingOrders: orders.filter((o) => statusOf(o) === 'awaiting_review').length,
      awaitingPayment: orders.filter((o) => statusOf(o) === 'awaiting_payment').length,
      illustrationsToReview: db.illustrations.filter((i) => i.status === 'review').length,
    },
    books: BOOKS.map((book) => {
      const mine = rounds.filter((r) => r.levelId.startsWith(`${book.slug}:`));
      const total = book.topics.reduce((n, t) => n + t.levels.length, 0);
      return {
        slug: book.slug,
        title: book.title,
        rounds: mine.length,
        learners: new Set(mine.map((r) => r.childId)).size,
        passRate: passRate(mine),
        finished: db.children.filter(
          (c) =>
            total > 0 &&
            book.topics.every((t) =>
              t.levels.every((l) =>
                (db.passedLevels[c.id] ?? []).includes(levelId(book.slug, t.code, l.number)),
              ),
            ),
        ).length,
      };
    }),
    recentOrders: orders
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        number: o.number,
        parentName: parentName(o.parentId),
        packageName: o.packageName,
        total: o.total,
        status: statusOf(o),
        createdAt: o.createdAt,
      })),
  };
}

// ---- Media: pemakaian aset dan Ilustrasi AI ----

let usageCache: { objects: Record<string, number> } | null = null;

/** Berapa level yang memakai tiap benda hitung (dari soal generator, 3 seed per level). Dihitung sekali per sesi. */
function assetUsage(): { objects: Record<string, number> } {
  if (usageCache) return usageCache;
  const objects: Record<string, number> = {};
  for (const book of BOOKS)
    for (const topic of book.topics)
      for (const level of topic.levels) {
        if (!hasGenerator(level.generator)) continue;
        const items = new Set<string>();
        for (const seed of [1, 2, 3])
          for (const q of generateRound(
            {
              generator: level.generator!,
              generatorParams: level.generatorParams as Record<string, unknown> | undefined,
            },
            seed,
          ))
            if (q.visual) items.add(q.visual.item);
        for (const item of items) objects[item] = (objects[item] ?? 0) + 1;
      }
  usageCache = { objects };
  return usageCache;
}

function illustrations(params: URLSearchParams): Illustration[] {
  const status = params.get('status') ?? 'all';
  return readDb()
    .illustrations.filter((i) => status === 'all' || i.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function createIllustration(token: string | null, body: Body | undefined): Illustration {
  const me = adminFromToken(token);
  const parsed = illustrationRequestSchema.safeParse(body);
  if (!parsed.success)
    throw new ApiError(
      400,
      { code: 'VALIDATION', message: 'Periksa lagi isian ilustrasi.' },
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  const db = readDb();
  const made: Illustration = {
    ...parsed.data,
    id: newId('il'),
    status: 'review',
    engine: ILLUSTRATION_ENGINE,
    createdBy: me.name,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  db.illustrations.push(made);
  writeDb(db);
  return made;
}

function reviewIllustration(
  token: string | null,
  id: string,
  body: Body | undefined,
): Illustration {
  adminFromToken(token);
  const db = readDb();
  const item = db.illustrations.find((i) => i.id === id);
  if (!item) throw notFound('Ilustrasi tidak ketemu.');
  const status = body?.status;
  if (status !== 'approved' && status !== 'rejected' && status !== 'review')
    throw invalid('Status tidak dikenal.', 'status');
  item.status = status;
  item.reviewedAt = status === 'review' ? null : new Date().toISOString();
  writeDb(db);
  return item;
}

function deleteIllustration(token: string | null, id: string) {
  adminFromToken(token);
  const db = readDb();
  if (!db.illustrations.some((i) => i.id === id)) throw notFound('Ilustrasi tidak ketemu.');
  db.illustrations = db.illustrations.filter((i) => i.id !== id);
  writeDb(db);
}

/** Memetakan alamat ke fungsi tiruan. Alamat yang tidak dikenal dijawab 404. */
export async function handle<T>(
  path: string,
  method: string,
  body: Body | undefined,
  token: string | null,
): Promise<T> {
  adminFromToken(token);
  const [url, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  const seg = url!.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
  const send = (value: unknown) => value as T;
  const at = (...parts: string[]) =>
    parts.length === seg.length && parts.every((p, i) => p === '*' || p === seg[i]);

  // Direktori dan Premium
  if (method === 'GET' && at('directory', 'summary')) return send(summary());
  if (method === 'GET' && at('directory', 'families')) return send(families(params));
  if (method === 'GET' && at('directory', 'children')) return send(childrenPage(params));
  if (method === 'POST' && at('premium')) return send(grantPremium(token, body));
  if (method === 'DELETE' && at('premium', '*')) return send(revokePremium(token, seg[1]!));
  if (method === 'PATCH' && at('parents', '*')) return send(patchParent(token, seg[1]!, body));
  if (method === 'POST' && at('parents', '*', 'password'))
    return send(setParentPassword(token, seg[1]!, body));
  if (method === 'PATCH' && at('children', '*')) return send(patchChild(token, seg[1]!, body));
  if (method === 'POST' && at('children', '*', 'pin'))
    return send(setChildPin(token, seg[1]!, body));

  // Staf
  if (method === 'GET' && at('staff')) return send(readDb().admins.map(staffView));
  if (method === 'POST' && at('staff')) return send(createStaff(token, body));
  if (method === 'PATCH' && at('staff', '*')) return send(patchStaff(token, seg[1]!, body));

  // Laporan
  if (method === 'GET' && at('reports', 'levels')) return send(levelStats());
  if (method === 'GET' && at('children')) return send(childSummaries());
  if (method === 'GET' && at('children', '*', 'report')) return send(childReport(seg[1]!));

  // Transaksi
  if (method === 'GET' && at('orders')) return send(await ordersFor(token, params.get('status')));
  if (method === 'GET' && at('orders', 'pending-count'))
    return send({ count: await billing.awaitingReviewCount(token) });
  if (method === 'GET' && at('orders', '*', 'proof')) {
    const o = readDb().orders[seg[1]!];
    if (!o) throw notFound('Pesanan tidak ketemu.');
    return send({ dataUrl: o.proofDataUrl });
  }
  if (method === 'POST' && at('orders', '*', 'approve')) {
    await billing.approveOrder(token, seg[1]!);
    return send(await orderById(token, seg[1]!));
  }
  if (method === 'POST' && at('orders', '*', 'reject')) {
    await billing.rejectOrder(token, seg[1]!, String(body?.reason ?? ''));
    return send(await orderById(token, seg[1]!));
  }

  // Paket
  if (method === 'GET' && at('packages'))
    return send((await billing.adminPackages(token)).map(packageRow));
  if (method === 'POST' && at('packages'))
    return send(packageRow(await billing.createPackage(token, body as never)));
  if (method === 'PUT' && at('packages', '*'))
    return send(packageRow(await billing.updatePackage(token, seg[1]!, body as never)));
  if (method === 'DELETE' && at('packages', '*'))
    return send(await billing.deletePackage(token, seg[1]!));

  // Rekening dan e-wallet
  if (method === 'GET' && at('payment-methods')) return send(await billing.adminMethods(token));
  if (method === 'POST' && at('payment-methods'))
    return send(await billing.createMethod(token, body as never));
  if (method === 'PUT' && at('payment-methods', '*'))
    return send(await billing.updateMethod(token, seg[1]!, body as never));
  if (method === 'DELETE' && at('payment-methods', '*'))
    return send(await billing.deleteMethod(token, seg[1]!));

  // Silabus Belajar: baca, sunting, tambah, dan hapus buku, topik, level, serta soal
  if (method === 'GET' && at('catalogs')) return send(catalogBooks());
  if (method === 'PATCH' && at('topics', '*')) {
    await admin.updateTopic(token, seg[1]!, body as never);
    return send(catalogBooks());
  }
  if (method === 'PATCH' && at('levels', '*')) {
    await saveLevel(token, seg[1]!, body);
    return send(catalogBooks());
  }
  if (method === 'POST' && at('books')) return send(await syllabus.addBook(token, body));
  if (method === 'DELETE' && at('books', '*'))
    return send(await syllabus.deleteBook(token, seg[1]!));
  if (method === 'POST' && at('books', '*', 'topics'))
    return send(await syllabus.addTopic(token, seg[1]!, body));
  if (method === 'DELETE' && at('topics', '*'))
    return send(await syllabus.deleteTopic(token, seg[1]!));
  if (method === 'POST' && at('topics', '*', 'levels'))
    return send(await syllabus.addLevel(token, seg[1]!, body));
  if (method === 'DELETE' && at('levels', '*'))
    return send(await syllabus.deleteLevel(token, seg[1]!));
  if (method === 'GET' && at('levels', '*', 'questions'))
    return send(
      await syllabus.getQuestions(token, seg[1]!, {
        from: params.get('from'),
        seed: Number(params.get('seed')) || undefined,
      }),
    );
  if (method === 'PUT' && at('levels', '*', 'questions'))
    return send(await syllabus.saveQuestions(token, seg[1]!, body));
  if (method === 'DELETE' && at('levels', '*', 'questions'))
    return send(await syllabus.clearQuestions(token, seg[1]!));

  // Riwayat stempel sertifikat
  if (method === 'GET' && at('stamps')) return send(await stamps.list(token));
  if (method === 'POST' && at('stamps')) return send(await stamps.add(token, body));
  if (method === 'DELETE' && at('stamps', '*')) return send(await stamps.remove(token, seg[1]!));

  // Pengaturan
  if (method === 'GET' && at('settings')) return send(await adminSettings(token));
  if (method === 'PUT' && at('settings', '*') && SETTINGS_PARTS.includes(seg[1] as SettingsPart))
    return send(await updateSettings(token, seg[1] as SettingsPart, body));

  // Ringkasan
  if (method === 'GET' && at('dashboard')) return send(dashboard(params));

  // Media
  if (method === 'GET' && at('media', 'usage')) return send(assetUsage());
  if (method === 'GET' && at('illustrations')) return send(illustrations(params));
  if (method === 'POST' && at('illustrations')) return send(createIllustration(token, body));
  if (method === 'PATCH' && at('illustrations', '*'))
    return send(reviewIllustration(token, seg[1]!, body));
  if (method === 'DELETE' && at('illustrations', '*'))
    return send(deleteIllustration(token, seg[1]!));

  // Notifikasi
  if (method === 'GET' && at('notifications')) return send(notifications());

  // Data contoh (hanya mode tiruan)
  if (method === 'GET' && at('demo-data')) return send(demoSummary());
  if (method === 'POST' && at('demo-data')) return send(reloadDemoData());
  if (method === 'DELETE' && at('demo-data')) return send(clearDemoData());

  throw notFound();
}
